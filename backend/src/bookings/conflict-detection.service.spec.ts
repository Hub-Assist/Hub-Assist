import { Test, TestingModule } from '@nestjs/testing';
import { ConflictDetectionService } from './conflict-detection.service';
import { EntityManager } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { Booking, BookingStatus } from './booking.entity';

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConflictDetectionService],
    }).compile();

    service = module.get<ConflictDetectionService>(ConflictDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const runWithMocks = async (
    workspaceCapacity: number,
    existingBookings: any[],
    newStart: Date,
    newEnd: Date,
    existingMaintenance: any[] = []
  ) => {
    const mockManager = {
      findOne: jest.fn().mockResolvedValue({ id: 'ws-1', capacity: workspaceCapacity }),
      createQueryBuilder: jest.fn((entity) => {
        if (entity.name === 'MaintenanceWindow') {
          return {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(existingMaintenance.length > 0 ? existingMaintenance[0] : null),
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue(existingBookings),
        };
      }),
    } as unknown as EntityManager;

    return service.hasConflict(mockManager, 'ws-1', newStart, newEnd);
  };

  describe('overlap permutations', () => {
    const baseStart = new Date('2025-01-01T10:00:00Z');
    const baseEnd = new Date('2025-01-01T12:00:00Z');

    const existingBooking = {
      id: 'existing-1',
      startTime: baseStart,
      endTime: baseEnd,
      status: BookingStatus.CONFIRMED,
    };

    // 1. Touching before (ends exactly when existing starts)
    it('1. Touching before (ends exactly when existing starts) - NO conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T08:00:00Z'), baseStart);
      expect(result).toBeNull();
    });

    // 2. Touching after (starts exactly when existing ends)
    it('2. Touching after (starts exactly when existing ends) - NO conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], baseEnd, new Date('2025-01-01T14:00:00Z'));
      expect(result).toBeNull();
    });

    // 3. Before (ends before existing starts)
    it('3. Before (ends before existing starts) - NO conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T08:00:00Z'), new Date('2025-01-01T09:00:00Z'));
      expect(result).toBeNull();
    });

    // 4. After (starts after existing ends)
    it('4. After (starts after existing ends) - NO conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T13:00:00Z'), new Date('2025-01-01T14:00:00Z'));
      expect(result).toBeNull();
    });

    // 5. Contains (new entirely contains existing)
    it('5. Contains (new entirely contains existing) - Conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T09:00:00Z'), new Date('2025-01-01T13:00:00Z'));
      expect(result).not.toBeNull();
      expect(result?.reason).toBe('Capacity Exceeded');
    });

    // 6. Contained by (new is entirely within existing)
    it('6. Contained by (new is entirely within existing) - Conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T10:30:00Z'), new Date('2025-01-01T11:30:00Z'));
      expect(result).not.toBeNull();
    });

    // 7. Overlaps left (new starts before existing, ends inside existing)
    it('7. Overlaps left (new starts before existing, ends inside existing) - Conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T09:00:00Z'), new Date('2025-01-01T11:00:00Z'));
      expect(result).not.toBeNull();
    });

    // 8. Overlaps right (new starts inside existing, ends after existing)
    it('8. Overlaps right (new starts inside existing, ends after existing) - Conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], new Date('2025-01-01T11:00:00Z'), new Date('2025-01-01T13:00:00Z'));
      expect(result).not.toBeNull();
    });

    // 9. Exact match (new start and end equal existing start and end)
    it('9. Exact match (new start and end equal existing start and end) - Conflict', async () => {
      const result = await runWithMocks(1, [existingBooking], baseStart, baseEnd);
      expect(result).not.toBeNull();
    });

    // 10. Multi-booking touching (starts exactly when existing1 ends and ends exactly when existing2 starts)
    it('10. Multi-booking touching - NO conflict', async () => {
      const existing1 = { id: 'ex-1', startTime: new Date('2025-01-01T08:00:00Z'), endTime: new Date('2025-01-01T09:00:00Z') };
      const existing2 = { id: 'ex-2', startTime: new Date('2025-01-01T10:00:00Z'), endTime: new Date('2025-01-01T11:00:00Z') };
      const result = await runWithMocks(1, [existing1, existing2], new Date('2025-01-01T09:00:00Z'), new Date('2025-01-01T10:00:00Z'));
      expect(result).toBeNull();
    });

    // 11. Capacity > 1 overlap (workspace capacity is 2, existing bookings is 1)
    it('11. Capacity > 1 allows overlap if concurrent < capacity - NO conflict', async () => {
      const result = await runWithMocks(2, [existingBooking], baseStart, baseEnd);
      expect(result).toBeNull();
    });

    // 12. Maintenance window overlap
    it('12. Overlaps with maintenance window - Conflict', async () => {
      const mw = { startTime: new Date('2025-01-01T10:30:00Z'), endTime: new Date('2025-01-01T11:30:00Z') };
      const result = await runWithMocks(1, [], baseStart, baseEnd, [mw]);
      expect(result).not.toBeNull();
      expect(result?.reason).toBe('Maintenance Window');
    });
  });
});
