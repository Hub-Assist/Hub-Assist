import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { PriceRule } from './price-rule.entity';
import { UserRole } from '../users/user.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRule = (overrides: Partial<PriceRule> = {}): PriceRule => ({
  id: 'rule-1',
  workspaceId: 'ws-1',
  dayOfWeek: 1, // Monday
  startHour: 9,
  endHour: 17,
  ratePerHour: 30,
  label: 'Peak',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const utcDate = (isoString: string) => new Date(isoString);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PricingEngineService', () => {
  let service: PricingEngineService;

  const mockRuleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingEngineService,
        { provide: getRepositoryToken(PriceRule), useValue: mockRuleRepo },
      ],
    }).compile();

    service = module.get<PricingEngineService>(PricingEngineService);
    jest.clearAllMocks();
  });

  // ── calculatePrice ──────────────────────────────────────────────────────────

  describe('calculatePrice', () => {
    it('throws BadRequestException when endTime <= startTime', async () => {
      const start = utcDate('2025-01-06T10:00:00Z'); // Monday
      const end = utcDate('2025-01-06T09:00:00Z');
      await expect(
        service.calculatePrice('ws-1', start, end, UserRole.MEMBER, 20, []),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses fallback rate when no rules exist', async () => {
      const start = utcDate('2025-01-06T09:00:00Z'); // Monday 09:00 UTC
      const end = utcDate('2025-01-06T11:00:00Z');   // Monday 11:00 UTC
      const snapshot = await service.calculatePrice('ws-1', start, end, UserRole.ADMIN, 20, []);

      // 2 hours × $20 = $40, admin discount = 0 %
      expect(snapshot.totalAmount).toBe(40);
      expect(snapshot.tierDiscount).toBe(0);
      expect(snapshot.segments).toHaveLength(2);
      expect(snapshot.segments[0].ruleId).toBe('fallback');
    });

    it('applies peak-hour rule for MEMBER tier with 10% discount', async () => {
      // Peak rule: Monday 09:00–17:00 @ $30/hr
      const peakRule = makeRule({ ratePerHour: 30, startHour: 9, endHour: 17, dayOfWeek: 1 });

      // 2025-01-06 is a Monday
      const start = utcDate('2025-01-06T09:00:00Z');
      const end = utcDate('2025-01-06T11:00:00Z');

      const snapshot = await service.calculatePrice(
        'ws-1', start, end, UserRole.MEMBER, 20, [peakRule],
      );

      // Gross: 2 hrs × $30 = $60; MEMBER discount 10% → $54
      expect(snapshot.totalAmount).toBe(54);
      expect(snapshot.tierDiscount).toBe(0.1);
      expect(snapshot.segments).toHaveLength(2);
      snapshot.segments.forEach((s) => {
        expect(s.ruleId).toBe('rule-1');
        expect(s.ratePerHour).toBe(30);
      });
    });

    it('calculates blended rate for booking spanning peak and off-peak boundaries', async () => {
      // Peak: Monday 09:00–17:00 @ $30/hr
      const peakRule = makeRule({ id: 'peak', ratePerHour: 30, startHour: 9, endHour: 17, dayOfWeek: 1 });
      // Off-peak: Monday 17:00–22:00 @ $15/hr
      const offPeakRule = makeRule({
        id: 'off-peak',
        ratePerHour: 15,
        startHour: 17,
        endHour: 22,
        dayOfWeek: 1,
        label: 'Off-Peak',
      });

      // 2025-01-06 Monday: 15:00–19:00 UTC (2 hrs peak + 2 hrs off-peak)
      const start = utcDate('2025-01-06T15:00:00Z');
      const end = utcDate('2025-01-06T19:00:00Z');

      const snapshot = await service.calculatePrice(
        'ws-1', start, end, UserRole.ADMIN, 20, [peakRule, offPeakRule],
      );

      // Gross: 2 × $30 + 2 × $15 = $60 + $30 = $90; admin discount 0%
      expect(snapshot.totalAmount).toBe(90);
      expect(snapshot.segments).toHaveLength(4);

      const peakSegments = snapshot.segments.filter((s) => s.ruleId === 'peak');
      const offPeakSegments = snapshot.segments.filter((s) => s.ruleId === 'off-peak');
      expect(peakSegments).toHaveLength(2);
      expect(offPeakSegments).toHaveLength(2);
    });

    it('handles partial-hour segments correctly (30-minute booking)', async () => {
      const peakRule = makeRule({ ratePerHour: 40, startHour: 9, endHour: 17, dayOfWeek: 1 });

      // 30-minute booking: 09:00–09:30 Monday
      const start = utcDate('2025-01-06T09:00:00Z');
      const end = utcDate('2025-01-06T09:30:00Z');

      const snapshot = await service.calculatePrice(
        'ws-1', start, end, UserRole.ADMIN, 20, [peakRule],
      );

      // 0.5 hrs × $40 = $20
      expect(snapshot.totalAmount).toBe(20);
      expect(snapshot.segments).toHaveLength(1);
      expect(snapshot.segments[0].hours).toBeCloseTo(0.5);
    });

    it('applies STAFF tier discount of 15%', async () => {
      const rule = makeRule({ ratePerHour: 100, startHour: 0, endHour: 24, dayOfWeek: 1 });
      const start = utcDate('2025-01-06T10:00:00Z');
      const end = utcDate('2025-01-06T12:00:00Z');

      const snapshot = await service.calculatePrice(
        'ws-1', start, end, UserRole.STAFF, 20, [rule],
      );

      // Gross: 2 × $100 = $200; STAFF 15% → $170
      expect(snapshot.totalAmount).toBe(170);
      expect(snapshot.tierDiscount).toBe(0.15);
    });

    it('falls back to workspace rate for hours outside any rule window', async () => {
      // Rule only covers 09:00–17:00 Monday
      const peakRule = makeRule({ ratePerHour: 30, startHour: 9, endHour: 17, dayOfWeek: 1 });

      // Booking 07:00–09:00 Monday — entirely outside rule window
      const start = utcDate('2025-01-06T07:00:00Z');
      const end = utcDate('2025-01-06T09:00:00Z');

      const snapshot = await service.calculatePrice(
        'ws-1', start, end, UserRole.ADMIN, 20, [peakRule],
      );

      // 2 hrs × $20 fallback = $40
      expect(snapshot.totalAmount).toBe(40);
      snapshot.segments.forEach((s) => expect(s.ruleId).toBe('fallback'));
    });

    it('stored rate snapshot matches the calculation at creation time', async () => {
      const peakRule = makeRule({ ratePerHour: 50, startHour: 9, endHour: 17, dayOfWeek: 1 });
      const start = utcDate('2025-01-06T10:00:00Z');
      const end = utcDate('2025-01-06T12:00:00Z');

      const snapshot = await service.calculatePrice(
        'ws-1', start, end, UserRole.MEMBER, 20, [peakRule],
      );

      // Verify snapshot is self-consistent
      const recomputedTotal = snapshot.segments.reduce((sum, s) => sum + s.segmentCost, 0);
      const expectedAfterDiscount = Number((recomputedTotal * (1 - snapshot.tierDiscount)).toFixed(2));
      expect(snapshot.totalAmount).toBe(expectedAfterDiscount);
      expect(snapshot.calculatedAt).toBeDefined();
      expect(snapshot.userTier).toBe(UserRole.MEMBER);
    });

    // ── Property-based: price is always non-negative ──────────────────────────

    it('price is always non-negative for any valid input (property-based)', async () => {
      const testCases: Array<{ hours: number; rate: number; tier: string }> = [
        { hours: 0.25, rate: 0, tier: UserRole.ADMIN },
        { hours: 1, rate: 0, tier: UserRole.MEMBER },
        { hours: 8, rate: 100, tier: UserRole.STAFF },
        { hours: 0.5, rate: 999.99, tier: UserRole.MEMBER },
        { hours: 24, rate: 0.01, tier: UserRole.ADMIN },
      ];

      for (const { hours, rate, tier } of testCases) {
        const start = utcDate('2025-01-06T00:00:00Z');
        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
        const rule = makeRule({ ratePerHour: rate, startHour: 0, endHour: 24, dayOfWeek: 1 });

        const snapshot = await service.calculatePrice('ws-1', start, end, tier, rate, [rule]);
        expect(snapshot.totalAmount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ── createRule ──────────────────────────────────────────────────────────────

  describe('createRule', () => {
    it('throws BadRequestException when startHour >= endHour', async () => {
      await expect(
        service.createRule({
          workspaceId: 'ws-1',
          dayOfWeek: 1,
          startHour: 17,
          endHour: 9,
          ratePerHour: 30,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when overlapping rule exists', async () => {
      mockRuleRepo.find.mockResolvedValue([
        makeRule({ startHour: 9, endHour: 17, dayOfWeek: 1 }),
      ]);

      await expect(
        service.createRule({
          workspaceId: 'ws-1',
          dayOfWeek: 1,
          startHour: 12,
          endHour: 20,
          ratePerHour: 25,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates rule when no overlap exists', async () => {
      mockRuleRepo.find.mockResolvedValue([]);
      const rule = makeRule();
      mockRuleRepo.create.mockReturnValue(rule);
      mockRuleRepo.save.mockResolvedValue(rule);

      const result = await service.createRule({
        workspaceId: 'ws-1',
        dayOfWeek: 1,
        startHour: 9,
        endHour: 17,
        ratePerHour: 30,
      });

      expect(result).toEqual(rule);
    });
  });

  // ── deleteRule ──────────────────────────────────────────────────────────────

  describe('deleteRule', () => {
    it('throws NotFoundException when rule does not exist', async () => {
      mockRuleRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteRule('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('removes the rule when found', async () => {
      const rule = makeRule();
      mockRuleRepo.findOne.mockResolvedValue(rule);
      mockRuleRepo.remove.mockResolvedValue(rule);

      await expect(service.deleteRule('rule-1')).resolves.toBeUndefined();
      expect(mockRuleRepo.remove).toHaveBeenCalledWith(rule);
    });
  });
});
