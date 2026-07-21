import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Attendance, AttendanceAction } from './attendance.entity';
import { encodeCursor, decodeCursor } from '../common/pagination/utils/cursor.util';

const makeRecord = (
  overrides: Partial<Attendance> & { timestamp?: Date } = {},
): Attendance =>
  ({
    id: 'rec-' + Math.random().toString(36).slice(2),
    userId: 'user-1',
    sessionId: 'sess-1',
    action: AttendanceAction.CLOCK_IN,
    timestamp: new Date('2024-06-01T10:00:00.000Z'),
    details: undefined,
    hubId: undefined,
    user: {} as any,
    ...overrides,
  }) as Attendance;

const makePair = (
  sessionId: string,
  userId: string,
  clockInDate: Date,
  clockOutDate: Date,
): [Attendance, Attendance] => [
  makeRecord({ sessionId, userId, action: AttendanceAction.CLOCK_IN,  timestamp: clockInDate }),
  makeRecord({ sessionId, userId, action: AttendanceAction.CLOCK_OUT, timestamp: clockOutDate }),
];

const makeRepo = () => ({
  findOne:        jest.fn(),
  find:           jest.fn(),
  findAndCount:   jest.fn(),
  create:         jest.fn((data: any) => ({ ...data, timestamp: new Date() })),
  save:           jest.fn((entity: any) => Promise.resolve(entity)),
  createQueryBuilder: jest.fn(),
});

