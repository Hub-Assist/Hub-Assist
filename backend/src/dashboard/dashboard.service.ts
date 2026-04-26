import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Booking } from '../bookings/booking.entity';
import { Workspace } from '../workspaces/workspace.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
  ) {}

  async getStats() {
    const totalMembers = await this.userRepo.count();
    const verifiedMembers = await this.userRepo.count({
      where: { role: UserRole.MEMBER },
    });
    const activeWorkspaces = await this.workspaceRepo.count({
      where: { isActive: true, deletedAt: null },
    });

    const confirmedBookings = await this.bookingRepo.count({
      where: { status: 'Confirmed' },
    });
    const deskOccupancy = confirmedBookings > 0 ? (confirmedBookings / activeWorkspaces) * 100 : 0;

    return {
      totalMembers,
      verifiedMembers,
      activeWorkspaces,
      deskOccupancy: Math.round(deskOccupancy),
    };
  }

  async getActivity() {
    const recentBookings = await this.bookingRepo.find({
      relations: ['user', 'workspace'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return recentBookings.map((booking) => ({
      type: 'booking',
      description: `${booking.user.email} booked ${booking.workspace.name}`,
      timestamp: booking.createdAt,
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
