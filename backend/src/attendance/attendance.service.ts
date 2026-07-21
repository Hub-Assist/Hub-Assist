import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { Attendance, AttendanceAction } from './attendance.entity';
import { ClockInDto, ClockOutDto, AttendanceSummaryQueryDto, isValidIANAZone } from './attendance.dto';
import { CursorPaginationQueryDto } from '../common/pagination/dto/cursor-pagination-query.dto';
import { encodeCursor, decodeCursor } from '../common/pagination/utils/cursor.util';

const ANOMALY_SHORT_SECONDS = 5 * 60;
const ANOMALY_LONG_SECONDS  = 14 * 60 * 60;

export type AnomalyFlag = 'short' | 'long' | null;

export interface SessionSummary {
  sessionId: string;
  userId: string;
  clockInUtc: Date;
  clockOutUtc: Date;
  durationSeconds: number;
  anomaly: AnomalyFlag;
}

export interface BucketEntry {
  bucket: string;
  sessions: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  anomalies: { short: number; long: number };
}

export interface AttendanceSummaryResult {
  timezone: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  peakArrivalHour: number | null;
  peakDepartureHour: number | null;
  buckets: BucketEntry[];
  anomalies: SessionSummary[];
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
  ) {}

  // ── Clock-in ──────────────────────────────────────────────────────────────

  async clockIn(userId: string, dto: ClockInDto) {
    const openSession = await this.attendanceRepository.findOne({
      where: { userId, action: AttendanceAction.CLOCK_IN },
      order: { timestamp: 'DESC' },
    });

    if (openSession) {
      const hasClockOut = await this.attendanceRepository.findOne({
        where: {
          userId,
          sessionId: openSession.sessionId,
          action: AttendanceAction.CLOCK_OUT,
        },
      });

      if (!hasClockOut) {
        throw new BadRequestException('User already clocked in. Please clock out first.');
      }
    }

    const sessionId = uuidv4();
    const attendance = this.attendanceRepository.create({
      userId,
      action: AttendanceAction.CLOCK_IN,
      sessionId,
      details: dto.details,
    });

    await this.attendanceRepository.save(attendance);
    return { sessionId, message: 'Clocked in successfully', timestamp: attendance.timestamp };
  }

  // ── Clock-out ─────────────────────────────────────────────────────────────

  async clockOut(userId: string, dto: ClockOutDto) {
    const openSession = await this.attendanceRepository.findOne({
      where: { userId, action: AttendanceAction.CLOCK_IN },
      order: { timestamp: 'DESC' },
    });

    if (!openSession) {
      throw new BadRequestException('No active session. Please clock in first.');
    }

    const existingClockOut = await this.attendanceRepository.findOne({
      where: {
        userId,
        sessionId: openSession.sessionId,
        action: AttendanceAction.CLOCK_OUT,
      },
    });

    if (existingClockOut) {
      throw new BadRequestException('Already clocked out for this session.');
    }

    const attendance = this.attendanceRepository.create({
      userId,
      action: AttendanceAction.CLOCK_OUT,
      sessionId: openSession.sessionId,
      details: dto.details,
    });

    await this.attendanceRepository.save(attendance);

    const duration = Math.floor(
      (attendance.timestamp.getTime() - openSession.timestamp.getTime()) / 1000,
    );

    return {
      sessionId: openSession.sessionId,
      message: 'Clocked out successfully',
      timestamp: attendance.timestamp,
      sessionDuration: duration,
    };
  }

  // ── My attendance (cursor-paginated) ─────────────────────────────────────

  async getMyAttendance(userId: string, query: CursorPaginationQueryDto) {
    const limit = query.limit ?? 20;

    if (query.cursor) {
      let cursorPayload: { timestamp: string; id: string };
      try {
        cursorPayload = decodeCursor(query.cursor);
      } catch {
        throw new BadRequestException('Invalid cursor token');
      }

      const records = await this.attendanceRepository
        .createQueryBuilder('a')
        .where('a.userId = :userId', { userId })
        .andWhere(
          '(a.timestamp < :ts OR (a.timestamp = :ts AND a.id < :id))',
          { ts: new Date(cursorPayload.timestamp), id: cursorPayload.id },
        )
        .orderBy('a.timestamp', 'DESC')
        .addOrderBy('a.id', 'DESC')
        .take(limit + 1)
        .getMany();

      const hasMore = records.length > limit;
      const data = hasMore ? records.slice(0, limit) : records;
      const nextCursor = hasMore && data.length > 0
        ? encodeCursor({ timestamp: data[data.length - 1].timestamp.toISOString(), id: data[data.length - 1].id })
        : null;

      return { data, nextCursor, hasMore };
    }

    const records = await this.attendanceRepository.find({
      where: { userId },
      order: { timestamp: 'DESC', id: 'DESC' },
      take: limit + 1,
    });

    const hasMore = records.length > limit;
    const data = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ timestamp: data[data.length - 1].timestamp.toISOString(), id: data[data.length - 1].id })
      : null;

    return { data, nextCursor, hasMore };
  }

  // ── User attendance (admin, paginated) ────────────────────────────────────

  async getUserAttendance(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [records, total] = await this.attendanceRepository.findAndCount({
      where: { userId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    return { records, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Attendance summary (timezone-aware) ───────────────────────────────────

  async getAttendanceSummary(query: AttendanceSummaryQueryDto = {}): Promise<AttendanceSummaryResult> {
    const timezone = query.timezone ?? 'UTC';
    const period   = query.period   ?? 'daily';

    // Validate IANA timezone
    if (!isValidIANAZone(timezone)) {
      throw new BadRequestException(
        `Invalid timezone "${timezone}". Must be a valid IANA timezone name (e.g. "America/New_York").`,
      );
    }

    // Resolve window boundaries in the requested timezone, then convert to UTC
    // for the DB query so we don't miss records near midnight.
    const windowEnd = query.endDate
      ? DateTime.fromISO(query.endDate, { zone: timezone })
      : DateTime.now().setZone(timezone);

    const windowStart = query.startDate
      ? DateTime.fromISO(query.startDate, { zone: timezone })
      : windowEnd.minus({ days: 30 });

    const records = await this.attendanceRepository.find({
      where: {},
      relations: ['user'],
      order: { timestamp: 'ASC' },
    });

    // ── Pair clock-in / clock-out into sessions ───────────────────────────
    const sessionMap = new Map<string, { clockIn: Attendance; clockOut?: Attendance }>();

    for (const record of records) {
      if (!record.sessionId) continue;

      if (record.action === AttendanceAction.CLOCK_IN) {
        if (!sessionMap.has(record.sessionId)) {
          sessionMap.set(record.sessionId, { clockIn: record });
        }
      } else if (record.action === AttendanceAction.CLOCK_OUT) {
        const session = sessionMap.get(record.sessionId);
        if (session) session.clockOut = record;
      }
    }

    // ── Filter to window and build SessionSummary list ────────────────────
    const sessions: SessionSummary[] = [];

    for (const { clockIn, clockOut } of sessionMap.values()) {
      if (!clockOut) continue; // incomplete session — skip

      // Convert clock-in timestamp to the requested timezone for bucketing
      const clockInLocal = DateTime.fromJSDate(clockIn.timestamp).setZone(timezone);

      // Filter: only include sessions whose clock-in falls within the window
      if (clockInLocal < windowStart || clockInLocal > windowEnd) continue;

      const durationSeconds = Math.floor(
        (clockOut.timestamp.getTime() - clockIn.timestamp.getTime()) / 1000,
      );

      let anomaly: AnomalyFlag = null;
      if (durationSeconds < ANOMALY_SHORT_SECONDS) anomaly = 'short';
      else if (durationSeconds > ANOMALY_LONG_SECONDS) anomaly = 'long';

      sessions.push({
        sessionId: clockIn.sessionId!,
        userId: clockIn.userId,
        clockInUtc: clockIn.timestamp,
        clockOutUtc: clockOut.timestamp,
        durationSeconds,
        anomaly,
      });
    }

    // ── Aggregate into buckets ────────────────────────────────────────────
    const bucketMap = new Map<string, BucketEntry>();

    for (const session of sessions) {
      const clockInLocal = DateTime.fromJSDate(session.clockInUtc).setZone(timezone);
      const bucket = this.toBucketKey(clockInLocal, period);

      if (!bucketMap.has(bucket)) {
        bucketMap.set(bucket, {
          bucket,
          sessions: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
          anomalies: { short: 0, long: 0 },
        });
      }

      const entry = bucketMap.get(bucket)!;
      entry.sessions++;
      entry.totalDurationSeconds += session.durationSeconds;
      if (session.anomaly === 'short') entry.anomalies.short++;
      if (session.anomaly === 'long')  entry.anomalies.long++;
    }

    // Compute averages and sort buckets chronologically
    const buckets: BucketEntry[] = Array.from(bucketMap.values())
      .map((b) => ({
        ...b,
        avgDurationSeconds: b.sessions > 0 ? Math.floor(b.totalDurationSeconds / b.sessions) : 0,
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    // ── Peak arrival / departure hours (in user timezone) ─────────────────
    const arrivalHours  = new Map<number, number>();
    const departureHours = new Map<number, number>();

    for (const session of sessions) {
      const arrHour  = DateTime.fromJSDate(session.clockInUtc).setZone(timezone).hour;
      const depHour  = DateTime.fromJSDate(session.clockOutUtc).setZone(timezone).hour;
      arrivalHours.set(arrHour,   (arrivalHours.get(arrHour)   ?? 0) + 1);
      departureHours.set(depHour, (departureHours.get(depHour) ?? 0) + 1);
    }

    const peakArrivalHour   = this.peakHour(arrivalHours);
    const peakDepartureHour = this.peakHour(departureHours);

    // ── Totals ────────────────────────────────────────────────────────────
    const totalSessions       = sessions.length;
    const totalDurationSeconds = sessions.reduce((s, r) => s + r.durationSeconds, 0);
    const avgDurationSeconds  = totalSessions > 0
      ? Math.floor(totalDurationSeconds / totalSessions)
      : 0;

    return {
      timezone,
      period,
      startDate: windowStart.toISO()!,
      endDate:   windowEnd.toISO()!,
      totalSessions,
      totalDurationSeconds,
      avgDurationSeconds,
      peakArrivalHour,
      peakDepartureHour,
      buckets,
      anomalies: sessions.filter((s) => s.anomaly !== null),
    };
  }

  async getAllAttendance(
    page: number = 1,
    limit: number = 20,
    filters?: { userId?: string; action?: AttendanceAction; startDate?: Date; endDate?: Date },
  ) {
    const skip = (page - 1) * limit;
    const query = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.user', 'user')
      .orderBy('attendance.timestamp', 'DESC');

    if (filters?.userId) {
      query.andWhere('attendance.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query.andWhere('attendance.action = :action', { action: filters.action });
    }

    if (filters?.startDate) {
      query.andWhere('attendance.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('attendance.timestamp <= :endDate', { endDate: filters.endDate });
    }

    const [records, total] = await query.skip(skip).take(limit).getManyAndCount();

    return { records, total, page, limit, pages: Math.ceil(total / limit) };
  }

  private toBucketKey(dt: DateTime, period: 'daily' | 'weekly' | 'monthly'): string {
    switch (period) {
      case 'daily': return dt.toISODate()!;
      case 'weekly': return `${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`;
      case 'monthly': return `${dt.year}-${String(dt.month).padStart(2, '0')}`;
    }
  }

  private peakHour(hourMap: Map<number, number>): number | null {
    if (hourMap.size === 0) return null;
    let peak = -1, max = -1;
    for (const [hour, count] of hourMap) {
      if (count > max) { max = count; peak = hour; }
    }
    return peak;
  }
}
