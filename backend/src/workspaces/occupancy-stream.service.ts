import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Workspace } from './workspace.entity';

export interface OccupancyUpdate {
  workspaceId: string;
  currentOccupancy: number;
  capacity: number;
  remainingCapacity: number;
  timestamp: number;
  eventId: string;
}

@Injectable()
export class OccupancyStreamService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
  ) {}

  async getOccupancyUpdate(workspaceId: string): Promise<OccupancyUpdate> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const now = new Date();
    const currentOccupancy = await this.bookingRepository.count({
      where: {
        workspaceId,
        status: BookingStatus.CONFIRMED,
        startTime: Between(new Date(0), now),
        endTime: Between(now, new Date(8640000000000000)),
      },
    });

    return {
      workspaceId,
      currentOccupancy,
      capacity: workspace.capacity,
      remainingCapacity: workspace.capacity - currentOccupancy,
      timestamp: Date.now(),
      eventId: `${workspaceId}-${Date.now()}`,
    };
  }

  formatMessageEvent(data: OccupancyUpdate, eventId?: string): string {
    const id = eventId || data.eventId;
    return `id: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
  }
}
