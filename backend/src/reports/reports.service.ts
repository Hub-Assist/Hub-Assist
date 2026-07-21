import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Workspace, WorkspaceType } from '../workspaces/workspace.entity';
import { RevenueQueryDto, GroupBy } from './dto/revenue-query.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';

export interface RevenuePeriod {
  period: string;
  totalRevenue: number;
  bookingCount: number;
  averageBookingValue: number;
}

export interface RevenueReport {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    averageBookingValue: number;
    startDate: string;
    endDate: string;
  };
  breakdown: RevenuePeriod[];
}

export interface WorkspaceOccupancy {
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  capacity: number;
  totalBookings: number;
  confirmedBookings: number;
  totalBookedHours: number;
  availableHours: number;
  utilizationPct: number;
}

export interface OccupancyReport {
  startDate: string;
  endDate: string;
  workspaces: WorkspaceOccupancy[];
  overallUtilizationPct: number;
}

/** Map groupBy granularity to a Postgres DATE_TRUNC truncation unit. */
function truncUnit(groupBy: GroupBy): string {
  if (groupBy === 'week') return 'week';
  if (groupBy === 'month') return 'month';
  return 'day';
}

/** Format a DATE_TRUNC result label for the response. */
function periodFormat(groupBy: GroupBy): string {
  if (groupBy === 'month') return "YYYY-MM";
  if (groupBy === 'week') return "IYYY-IW"; // ISO year + ISO week number
  return "YYYY-MM-DD";
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  private resolveDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
    const end = endDate ? new Date(endDate) : new Date();
    // Set end to end-of-day so the filter is inclusive
    end.setHours(23, 59, 59, 999);

    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  // ─── revenue ────────────────────────────────────────────────────────────────

  async getRevenue(query: RevenueQueryDto): Promise<RevenueReport> {
    const { start, end } = this.resolveDateRange(query.startDate, query.endDate);
    const groupBy: GroupBy = query.groupBy ?? 'day';
    const trunc = truncUnit(groupBy);
    const fmt = periodFormat(groupBy);

    // Build the aggregation query using DB-level GROUP BY + SUM.
    // The startTime index (idx_bookings_workspaceid_starttime_endtime) covers
    // the date-range predicate, avoiding full table scans.
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.workspace', 'workspace')
      .select(`TO_CHAR(DATE_TRUNC('${trunc}', booking.startTime), '${fmt}')`, 'period')
      .addSelect('SUM(booking.totalAmount)', 'totalRevenue')
      .addSelect('COUNT(booking.id)', 'bookingCount')
      .where('booking.startTime >= :start', { start })
      .andWhere('booking.startTime <= :end', { end })
      .groupBy(`DATE_TRUNC('${trunc}', booking.startTime)`)
      .orderBy(`DATE_TRUNC('${trunc}', booking.startTime)`, 'ASC');

    if (query.workspaceType) {
      qb.andWhere('workspace.type = :workspaceType', { workspaceType: query.workspaceType });
    }

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    const rows = await qb.getRawMany();

    const breakdown: RevenuePeriod[] = rows.map((r) => {
      const revenue = parseFloat(r.totalRevenue) || 0;
      const count = parseInt(r.bookingCount, 10) || 0;
      return {
        period: r.period,
        totalRevenue: revenue,
        bookingCount: count,
        averageBookingValue: count > 0 ? parseFloat((revenue / count).toFixed(2)) : 0,
      };
    });

    const totalRevenue = breakdown.reduce((sum, r) => sum + r.totalRevenue, 0);
    const totalBookings = breakdown.reduce((sum, r) => sum + r.bookingCount, 0);

    return {
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalBookings,
        averageBookingValue:
          totalBookings > 0 ? parseFloat((totalRevenue / totalBookings).toFixed(2)) : 0,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      },
      breakdown,
    };
  }

  // ─── CSV export ─────────────────────────────────────────────────────────────

  async getRevenueCsv(query: RevenueQueryDto): Promise<string> {
    const report = await this.getRevenue(query);

    const header = 'period,totalRevenue,bookingCount,averageBookingValue';
    const rows = report.breakdown.map(
      (r) => `${r.period},${r.totalRevenue},${r.bookingCount},${r.averageBookingValue}`,
    );

    // Prepend summary rows for context
    const summaryRows = [
      `# Revenue Report: ${report.summary.startDate} to ${report.summary.endDate}`,
      `# Total Revenue: ${report.summary.totalRevenue}`,
      `# Total Bookings: ${report.summary.totalBookings}`,
      `# Average Booking Value: ${report.summary.averageBookingValue}`,
      '',
    ];

    return [...summaryRows, header, ...rows].join('\n');
  }

  // ─── occupancy ──────────────────────────────────────────────────────────────

  async getOccupancy(query: OccupancyQueryDto): Promise<OccupancyReport> {
    const { start, end } = this.resolveDateRange(query.startDate, query.endDate);

    // Total hours in the period (used to compute available hours per workspace)
    const periodHours =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;

    const wsQb = this.workspaceRepo
      .createQueryBuilder('workspace')
      .where('workspace.isActive = true')
      .andWhere('workspace.deletedAt IS NULL');

    if (query.workspaceType) {
      wsQb.andWhere('workspace.type = :workspaceType', { workspaceType: query.workspaceType });
    }

    const workspaces = await wsQb.getMany();

    // Aggregate bookings per workspace in a single query
    const bookingQb = this.bookingRepo
      .createQueryBuilder('booking')
      .select('booking.workspaceId', 'workspaceId')
      .addSelect('COUNT(booking.id)', 'totalBookings')
      .addSelect(
        `SUM(CASE WHEN booking.status = '${BookingStatus.CONFIRMED}' THEN 1 ELSE 0 END)`,
        'confirmedBookings',
      )
      .addSelect(
        `SUM(CASE WHEN booking.status = '${BookingStatus.CONFIRMED}' THEN EXTRACT(EPOCH FROM (booking.endTime - booking.startTime)) / 3600 ELSE 0 END)`,
        'totalBookedHours',
      )
      .where('booking.startTime >= :start', { start })
      .andWhere('booking.startTime <= :end', { end })
      .groupBy('booking.workspaceId');

    if (workspaces.length > 0) {
      bookingQb.andWhere('booking.workspaceId IN (:...wsIds)', {
        wsIds: workspaces.map((w) => w.id),
      });
    }

    const bookingStats = await bookingQb.getRawMany();
    const statsMap = new Map(bookingStats.map((s) => [s.workspaceId, s]));

    const wsOccupancy: WorkspaceOccupancy[] = workspaces.map((ws) => {
      const stats = statsMap.get(ws.id);
      const totalBookings = stats ? parseInt(stats.totalBookings, 10) : 0;
      const confirmedBookings = stats ? parseInt(stats.confirmedBookings, 10) : 0;
      const totalBookedHours = stats ? parseFloat(stats.totalBookedHours) || 0 : 0;
      // Available hours = period hours × capacity (each capacity slot is independently bookable)
      const availableHours = periodHours * ws.capacity;
      const utilizationPct =
        availableHours > 0
          ? Math.min(100, parseFloat(((totalBookedHours / availableHours) * 100).toFixed(1)))
          : 0;

      return {
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceType: ws.type,
        capacity: ws.capacity,
        totalBookings,
        confirmedBookings,
        totalBookedHours: parseFloat(totalBookedHours.toFixed(1)),
        availableHours: parseFloat(availableHours.toFixed(1)),
        utilizationPct,
      };
    });

    const totalAvailable = wsOccupancy.reduce((s, w) => s + w.availableHours, 0);
    const totalBooked = wsOccupancy.reduce((s, w) => s + w.totalBookedHours, 0);
    const overallUtilizationPct =
      totalAvailable > 0
        ? Math.min(100, parseFloat(((totalBooked / totalAvailable) * 100).toFixed(1)))
        : 0;

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      workspaces: wsOccupancy,
      overallUtilizationPct,
    };
  }
}
