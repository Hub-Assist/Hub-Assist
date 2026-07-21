import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { Workspace } from '../workspaces/workspace.entity';

export interface AvailabilitySlot {
  hour: string; // ISO format: YYYY-MM-DDTHH:00:00Z
  available: number;
  capacity: number;
}

@Injectable()
export class CapacityCheckService {
  /**
   * Check if a workspace has available capacity for the given time range.
   * Uses SELECT COUNT(*) ... FOR UPDATE to ensure atomicity.
   * Returns the number of available slots (capacity - concurrent bookings).
   */
  async hasCapacity(
    manager: EntityManager,
    workspaceId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{ available: number; capacity: number }> {
    // Lock the workspace for update
    const workspace = await manager.findOne(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Count concurrent confirmed/pending bookings during the requested interval
    const concurrentCount = await manager
      .createQueryBuilder(Booking, 'booking')
      .select('COUNT(*)', 'count')
      .where('booking.workspaceId = :workspaceId', { workspaceId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
      })
      .andWhere('booking.startTime < :endTime AND booking.endTime > :startTime', {
        startTime,
        endTime,
      })
      .getRawOne();

    const concurrent = parseInt(concurrentCount.count, 10) || 0;
    const available = Math.max(0, workspace.capacity - concurrent);

    return { available, capacity: workspace.capacity };
  }

  /**
   * Get hourly availability slots for a given date.
   * Returns an array of hourly slots with available capacity.
   */
  async getHourlyAvailability(
    manager: EntityManager,
    workspaceId: string,
    date: Date,
  ): Promise<AvailabilitySlot[]> {
    const workspace = await manager.findOne(Workspace, {
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const slots: AvailabilitySlot[] = [];
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Generate 24 hourly slots
    for (let hour = 0; hour < 24; hour++) {
      const slotStart = new Date(startOfDay);
      slotStart.setUTCHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setUTCHours(hour + 1, 0, 0, 0);

      const concurrentCount = await manager
        .createQueryBuilder(Booking, 'booking')
        .select('COUNT(*)', 'count')
        .where('booking.workspaceId = :workspaceId', { workspaceId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
        })
        .andWhere('booking.startTime < :endTime AND booking.endTime > :startTime', {
          startTime: slotStart,
          endTime: slotEnd,
        })
        .getRawOne();

      const concurrent = parseInt(concurrentCount.count, 10) || 0;
      const available = Math.max(0, workspace.capacity - concurrent);

      slots.push({
        hour: slotStart.toISOString(),
        available,
        capacity: workspace.capacity,
      });
    }

    return slots;
  }
}
