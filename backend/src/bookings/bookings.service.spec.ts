import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Booking, BookingStatus } from './booking.entity';
import { Workspace, WorkspaceType } from '../workspaces/workspace.entity';
import { StellarService } from '../stellar/stellar.service';
import { ConflictDetectionService } from './conflict-detection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecurrenceService } from './recurrence.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { PricingEngineService } from '../pricing/pricing-engine.service';
import { UserRole } from '../users/user.entity';
import { OutboxService } from '../outbox/outbox.service';
import { WebhookService } from '../webhooks/webhook.service';
import { AuditLogService } from '../audit/audit-log.service';

const mockWorkspace = {
  id: 'ws-1',
  name: 'Hot Desk',
  isActive: true,
  pricePerHour: 10,
  type: WorkspaceType.HOT_DESK,
};

const mockBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'booking-1',
  workspaceId: 'ws-1',
  userId: 'user-1',
  startTime: new Date('2025-01-01T09:00:00Z'),
  endTime: new Date('2025-01-01T11:00:00Z'),
  status: BookingStatus.PENDING,
  totalAmount: 20,
  stellarTxHash: null as any,
  workspace: mockWorkspace as any,
  user: { id: 'user-1' } as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('BookingsService', () => {
  let service: BookingsService;

  const mockManager = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]), // price rules
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBookingRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      transaction: jest.fn(async (cb) => cb(mockManager)),
    },
  };

  const mockWorkspaceRepo = {
    findOne: jest.fn(),
  };

  const mockStellarService = {
    verifyTransaction: jest.fn(),
  };

  const mockNotificationsService = {
    sendToUser: jest.fn(),
  };

  const mockConflictDetectionService = {
    hasConflict: jest.fn(),
  };

  const mockRecurrenceService = {
    expandInstances: jest.fn(),
  };

  const mockCancellationPolicyService = {
    evaluateRefund: jest.fn(),
  };

  const mockPricingEngineService = {
    calculatePrice: jest.fn().mockResolvedValue({
      segments: [],
      totalAmount: 20,
      userTier: UserRole.MEMBER,
      tierDiscount: 0.1,
      calculatedAt: new Date().toISOString(),
    }),
  };

  const mockOutboxService = {
    create: jest.fn(),
  };

  const mockWebhookService = {
    enqueue: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Workspace), useValue: mockWorkspaceRepo },
        { provide: StellarService, useValue: mockStellarService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConflictDetectionService, useValue: mockConflictDetectionService },
        { provide: RecurrenceService, useValue: mockRecurrenceService },
        { provide: CancellationPolicyService, useValue: mockCancellationPolicyService },
        { provide: PricingEngineService, useValue: mockPricingEngineService },
        { provide: OutboxService, useValue: mockOutboxService },
        { provide: WebhookService, useValue: mockWebhookService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  // ── create (single booking) ────────────────────────────────────────────────

  describe('create (single booking)', () => {
    const dto = {
      workspaceId: 'ws-1',
      startTime: '2025-01-01T09:00:00Z',
      endTime: '2025-01-01T11:00:00Z',
      totalAmount: 20,
    };

    it('creates and returns a booking', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockConflictDetectionService.hasConflict.mockResolvedValue(null);
      const created = mockBooking();
      mockManager.create.mockReturnValue(created);
      mockManager.save.mockResolvedValue(created);

      const result = await service.create('user-1', dto, UserRole.MEMBER);
      expect(result).toEqual(created);
      expect(mockManager.save).toHaveBeenCalledWith(created);
      expect(mockOutboxService.create).toHaveBeenCalled();
    });

    it('throws 404 when workspace not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);
      await expect(service.create('user-1', dto, UserRole.MEMBER)).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when overlapping confirmed booking exists', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockConflictDetectionService.hasConflict.mockResolvedValue({ reason: 'Capacity Exceeded' });

      await expect(service.create('user-1', dto, UserRole.MEMBER)).rejects.toThrow(ConflictException);
    });

    it('throws 400 when endTime is before startTime', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      await expect(
        service.create('user-1', {
          ...dto,
          startTime: '2025-01-01T11:00:00Z',
          endTime: '2025-01-01T09:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── create (recurring series) ──────────────────────────────────────────────

  describe('create (recurring series)', () => {
    const recurringDto = {
      workspaceId: 'ws-1',
      startTime: '2025-01-06T09:00:00Z',
      endTime: '2025-01-06T10:00:00Z',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=4',
    };

    const fourInstances = [
      { startTime: new Date('2025-01-06T09:00:00Z'), endTime: new Date('2025-01-06T10:00:00Z') },
      { startTime: new Date('2025-01-13T09:00:00Z'), endTime: new Date('2025-01-13T10:00:00Z') },
      { startTime: new Date('2025-01-20T09:00:00Z'), endTime: new Date('2025-01-20T10:00:00Z') },
      { startTime: new Date('2025-01-27T09:00:00Z'), endTime: new Date('2025-01-27T10:00:00Z') },
    ];

    it('creates all 4 instances when no conflicts exist', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockRecurrenceService.expandInstances.mockReturnValue(fourInstances);
      mockConflictDetectionService.hasConflict.mockResolvedValue(null);

      const savedBookings = fourInstances.map((inst, i) =>
        mockBooking({ ...inst, instanceIndex: i, seriesId: 'series-uuid' }),
      );
      mockManager.create.mockImplementation((_, data) => ({ ...data }));
      mockManager.save.mockResolvedValue(savedBookings);

      const result = await service.create('user-1', recurringDto);

      expect(Array.isArray(result)).toBe(true);
      expect(mockConflictDetectionService.hasConflict).toHaveBeenCalledTimes(4);
      expect(mockManager.save).toHaveBeenCalledTimes(1); // batch insert
    });

    it('rejects the entire series when a single instance conflicts (atomic)', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockRecurrenceService.expandInstances.mockReturnValue(fourInstances);

      // 3rd instance conflicts
      mockConflictDetectionService.hasConflict
        .mockResolvedValueOnce(null)   // instance 0 — ok
        .mockResolvedValueOnce(null)   // instance 1 — ok
        .mockResolvedValueOnce({ reason: 'Capacity Exceeded' }) // instance 2 — conflict
        .mockResolvedValueOnce(null);  // instance 3 — would be ok

      await expect(service.create('user-1', recurringDto)).rejects.toThrow(
        ConflictException,
      );

      // No bookings should have been saved
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('assigns the same seriesId to all instances', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockRecurrenceService.expandInstances.mockReturnValue(fourInstances);
      mockConflictDetectionService.hasConflict.mockResolvedValue(null);

      const createdBookings: any[] = [];
      mockManager.create.mockImplementation((_, data) => {
        createdBookings.push(data);
        return data;
      });
      mockManager.save.mockResolvedValue(createdBookings);

      await service.create('user-1', recurringDto);

      const seriesIds = createdBookings.map((b) => b.seriesId);
      expect(new Set(seriesIds).size).toBe(1); // all same seriesId
    });

    it('sets instanceIndex sequentially starting from 0', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockRecurrenceService.expandInstances.mockReturnValue(fourInstances);
      mockConflictDetectionService.hasConflict.mockResolvedValue(null);

      const createdBookings: any[] = [];
      mockManager.create.mockImplementation((_, data) => {
        createdBookings.push(data);
        return data;
      });
      mockManager.save.mockResolvedValue(createdBookings);

      await service.create('user-1', recurringDto);

      expect(createdBookings.map((b) => b.instanceIndex)).toEqual([0, 1, 2, 3]);
    });

    it('only sets recurrenceRule on the first instance', async () => {
      mockManager.findOne.mockResolvedValueOnce(mockWorkspace);
      mockRecurrenceService.expandInstances.mockReturnValue(fourInstances);
      mockConflictDetectionService.hasConflict.mockResolvedValue(null);

      const createdBookings: any[] = [];
      mockManager.create.mockImplementation((_, data) => {
        createdBookings.push(data);
        return data;
      });
      mockManager.save.mockResolvedValue(createdBookings);

      await service.create('user-1', recurringDto);

      expect(createdBookings[0].recurrenceRule).toBe('FREQ=WEEKLY;COUNT=4');
      expect(createdBookings[1].recurrenceRule).toBeUndefined();
      expect(createdBookings[2].recurrenceRule).toBeUndefined();
      expect(createdBookings[3].recurrenceRule).toBeUndefined();
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const buildQb = (results: Booking[]) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(results),
    });

    it('returns only the requesting user bookings when not admin', async () => {
      const userBooking = mockBooking({ userId: 'user-1' });
      const qb = buildQb([userBooking]);
      mockBookingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('user-1', false);
      expect(qb.where).toHaveBeenCalledWith('booking.userId = :userId', { userId: 'user-1' });
      expect(result).toEqual([userBooking]);
    });

    it('returns all bookings when admin', async () => {
      const allBookings = [
        mockBooking({ userId: 'user-1' }),
        mockBooking({ id: 'booking-2', userId: 'user-2' }),
      ];
      const qb = buildQb(allBookings);
      mockBookingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(undefined, true);
      expect(qb.where).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  // ── confirm ────────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('confirms a pending booking and writes an outbox event without calling Stellar synchronously', async () => {
      const booking = mockBooking({ stellarTxHash: 'tx-hash-123' });
      mockManager.findOne.mockResolvedValue(booking);
      mockManager.save.mockResolvedValue({ ...booking, status: BookingStatus.CONFIRMED });

      const result = await service.confirm('booking-1');
      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockStellarService.verifyTransaction).not.toHaveBeenCalled();
      expect(mockOutboxService.create).toHaveBeenCalled();
    });

    it('throws 404 when booking not found', async () => {
      mockManager.findOne.mockResolvedValue(null);
      await expect(service.confirm('unknown')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when booking is not pending', async () => {
      mockManager.findOne.mockResolvedValue(mockBooking({ status: BookingStatus.CONFIRMED }));
      await expect(service.confirm('booking-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── cancel (single booking) ────────────────────────────────────────────────

  describe('cancel', () => {
    it('allows owner to cancel own booking and stores refundAmount', async () => {
      const booking = mockBooking();
      mockBookingRepo.findOne.mockResolvedValue(booking);
      mockCancellationPolicyService.evaluateRefund.mockResolvedValue({
        refundAmount: 20,
        refundPercent: 100,
        reason: 'Full refund',
      });
      mockBookingRepo.save.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
        refundAmount: 20,
      });

      const result = await service.cancel('booking-1', 'user-1');
      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(result.refundAmount).toBe(20);
    });

    it('stores refundAmount = 0 when no refund applies', async () => {
      const booking = mockBooking();
      mockBookingRepo.findOne.mockResolvedValue(booking);
      mockCancellationPolicyService.evaluateRefund.mockResolvedValue({
        refundAmount: 0,
        refundPercent: 0,
        reason: 'No refund',
      });
      mockBookingRepo.save.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
        refundAmount: 0,
      });

      const result = await service.cancel('booking-1', 'user-1');
      expect(result.refundAmount).toBe(0);
    });

    it('throws 403 when non-owner tries to cancel', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking({ userId: 'user-1' }));
      await expect(service.cancel('booking-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 404 when booking not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('unknown', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── cancelSeries ───────────────────────────────────────────────────────────

  describe('cancelSeries', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);   // 1 week ago
    const future1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
    const future2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now

    const seriesId = 'series-uuid';

    const pastInstance = mockBooking({
      id: 'b-past',
      startTime: past,
      endTime: new Date(past.getTime() + 3600000),
      seriesId,
      instanceIndex: 0,
      status: BookingStatus.CONFIRMED,
    });

    const futureInstance1 = mockBooking({
      id: 'b-future-1',
      startTime: future1,
      endTime: new Date(future1.getTime() + 3600000),
      seriesId,
      instanceIndex: 1,
      status: BookingStatus.PENDING,
    });

    const futureInstance2 = mockBooking({
      id: 'b-future-2',
      startTime: future2,
      endTime: new Date(future2.getTime() + 3600000),
      seriesId,
      instanceIndex: 2,
      status: BookingStatus.PENDING,
    });

    it('cancels future instances and preserves past instances', async () => {
      mockBookingRepo.find
        .mockResolvedValueOnce([pastInstance, futureInstance1, futureInstance2]) // all instances
        .mockResolvedValueOnce({ ...futureInstance1, workspace: mockWorkspace }) // findOne for future1
        .mockResolvedValueOnce({ ...futureInstance2, workspace: mockWorkspace }); // findOne for future2

      mockBookingRepo.findOne
        .mockResolvedValueOnce({ ...futureInstance1, workspace: mockWorkspace })
        .mockResolvedValueOnce({ ...futureInstance2, workspace: mockWorkspace });

      mockCancellationPolicyService.evaluateRefund.mockResolvedValue({
        refundAmount: 10,
        refundPercent: 100,
        reason: 'Full refund',
      });

      mockBookingRepo.save.mockResolvedValue([]);

      const result = await service.cancelSeries(seriesId, 'user-1');

      expect(result.cancelledCount).toBe(2);
      expect(result.preservedCount).toBe(1);
    });

    it('preserves already-cancelled future instances', async () => {
      const alreadyCancelled = mockBooking({
        id: 'b-already-cancelled',
        startTime: future1,
        endTime: new Date(future1.getTime() + 3600000),
        seriesId,
        instanceIndex: 1,
        status: BookingStatus.CANCELLED,
      });

      mockBookingRepo.find.mockResolvedValueOnce([pastInstance, alreadyCancelled]);
      mockBookingRepo.save.mockResolvedValue([]);

      const result = await service.cancelSeries(seriesId, 'user-1');

      // alreadyCancelled is future but already CANCELLED — not re-cancelled
      expect(result.cancelledCount).toBe(0);
    });

    it('throws 404 when series does not exist', async () => {
      mockBookingRepo.find.mockResolvedValueOnce([]);
      await expect(service.cancelSeries('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 403 when non-owner tries to cancel series', async () => {
      mockBookingRepo.find.mockResolvedValueOnce([
        mockBooking({ seriesId, userId: 'user-1' }),
      ]);
      await expect(service.cancelSeries(seriesId, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
