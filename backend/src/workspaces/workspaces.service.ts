import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Workspace, WorkspaceType, WorkspaceAvailability } from './workspace.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { AmenitiesService } from './amenities.service';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { EmailService } from '../email/email.service';
import { CapacityCheckService } from '../bookings/capacity-check.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace) private repo: Repository<Workspace>,
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    private amenitiesService: AmenitiesService,
    private emailService: EmailService,
    private capacityCheckService: CapacityCheckService,
  ) {}

  async create(dto: CreateWorkspaceDto) {
    const { amenityIds, ...rest } = dto;
    const workspace = this.repo.create(rest);
    
    if (amenityIds && amenityIds.length > 0) {
      workspace.amenities = await this.amenitiesService.findByIds(amenityIds);
    }
    
    return this.repo.save(workspace);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    type?: WorkspaceType,
    availability?: WorkspaceAvailability,
    amenities?: string[],
    amenityMatch: 'all' | 'any' = 'all',
  ) {
    const query = this.repo.createQueryBuilder('workspace')
      .leftJoinAndSelect('workspace.amenities', 'amenity', 'amenity.deletedAt IS NULL')
      .where('workspace.deletedAt IS NULL');

    if (type) {
      query.andWhere('workspace.type = :type', { type });
    }

    if (availability) {
      query.andWhere('workspace.availability = :availability', { availability });
    }

    if (amenities && amenities.length > 0) {
      if (amenityMatch === 'any') {
        query.andWhere('amenity.name IN (:...amenityNames)', { amenityNames: amenities });
      } else {
        // AND logic: workspace must have ALL of these amenities
        // We ensure this by checking if the count of matching amenities equals the requested count
        // or using subqueries for each amenity to be strict
        amenities.forEach((amenityName, index) => {
          query.andWhere(qb => {
            const subQuery = qb.subQuery()
              .select('ws_am.workspacesId')
              .from('workspace_amenities', 'ws_am')
              .innerJoin('amenities', 'am', 'am.id = ws_am.amenitiesId')
              .where(`am.name = :amenity_${index}`)
              .getQuery();
            return `workspace.id IN ${subQuery}`;
          }, { [`amenity_${index}`]: amenityName });
        });
      }
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
    const workspace = await this.findById(id);
    const { amenityIds, ...rest } = dto;
    
    Object.assign(workspace, rest);
    
    if (amenityIds) {
      workspace.amenities = await this.amenitiesService.findByIds(amenityIds);
    }
    
    return this.repo.save(workspace);
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
