import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { Attendance, AttendanceAction } from '../attendance/attendance.entity';
import { DailyUtilizationSnapshot } from './daily-utilization-snapshot.entity';

type Period = '7d' | '30d' | '90d';

function periodDays(period: Period): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90;
}

interface TrendLine {
  slope: number;
  intercept: number;
  r2: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
    @InjectRepository(DailyUtilizationSnapshot)
    private snapshotRepo: Repository<DailyUtilizationSnapshot>,
  ) {}

  async getMemberGrowth(period: Period = '30d') {
    const days = periodDays(period);
    const results = await this.userRepo
      .createQueryBuilder('user')
      .select("TO_CHAR(DATE_TRUNC('day', user.createdAt), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(user.id)', 'count')
      .where(`user.createdAt >= NOW() - INTERVAL '${days} days'`)
      .groupBy("DATE_TRUNC('day', user.createdAt)")
      .orderBy("DATE_TRUNC('day', user.createdAt)", 'ASC')
      .getRawMany();

    return results.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  }

  async getBookingRevenue(period: Period = '30d') {
    const days = periodDays(period);
    const results = await this.bookingRepo
      .createQueryBuilder('booking')
      .select("TO_CHAR(DATE_TRUNC('day', booking.createdAt), 'YYYY-MM-DD')", 'date')
      .addSelect('SUM(booking.totalAmount)', 'revenue')
      .where(`booking.createdAt >= NOW() - INTERVAL '${days} days'`)
      .groupBy("DATE_TRUNC('day', booking.createdAt)")
      .orderBy("DATE_TRUNC('day', booking.createdAt)", 'ASC')
      .getRawMany();

    return results.map((r) => ({ date: r.date, revenue: parseFloat(r.revenue) || 0 }));
  }

  async getWorkspaceUtilization() {
    const workspaces = await this.workspaceRepo.find({ where: { isActive: true } });
    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const confirmedCount = await this.bookingRepo.count({
          where: { workspaceId: ws.id, status: BookingStatus.CONFIRMED },
        });
        return {
          workspaceId: ws.id,
          name: ws.name,
          type: ws.type,
          capacity: ws.capacity,
          confirmedBookings: confirmedCount,
          utilizationPct: ws.capacity > 0 ? Math.min(100, Math.round((confirmedCount / ws.capacity) * 100)) : 0,
        };
      }),
    );
    return results;
  }

  async getAttendancePatterns() {
    const records = await this.attendanceRepo.find({
      where: { action: AttendanceAction.CLOCK_IN },
    });

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};

    for (const r of records) {
      const h = r.timestamp.getHours();
      const d = r.timestamp.getDay(); // 0=Sun
      hourCounts[h] = (hourCounts[h] || 0) + 1;
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      peakHours: Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count })),
      dayOfWeekPatterns: Object.entries(dayCounts)
        .map(([day, count]) => ({ day: dayNames[parseInt(day)], count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Nightly batch job to aggregate daily utilization stats
   * Runs at 2 AM UTC daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async aggregateDailyUtilization() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const workspaces = await this.workspaceRepo.find();

      for (const workspace of workspaces) {
        const bookings = await this.bookingRepo.find({
          where: {
            workspaceId: workspace.id,
            status: BookingStatus.CONFIRMED,
            startTime: Between(yesterday, new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)),
          },
        });

        // Calculate booked hours (simplified: count bookings * 1 hour each)
        const bookedHours = bookings.length;

        // Calculate available hours (default 10 hours per day, 9 AM - 7 PM)
        const availableHours = 10;

        // Calculate occupancy rate
        const occupancyRate = availableHours > 0 ? (bookedHours / availableHours) * 100 : 0;

        // Upsert snapshot (idempotent)
        await this.snapshotRepo.upsert(
          {
            date: yesterday,
            workspaceId: workspace.id,
            workspaceType: workspace.type,
            bookedHours: bookedHours as any,
            availableHours: availableHours as any,
            occupancyRate: Math.min(100, occupancyRate) as any,
          },
          ['date', 'workspaceId'],
        );
      }

      this.logger.log(`Daily utilization aggregation completed for ${yesterday.toISOString()}`);
    } catch (error) {
      this.logger.error('Failed to aggregate daily utilization', error);
    }
  }

  /**
   * Get workspace utilization analytics with trend forecasting
   */
  async getUtilizationAnalytics(
    workspaceType?: string,
    dateRangeStart?: Date,
    dateRangeEnd?: Date,
  ) {
    const endDate = dateRangeEnd || new Date();
    const startDate = dateRangeStart || new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    let query = this.snapshotRepo
      .createQueryBuilder('snapshot')
      .where('snapshot.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('snapshot.date', 'ASC');

    if (workspaceType) {
      query = query.andWhere('snapshot.workspaceType = :workspaceType', { workspaceType });
    }

    const snapshots = await query.getMany();

    // Group by date and calculate averages
    const dailyAverages: Record<string, { bookedHours: number; availableHours: number; occupancyRate: number }> = {};

    for (const snapshot of snapshots) {
      const dateStr = snapshot.date.toISOString().split('T')[0];
      if (!dailyAverages[dateStr]) {
        dailyAverages[dateStr] = { bookedHours: 0, availableHours: 0, occupancyRate: 0 };
      }
      dailyAverages[dateStr].bookedHours += Number(snapshot.bookedHours);
      dailyAverages[dateStr].availableHours += Number(snapshot.availableHours);
      dailyAverages[dateStr].occupancyRate += Number(snapshot.occupancyRate);
    }

    // Normalize by workspace count
    const workspaceCount = new Set(snapshots.map((s) => s.workspaceId)).size || 1;
    const data = Object.entries(dailyAverages).map(([date, values]) => ({
      date,
      bookedHours: values.bookedHours / workspaceCount,
      availableHours: values.availableHours / workspaceCount,
      occupancyRate: values.occupancyRate / workspaceCount,
    }));

    // Compute trend lines for 30/60/90 day periods
    const trend30 = this.computeTrendLine(data.slice(-30));
    const trend60 = this.computeTrendLine(data.slice(-60));
    const trend90 = this.computeTrendLine(data);

    return {
      currentMetrics: data.length > 0 ? data[data.length - 1] : null,
      historicalData: data,
      trends: {
        trend30Days: trend30,
        trend60Days: trend60,
        trend90Days: trend90,
      },
    };
  }

  /**
   * Compute linear regression trend line
   */
  private computeTrendLine(data: Array<{ occupancyRate: number }>): TrendLine {
    if (data.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const n = data.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = data.map((d) => d.occupancyRate);

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (yValues[i] - yMean), 0);
    const denominator = xValues.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Calculate R²
    const ssRes = yValues.reduce((sum, y, i) => sum + (y - (slope * xValues[i] + intercept)) ** 2, 0);
    const ssTot = yValues.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
    const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  }
}