describe('AttendanceService', () => {
  let service: AttendanceService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Attendance), useValue: repo },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  // ── clockIn ───────────────────────────────────────────────────────────────

  describe('clockIn', () => {
    it('creates a new session when no open session exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const saved = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_IN });
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      const result = await service.clockIn('user-1', {});
      expect(result.sessionId).toBeDefined();
      expect(result.message).toBe('Clocked in successfully');
    });

    it('throws when user already has an open session', async () => {
      const openIn = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_IN });
      repo.findOne
        .mockResolvedValueOnce(openIn)   // open clock-in found
        .mockResolvedValueOnce(null);    // no matching clock-out

      await expect(service.clockIn('user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('allows clock-in when previous session is properly closed', async () => {
      const openIn  = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_IN });
      const clockOut = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_OUT });
      repo.findOne
        .mockResolvedValueOnce(openIn)    // last clock-in
        .mockResolvedValueOnce(clockOut); // matching clock-out exists

      const saved = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_IN });
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      await expect(service.clockIn('user-1', {})).resolves.toBeDefined();
    });
  });

  // ── clockOut ──────────────────────────────────────────────────────────────

  describe('clockOut', () => {
    it('records clock-out and returns session duration', async () => {
      const clockInTime  = new Date('2026-05-30T09:00:00Z');
      const clockOutTime = new Date('2026-05-30T17:00:00Z');
      const openIn = makeRecord({ timestamp: clockInTime, action: AttendanceAction.CLOCK_IN });

      repo.findOne
        .mockResolvedValueOnce(openIn)  // open session
        .mockResolvedValueOnce(null);   // no existing clock-out

      const saved = makeRecord({ timestamp: clockOutTime, action: AttendanceAction.CLOCK_OUT });
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      const result = await service.clockOut('user-1', {});
      expect(result.sessionDuration).toBe(8 * 3600); // 8 hours in seconds
    });

    it('throws when no active session', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.clockOut('user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws when already clocked out', async () => {
      const openIn   = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_IN });
      const existing = makeRecord({ timestamp: new Date(), action: AttendanceAction.CLOCK_OUT });
      repo.findOne
        .mockResolvedValueOnce(openIn)
        .mockResolvedValueOnce(existing);

      await expect(service.clockOut('user-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  // ── getAttendanceSummary — timezone bucketing ─────────────────────────────

  describe('getAttendanceSummary — timezone bucketing', () => {
    it('rejects an invalid IANA timezone', async () => {
      repo.find.mockResolvedValue([]);
      await expect(
        service.getAttendanceSummary({ timezone: 'Not/AZone' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('buckets a session into the correct calendar day in the user timezone', async () => {
      // Clock-in at 23:50 UTC — in America/New_York (UTC-5) that is 18:50 on the PREVIOUS day
      const clockInUtc  = new Date('2026-05-30T23:50:00Z'); // 2026-05-30 in UTC
      const clockOutUtc = new Date('2026-05-31T00:30:00Z'); // 40-min session

      const [ci, co] = makePair('s1', 'u1', clockInUtc, clockOutUtc);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary({
        timezone: 'America/New_York',
        period: 'daily',
        startDate: '2026-05-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      // In America/New_York (UTC-5 in May) 23:50 UTC = 18:50 on May 30
      const bucket = result.buckets.find((b) => b.bucket === '2026-05-30');
      expect(bucket).toBeDefined();
      expect(bucket!.sessions).toBe(1);

      // Must NOT appear in May 31 bucket
      const wrongBucket = result.buckets.find((b) => b.bucket === '2026-05-31');
      expect(wrongBucket).toBeUndefined();
    });

    it('buckets the same session into May 31 UTC when timezone is UTC', async () => {
      const clockInUtc  = new Date('2026-05-31T00:10:00Z');
      const clockOutUtc = new Date('2026-05-31T01:00:00Z');

      const [ci, co] = makePair('s2', 'u1', clockInUtc, clockOutUtc);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary({
        timezone: 'UTC',
        period: 'daily',
        startDate: '2026-05-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      const bucket = result.buckets.find((b) => b.bucket === '2026-05-31');
      expect(bucket).toBeDefined();
      expect(bucket!.sessions).toBe(1);
    });

    it('handles DST spring-forward (23-hour day) without under/over counting', async () => {
      // America/New_York springs forward on 2026-03-08: clocks go 02:00 → 03:00
      // That day has only 23 hours. We create one session on that day and verify
      // it is counted exactly once.
      const clockInUtc  = new Date('2026-03-08T12:00:00Z'); // 07:00 EST → 08:00 EDT
      const clockOutUtc = new Date('2026-03-08T20:00:00Z'); // 8-hour session

      const [ci, co] = makePair('dst-1', 'u1', clockInUtc, clockOutUtc);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary({
        timezone: 'America/New_York',
        period: 'daily',
        startDate: '2026-03-01T00:00:00Z',
        endDate:   '2026-03-31T23:59:59Z',
      });

      // Should appear exactly once in the 2026-03-08 bucket
      const bucket = result.buckets.find((b) => b.bucket === '2026-03-08');
      expect(bucket).toBeDefined();
      expect(bucket!.sessions).toBe(1);
      expect(result.totalSessions).toBe(1);
    });

    it('handles DST fall-back (25-hour day) without double-counting', async () => {
      // America/New_York falls back on 2026-11-01: clocks go 02:00 → 01:00
      // That day has 25 hours. Two sessions on that day should count as 2.
      const [ci1, co1] = makePair('fb-1', 'u1',
        new Date('2026-11-01T06:00:00Z'),  // 02:00 EDT (before fallback)
        new Date('2026-11-01T07:00:00Z'),
      );
      const [ci2, co2] = makePair('fb-2', 'u1',
        new Date('2026-11-01T07:30:00Z'),  // 02:30 EST (after fallback — same clock hour)
        new Date('2026-11-01T08:30:00Z'),
      );
      repo.find.mockResolvedValue([ci1, co1, ci2, co2]);

      const result = await service.getAttendanceSummary({
        timezone: 'America/New_York',
        period: 'daily',
        startDate: '2026-11-01T00:00:00Z',
        endDate:   '2026-11-01T23:59:59Z',
      });

      const bucket = result.buckets.find((b) => b.bucket === '2026-11-01');
      expect(bucket).toBeDefined();
      expect(bucket!.sessions).toBe(2);
      expect(result.totalSessions).toBe(2);
    });
  });

  // ── getAttendanceSummary — anomaly detection ──────────────────────────────

  describe('getAttendanceSummary — anomaly detection', () => {
    const window = {
      timezone: 'UTC',
      startDate: '2026-05-01T00:00:00Z',
      endDate:   '2026-06-01T00:00:00Z',
    };

    it('flags sessions under 5 minutes as "short"', async () => {
      const base = new Date('2026-05-15T09:00:00Z');
      const end  = new Date(base.getTime() + 4 * 60 * 1000); // 4 min
      const [ci, co] = makePair('short-1', 'u1', base, end);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary(window);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].anomaly).toBe('short');
    });

    it('does NOT flag a session of exactly 5 minutes', async () => {
      const base = new Date('2026-05-15T09:00:00Z');
      const end  = new Date(base.getTime() + 5 * 60 * 1000); // exactly 5 min
      const [ci, co] = makePair('ok-1', 'u1', base, end);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary(window);
      expect(result.anomalies).toHaveLength(0);
    });

    it('flags sessions over 14 hours as "long"', async () => {
      const base = new Date('2026-05-15T06:00:00Z');
      const end  = new Date(base.getTime() + (14 * 3600 + 1) * 1000); // 14h 1s
      const [ci, co] = makePair('long-1', 'u1', base, end);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary(window);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].anomaly).toBe('long');
    });

    it('does NOT flag a session of exactly 14 hours', async () => {
      const base = new Date('2026-05-15T06:00:00Z');
      const end  = new Date(base.getTime() + 14 * 3600 * 1000); // exactly 14h
      const [ci, co] = makePair('ok-2', 'u1', base, end);
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary(window);
      expect(result.anomalies).toHaveLength(0);
    });

    it('counts anomalies per bucket correctly', async () => {
      const shortPair = makePair('s-a', 'u1',
        new Date('2026-05-15T09:00:00Z'),
        new Date('2026-05-15T09:03:00Z'), // 3 min — short
      );
      const longPair = makePair('l-a', 'u1',
        new Date('2026-05-15T10:00:00Z'),
        new Date('2026-05-16T01:00:00Z'), // 15h — long
      );
      repo.find.mockResolvedValue([...shortPair, ...longPair]);

      const result = await service.getAttendanceSummary(window);
      const bucket = result.buckets.find((b) => b.bucket === '2026-05-15');
      expect(bucket!.anomalies.short).toBe(1);
      expect(bucket!.anomalies.long).toBe(1);
    });
  });

  // ── getAttendanceSummary — peak hours ─────────────────────────────────────

  describe('getAttendanceSummary — peak hours', () => {
    it('returns null peak hours when there are no sessions', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.getAttendanceSummary({ timezone: 'UTC' });
      expect(result.peakArrivalHour).toBeNull();
      expect(result.peakDepartureHour).toBeNull();
    });

    it('identifies the most common clock-in hour as peakArrivalHour', async () => {
      // Three sessions arriving at 09:xx UTC, one at 08:xx
      const pairs = [
        makePair('p1', 'u1', new Date('2026-05-10T09:05:00Z'), new Date('2026-05-10T17:00:00Z')),
        makePair('p2', 'u1', new Date('2026-05-11T09:10:00Z'), new Date('2026-05-11T17:00:00Z')),
        makePair('p3', 'u1', new Date('2026-05-12T09:15:00Z'), new Date('2026-05-12T17:00:00Z')),
        makePair('p4', 'u1', new Date('2026-05-13T08:00:00Z'), new Date('2026-05-13T16:00:00Z')),
      ];
      repo.find.mockResolvedValue(pairs.flat());

      const result = await service.getAttendanceSummary({
        timezone: 'UTC',
        startDate: '2026-05-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      expect(result.peakArrivalHour).toBe(9);
    });

    it('converts peak hours to the requested timezone', async () => {
      // Clock-in at 14:00 UTC = 09:00 in America/Chicago (UTC-5 in May)
      const pairs = [
        makePair('tz1', 'u1', new Date('2026-05-10T14:00:00Z'), new Date('2026-05-10T22:00:00Z')),
        makePair('tz2', 'u1', new Date('2026-05-11T14:30:00Z'), new Date('2026-05-11T22:00:00Z')),
      ];
      repo.find.mockResolvedValue(pairs.flat());

      const result = await service.getAttendanceSummary({
        timezone: 'America/Chicago',
        startDate: '2026-05-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      // 14:00 UTC = 09:00 CDT (UTC-5)
      expect(result.peakArrivalHour).toBe(9);
    });
  });

  // ── getAttendanceSummary — period bucketing ───────────────────────────────

  describe('getAttendanceSummary — period bucketing', () => {
    const sessions = () => {
      const pairs = [
        makePair('w1', 'u1', new Date('2026-05-04T09:00:00Z'), new Date('2026-05-04T17:00:00Z')), // Mon W19
        makePair('w2', 'u1', new Date('2026-05-11T09:00:00Z'), new Date('2026-05-11T17:00:00Z')), // Mon W20
        makePair('w3', 'u1', new Date('2026-05-18T09:00:00Z'), new Date('2026-05-18T17:00:00Z')), // Mon W21
      ];
      return pairs.flat();
    };

    it('produces weekly buckets in ISO week format', async () => {
      repo.find.mockResolvedValue(sessions());

      const result = await service.getAttendanceSummary({
        timezone: 'UTC',
        period: 'weekly',
        startDate: '2026-05-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      const keys = result.buckets.map((b) => b.bucket);
      expect(keys).toContain('2026-W19');
      expect(keys).toContain('2026-W20');
      expect(keys).toContain('2026-W21');
      result.buckets.forEach((b) => expect(b.sessions).toBe(1));
    });

    it('produces monthly buckets', async () => {
      const pairs = [
        makePair('m1', 'u1', new Date('2026-04-15T09:00:00Z'), new Date('2026-04-15T17:00:00Z')),
        makePair('m2', 'u1', new Date('2026-05-15T09:00:00Z'), new Date('2026-05-15T17:00:00Z')),
      ];
      repo.find.mockResolvedValue(pairs.flat());

      const result = await service.getAttendanceSummary({
        timezone: 'UTC',
        period: 'monthly',
        startDate: '2026-04-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      const keys = result.buckets.map((b) => b.bucket);
      expect(keys).toContain('2026-04');
      expect(keys).toContain('2026-05');
    });
  });

  // ── sensitive field safety ────────────────────────────────────────────────

  describe('sensitive field safety', () => {
    it('does not expose password or token fields in summary output', async () => {
      const [ci, co] = makePair('safe-1', 'u1',
        new Date('2026-05-15T09:00:00Z'),
        new Date('2026-05-15T17:00:00Z'),
      );
      // Simulate a record that somehow has sensitive details (should never happen, but guard it)
      (ci as any).details = { password: 'secret', token: 'tok123' };
      repo.find.mockResolvedValue([ci, co]);

      const result = await service.getAttendanceSummary({
        timezone: 'UTC',
        startDate: '2026-05-01T00:00:00Z',
        endDate:   '2026-06-01T00:00:00Z',
      });

      const json = JSON.stringify(result);
      expect(json).not.toContain('secret');
      expect(json).not.toContain('tok123');
    });
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // First page (no cursor)
  // -------------------------------------------------------------------------

  describe('first page (no cursor)', () => {
    it('returns data and null nextCursor when total records ≤ limit', async () => {
      const records = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })];
      repo.find.mockResolvedValue(records);

      const result = await service.getMyAttendance('user-1', { limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it('returns nextCursor and hasMore=true when more records exist', async () => {
      // Service fetches limit+1 to detect hasMore; simulate 21 records for limit=20
      const records = Array.from({ length: 21 }, (_, i) =>
        makeRecord({
          id: `r${i}`,
          timestamp: new Date(`2024-06-01T${String(10 + i).padStart(2, '0')}:00:00.000Z`),
        }),
      );
      repo.find.mockResolvedValue(records);

      const result = await service.getMyAttendance('user-1', { limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();

      // The cursor must decode to the last record on the page (index 19)
      const decoded = decodeCursor(result.nextCursor!);
      expect(decoded.id).toBe(records[19].id);
      expect(decoded.timestamp).toBe(records[19].timestamp.toISOString());
    });

    it('calls find with DESC ordering and take = limit + 1', async () => {
      repo.find.mockResolvedValue([]);
      await service.getMyAttendance('user-1', { limit: 10 });

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          order: { timestamp: 'DESC', id: 'DESC' },
          take: 11,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Subsequent pages (with cursor)
  // -------------------------------------------------------------------------

  describe('subsequent pages (with cursor)', () => {
    function buildQueryBuilder(records: Attendance[]) {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(records),
      };
      return qb;
    }

    it('uses the query builder with the correct compound WHERE predicate', async () => {
      const cursorRecord = makeRecord({
        id: 'cursor-rec',
        timestamp: new Date('2024-06-01T10:00:00.000Z'),
      });
      const cursor = encodeCursor({
        timestamp: cursorRecord.timestamp.toISOString(),
        id: cursorRecord.id,
      });

      const nextPageRecords = [makeRecord({ id: 'next-1' })];
      const qb = buildQueryBuilder(nextPageRecords);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMyAttendance('user-1', { cursor, limit: 20 });

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('a');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(a.timestamp < :ts OR (a.timestamp = :ts AND a.id < :id))',
        expect.objectContaining({ id: cursorRecord.id }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when the page is full', async () => {
      const cursorRecord = makeRecord({ id: 'cursor-rec' });
      const cursor = encodeCursor({
        timestamp: cursorRecord.timestamp.toISOString(),
        id: cursorRecord.id,
      });

      // 21 records returned → hasMore = true
      const nextPageRecords = Array.from({ length: 21 }, (_, i) =>
        makeRecord({
          id: `next-${i}`,
          timestamp: new Date(`2024-05-01T${String(10 + i).padStart(2, '0')}:00:00.000Z`),
        }),
      );
      const qb = buildQueryBuilder(nextPageRecords);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMyAttendance('user-1', { cursor, limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('throws BadRequestException for a malformed cursor', async () => {
      await expect(
        service.getMyAttendance('user-1', { cursor: 'not-a-valid-cursor!!!', limit: 20 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Non-overlapping pages (integration-style)
  // -------------------------------------------------------------------------

  describe('non-overlapping ordered pages', () => {
    it('two consecutive pages do not share any record ids', async () => {
      // Page 1: 20 records + 1 sentinel to signal hasMore
      const page1Records = Array.from({ length: 21 }, (_, i) =>
        makeRecord({
          id: `r${20 - i}`,
          timestamp: new Date(Date.now() - i * 1000),
        }),
      );
      repo.find.mockResolvedValueOnce(page1Records);

      const page1 = await service.getMyAttendance('user-1', { limit: 20 });
      expect(page1.hasMore).toBe(true);

      // Page 2: simulate records that come after the cursor
      const page2Records = Array.from({ length: 5 }, (_, i) =>
        makeRecord({
          id: `r${i}`,
          timestamp: new Date(Date.now() - (21 + i) * 1000),
        }),
      );
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(page2Records),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const page2 = await service.getMyAttendance('user-1', {
        cursor: page1.nextCursor!,
        limit: 20,
      });

      const page1Ids = new Set(page1.data.map((r) => r.id));
      const page2Ids = page2.data.map((r) => r.id);
      const overlap = page2Ids.filter((id) => page1Ids.has(id));

      expect(overlap).toHaveLength(0);
      expect(page2.hasMore).toBe(false);
    });
  });
});
