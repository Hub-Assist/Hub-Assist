import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CancellationPolicyService } from './cancellation-policy.service';
import { CancellationPolicy } from './cancellation-policy.entity';
import { Booking, BookingStatus } from './booking.entity';
import { WorkspaceType } from '../workspaces/workspace.entity';

/** Build a minimal Booking stub for policy evaluation tests. */
const makeBooking = (
  startTime: Date,
  totalAmount: number,
  workspaceType: WorkspaceType = WorkspaceType.MEETING_ROOM,
): Booking =>
  ({
    id: 'b-1',
    workspaceId: 'ws-1',
    userId: 'u-1',
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
    status: BookingStatus.PENDING,
    totalAmount,
    stellarTxHash: null,
    workspace: { type: workspaceType } as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Booking);

/** A policy: full refund ≥ 24 h, 50% partial ≥ 2 h, no refund < 2 h. */
const mockPolicy: CancellationPolicy = {
  id: 'p-1',
  workspaceType: WorkspaceType.MEETING_ROOM,
  fullRefundHoursBefore: 24,
  partialRefundPercent: 50,
  partialRefundHoursBefore: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CancellationPolicyService', () => {
  let service: CancellationPolicyService;

  const mockPolicyRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationPolicyService,
        {
          provide: getRepositoryToken(CancellationPolicy),
          useValue: mockPolicyRepo,
        },
      ],
    }).compile();

    service = module.get<CancellationPolicyService>(CancellationPolicyService);
    jest.clearAllMocks();
  });

  // ── evaluateRefund ─────────────────────────────────────────────────────────

  describe('evaluateRefund', () => {
    describe('with configured policy (full=24h, partial=50%@2h)', () => {
      beforeEach(() => {
        mockPolicyRepo.findOne.mockResolvedValue(mockPolicy);
      });

      it('returns full refund when cancelled 25 h before start', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-05-31T09:00:00Z'); // 25 h before
        const booking = makeBooking(startTime, 100);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(100);
        expect(result.refundAmount).toBe(100);
        expect(result.reason).toMatch(/full refund/i);
      });

      it('returns full refund when cancelled exactly at the full-refund threshold (24 h)', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-05-31T10:00:00Z'); // exactly 24 h before
        const booking = makeBooking(startTime, 80);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(100);
        expect(result.refundAmount).toBe(80);
      });

      it('returns partial refund when cancelled 5 h before start', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-06-01T05:00:00Z'); // 5 h before
        const booking = makeBooking(startTime, 100);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(50);
        expect(result.refundAmount).toBe(50);
        expect(result.reason).toMatch(/partial refund/i);
      });

      it('returns partial refund when cancelled exactly at the partial threshold (2 h)', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-06-01T08:00:00Z'); // exactly 2 h before
        const booking = makeBooking(startTime, 60);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(50);
        expect(result.refundAmount).toBe(30);
      });

      it('returns no refund when cancelled 1 h before start', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-06-01T09:00:00Z'); // 1 h before
        const booking = makeBooking(startTime, 100);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(0);
        expect(result.refundAmount).toBe(0);
        expect(result.reason).toMatch(/no refund/i);
      });

      it('returns no refund when cancelled after start time (negative hours)', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-06-01T11:00:00Z'); // 1 h AFTER start
        const booking = makeBooking(startTime, 100);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(0);
        expect(result.refundAmount).toBe(0);
      });

      it('calculates partial refundAmount correctly for non-round totalAmount', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-06-01T05:00:00Z'); // 5 h before → partial
        const booking = makeBooking(startTime, 33.33);

        const result = await service.evaluateRefund(booking, cancelledAt);

        // 50% of 33.33 = 16.665 → rounded to 16.67
        expect(result.refundAmount).toBe(16.67);
      });

      it('is deterministic for boundary value exactly at full-refund threshold', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-05-31T10:00:00Z'); // exactly 24 h

        const booking = makeBooking(startTime, 100);

        const r1 = await service.evaluateRefund(booking, cancelledAt);
        const r2 = await service.evaluateRefund(booking, cancelledAt);

        expect(r1.refundPercent).toBe(r2.refundPercent);
        expect(r1.refundAmount).toBe(r2.refundAmount);
      });
    });

    describe('default fallback (no policy configured)', () => {
      beforeEach(() => {
        mockPolicyRepo.findOne.mockResolvedValue(null);
      });

      it('returns full refund when cancelled > 24 h before start (default policy)', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-05-31T09:00:00Z'); // 25 h before
        const booking = makeBooking(startTime, 100);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(100);
        expect(result.refundAmount).toBe(100);
      });

      it('returns no refund when cancelled < 24 h before start (default policy)', async () => {
        const startTime = new Date('2025-06-01T10:00:00Z');
        const cancelledAt = new Date('2025-06-01T09:00:00Z'); // 1 h before
        const booking = makeBooking(startTime, 100);

        const result = await service.evaluateRefund(booking, cancelledAt);

        expect(result.refundPercent).toBe(0);
        expect(result.refundAmount).toBe(0);
      });
    });
  });

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all policies', async () => {
      mockPolicyRepo.find.mockResolvedValue([mockPolicy]);
      const result = await service.findAll();
      expect(result).toEqual([mockPolicy]);
    });
  });

  describe('findByWorkspaceType', () => {
    it('returns the policy for a given workspace type', async () => {
      mockPolicyRepo.findOne.mockResolvedValue(mockPolicy);
      const result = await service.findByWorkspaceType(WorkspaceType.MEETING_ROOM);
      expect(result).toEqual(mockPolicy);
    });

    it('throws NotFoundException when no policy exists', async () => {
      mockPolicyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findByWorkspaceType(WorkspaceType.HOT_DESK),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and saves a new policy', async () => {
      const dto = {
        workspaceType: WorkspaceType.MEETING_ROOM,
        fullRefundHoursBefore: 24,
        partialRefundPercent: 50,
        partialRefundHoursBefore: 2,
      };
      mockPolicyRepo.create.mockReturnValue(mockPolicy);
      mockPolicyRepo.save.mockResolvedValue(mockPolicy);

      const result = await service.create(dto);
      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepo.save).toHaveBeenCalledWith(mockPolicy);
    });
  });

  describe('update', () => {
    it('updates an existing policy', async () => {
      mockPolicyRepo.findOne.mockResolvedValue({ ...mockPolicy });
      const updated = { ...mockPolicy, fullRefundHoursBefore: 48 };
      mockPolicyRepo.save.mockResolvedValue(updated);

      const result = await service.update(WorkspaceType.MEETING_ROOM, {
        fullRefundHoursBefore: 48,
      });
      expect(result.fullRefundHoursBefore).toBe(48);
    });

    it('throws NotFoundException when policy does not exist', async () => {
      mockPolicyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(WorkspaceType.HOT_DESK, { fullRefundHoursBefore: 48 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes an existing policy', async () => {
      mockPolicyRepo.findOne.mockResolvedValue(mockPolicy);
      mockPolicyRepo.remove.mockResolvedValue(undefined);

      await expect(
        service.remove(WorkspaceType.MEETING_ROOM),
      ).resolves.toBeUndefined();
      expect(mockPolicyRepo.remove).toHaveBeenCalledWith(mockPolicy);
    });
  });
});
