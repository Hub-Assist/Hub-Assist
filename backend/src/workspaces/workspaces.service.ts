import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Workspace, WorkspaceType, WorkspaceAvailability } from './workspace.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { EmailService } from '../email/email.service';
import { CapacityCheckService } from '../bookings/capacity-check.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace) private repo: Repository<Workspace>,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    private emailService: EmailService,
    private capacityCheckService: CapacityCheckService,
  ) {}

  create(dto: CreateWorkspaceDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    type?: WorkspaceType,
    availability?: WorkspaceAvailability,
  ) {
    const query = this.repo.createQueryBuilder('workspace').where('workspace.deletedAt IS NULL');

    if (type) {
      query.andWhere('workspace.type = :type', { type });
    }

    if (availability) {
      query.andWhere('workspace.availability = :availability', { availability });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const workspace = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  async getHourlyAvailability(id: string, dateStr: string) {
    await this.findById(id);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    return this.repo.manager.transaction(async (manager) => {
      return this.capacityCheckService.getHourlyAvailability(manager, id, date);
    });
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    await this.findById(id);
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  async softDelete(id: string) {
    const workspace = await this.findById(id);
    const futureBookings = await this.bookingRepo.find({
      where: {
        workspaceId: id,
        status: BookingStatus.CONFIRMED,
        startTime: MoreThan(new Date()),
      },
      relations: ['user', 'workspace'],
    });

    await this.repo.manager.transaction(async (manager) => {
      if (futureBookings.length) {
        await manager.update(
          Booking,
          futureBookings.map((booking) => booking.id),
          { status: BookingStatus.CANCELLED },
        );
      }
      await manager.softDelete(Workspace, id);
    });

    await Promise.allSettled(
      futureBookings
        .filter((booking) => booking.user?.email)
        .map((booking) =>
          this.emailService.sendWorkspaceBookingCancelled(booking.user.email, {
            bookingId: booking.id,
            workspaceName: workspace.name,
          }),
        ),
    );
  }
}
