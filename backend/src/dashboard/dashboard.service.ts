import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { AuditLog, EventCategory } from '../audit/audit-log.entity';

export interface ActivityFeedQuery {
  eventCategory?: EventCategory;
  actorId?: string;
  resourceId?: string;
  cursor?: string;
  limit?: number;
}

export interface ActivityFeedResponse {
  items: any[];
  nextCursor?: string;
  hasMore: boolean;
}

@Injectable()
export class DashboardService {
  private readonly MAX_PAGE_SIZE = 50;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(AuditLog) private auditLogRepo: Repository<AuditLog>,
  ) {}

  async getStats() {
    const totalMembers = await this.userRepo.count();
    const verifiedMembers = await this.userRepo.count({
      where: { isVerified: true },
    });
    const activeWorkspaces = await this.workspaceRepo.count({
      where: { isActive: true, deletedAt: null as any },
    });

    const confirmedBookings = await this.bookingRepo.count({
      where: { status: BookingStatus.CONFIRMED },
    });
    const deskOccupancy = confirmedBookings > 0 ? (confirmedBookings / activeWorkspaces) * 100 : 0;

    return {
      totalMembers,
      verifiedMembers,
      activeWorkspaces,
      deskOccupancy: Math.min(100, Math.round(deskOccupancy)),
    };
  }

  async getActivity(
    query: ActivityFeedQuery = {},
    currentUserId?: string,
    currentUserRole?: UserRole,
  ): Promise<ActivityFeedResponse> {
    const limit = Math.min(query.limit || 20, this.MAX_PAGE_SIZE);
    const qb = this.auditLogRepo.createQueryBuilder('audit');

    // Role-based filtering: non-admins see only their own activity
    if (currentUserRole !== UserRole.ADMIN && currentUserId) {
      qb.where('audit.actorId = :actorId', { actorId: currentUserId });
    }

    // Apply optional filters
    if (query.eventCategory) {
      qb.andWhere('audit.eventCategory = :eventCategory', {
        eventCategory: query.eventCategory,
      });
    }

    if (query.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.resourceId) {
      qb.andWhere('audit.resourceId = :resourceId', { resourceId: query.resourceId });
    }

    // Cursor-based pagination
    if (query.cursor) {
      const decodedCursor = Buffer.from(query.cursor, 'base64').toString('utf-8');
      const [createdAt, id] = decodedCursor.split(':');
      qb.andWhere(
        '(audit.createdAt < :createdAt OR (audit.createdAt = :createdAt AND audit.id < :id))',
        { createdAt: new Date(createdAt), id },
      );
    }

    // Fetch one extra to determine if there are more results
    const items = await qb
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = items.length > limit;
    const results = items.slice(0, limit);

    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      const cursorStr = `${lastItem.createdAt.toISOString()}:${lastItem.id}`;
      nextCursor = Buffer.from(cursorStr).toString('base64');
    }

    return {
      items: results.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        eventCategory: log.eventCategory,
        actorId: log.actorId,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        timestamp: log.createdAt,
      })),
      nextCursor,
      hasMore,
    };
  }

  async getGrowth(): Promise<Array<{ date: string; members: number }>> {
    const results = await this.userRepo
      .createQueryBuilder('user')
      .select("TO_CHAR(DATE_TRUNC('month', user.createdAt), 'YYYY-MM')", 'date')
      .addSelect('COUNT(user.id)', 'members')
      .where("user.createdAt >= NOW() - INTERVAL '12 months'")
      .groupBy("DATE_TRUNC('month', user.createdAt)")
      .orderBy("DATE_TRUNC('month', user.createdAt)", 'ASC')
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      members: parseInt(r.members, 10),
    }));
  }

  async getAdminStats() {
    const stats = await this.getStats();
    const totalBookings = await this.bookingRepo.count();
    const revenue = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('SUM(booking.totalAmount)', 'total')
      .getRawOne();

    return {
      ...stats,
      totalBookings,
      revenue: parseFloat(revenue.total) || 0,
    };
  }
}
