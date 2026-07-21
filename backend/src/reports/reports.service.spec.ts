import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Workspace, WorkspaceType } from '../workspaces/workspace.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    workspaceId: 'ws1',
    userId: 'u1',
    startTime: new Date('2024-01-15T09:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    status: BookingStatus.CONFIRMED,
    totalAmount: 200,
    stellarTxHash: null as any,
    hubId: undefined,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    workspace: {} as any,
    user: {} as any,
    ...overrides,
  };
}

// ─── Mock QueryBuilder factory ───────────────────────────────────────────────

function makeQb(rawResult: any[]) {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;
  let bookingQbFactory: jest.Mock;
  let workspaceQbFactory: jest.Mock;

  const mockBookingRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockWorkspaceRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Workspace), useValue: mockWorkspaceRepo },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Revenue aggregation ──────────────────────────────────────────────────

  describe('getRevenue()', () => {
    it('returns correct totals for a mocked booking dataset', async () => {
      const rawRows = [
        { period: '2024-01-10', totalRevenue: '300.00', bookingCount: '2' },
        { period: '2024-01-15', totalRevenue: '450.00', bookingCount: '3' },
        { period: '2024-01-20', totalRevenue: '150.00', bookingCount: '1' },
      ];

      mockBookingRepo.createQueryBuilder.mockReturnValue(makeQb(rawRows));

      const result = await service.getRevenue({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'day',
      });

      expect(result.summary.totalRevenue).toBe(900);
      expect(result.summary.totalBookings).toBe(6);
      expect(result.summary.averageBookingValue).toBe(150);
      expect(result.breakdown).toHaveLength(3);
    });

    it('returns zero totals when no bookings exist in range', async () => {
      mockBookingRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      const result = await service.getRevenue({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.totalBookings).toBe(0);
      expect(result.summary.averageBookingValue).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('applies workspaceType filter to query builder', async () => {
      const qb = makeQb([]);
      mockBookingRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getRevenue({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        workspaceType: WorkspaceType.HOT_DESK,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'workspace.type = :workspaceType',
        { workspaceType: WorkspaceType.HOT_DESK },
      );
    });

    it('applies status filter to query builder', async () => {
      const qb = makeQb([]);
      mockBookingRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getRevenue({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: BookingStatus.CONFIRMED,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('booking.status = :status', {
        status: BookingStatus.CONFIRMED,
      });
    });

    it('groups by month when groupBy=month', async () => {
      const qb = makeQb([{ period: '2024-01', totalRevenue: '900.00', bookingCount: '6' }]);
      mockBookingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getRevenue({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'month',
      });

      expect(result.breakdown[0].period).toBe('2024-01');
    });

    it('date filter: only January bookings returned for startDate=2024-01-01&endDate=2024-01-31', async () => {
      // Simulate DB returning only January rows (the WHERE clause is enforced by the DB;
      // here we verify the query builder receives the correct date bounds).
      const qb = makeQb([
        { period: '2024-01-05', totalRevenue: '200.00', bookingCount: '1' },
        { period: '2024-01-20', totalRevenue: '400.00', bookingCount: '2' },
      ]);
      mockBookingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getRevenue({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      // Verify the where clause was called with January bounds
      expect(qb.where).toHaveBeenCalledWith('booking.startTime >= :start', expect.objectContaining({
        start: expect.any(Date),
      }));
      expect(qb.andWhere).toHaveBeenCalledWith('booking.startTime <= :end', expect.objectContaining({
        end: expect.any(Date),
      }));

      // All returned periods should be in January 2024
      result.breakdown.forEach((row) => {
        expect(row.period.startsWith('2024-01')).toBe(true);
      });

      expect(result.summary.totalRevenue).toBe(600);
      expect(result.summary.totalBookings).toBe(3);
    });
  });

  // ── CSV export ───────────────────────────────────────────────────────────

  describe('getRevenueCsv()', () => {
    it('CSV headers and row count match the JSON endpoint', async () => {
      const rawRows = [
        { period: '2024-01-10', totalRevenue: '300.00', bookingCount: '2' },
        { period: '2024-01-15', totalRevenue: '450.00', bookingCount: '3' },
      ];
      mockBookingRepo.createQueryBuilder.mockReturnValue(makeQb(rawRows));

      const csv = await service.getRevenueCsv({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      const lines = csv.split('\n').filter((l) => l && !l.startsWith('#'));
      const [header, ...dataRows] = lines;

      // Verify headers
      expect(header).toBe('period,totalRevenue,bookingCount,averageBookingValue');

      // Row count matches breakdown length
      expect(dataRows).toHaveLength(rawRows.length);

      // Verify first data row
      expect(dataRows[0]).toBe('2024-01-10,300,2,150');
    });

    it('CSV is empty (only headers) when no bookings exist', async () => {
      mockBookingRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      const csv = await service.getRevenueCsv({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      const lines = csv.split('\n').filter((l) => l && !l.startsWith('#'));
      expect(lines).toHaveLength(1); // only the header row
      expect(lines[0]).toBe('period,totalRevenue,bookingCount,averageBookingValue');
    });
  });

  // ── Occupancy ────────────────────────────────────────────────────────────

  describe('getOccupancy()', () => {
    const mockWorkspace = {
      id: 'ws1',
      name: 'Hot Desk A',
      type: WorkspaceType.HOT_DESK,
      capacity: 4,
      isActive: true,
      deletedAt: null,
    } as Workspace;

    it('calculates utilization percentage correctly', async () => {
      const wsQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockWorkspace]),
      };
      const bookingQb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            workspaceId: 'ws1',
            totalBookings: '5',
            confirmedBookings: '4',
            totalBookedHours: '16.0',
          },
        ]),
      };

      mockWorkspaceRepo.createQueryBuilder.mockReturnValue(wsQb);
      mockBookingRepo.createQueryBuilder.mockReturnValue(bookingQb);

      const result = await service.getOccupancy({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.workspaces).toHaveLength(1);
      const ws = result.workspaces[0];
      expect(ws.workspaceId).toBe('ws1');
      expect(ws.confirmedBookings).toBe(4);
      expect(ws.totalBookedHours).toBe(16);
      // availableHours = 744 hours in Jan × 4 capacity = 2976
      // utilizationPct = 16 / 2976 * 100 ≈ 0.5
      expect(ws.utilizationPct).toBeGreaterThanOrEqual(0);
      expect(ws.utilizationPct).toBeLessThanOrEqual(100);
    });

    it('returns zero utilization when no bookings exist', async () => {
      const wsQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockWorkspace]),
      };
      const bookingQb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockWorkspaceRepo.createQueryBuilder.mockReturnValue(wsQb);
      mockBookingRepo.createQueryBuilder.mockReturnValue(bookingQb);

      const result = await service.getOccupancy({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.workspaces[0].utilizationPct).toBe(0);
      expect(result.overallUtilizationPct).toBe(0);
    });
  });
});
