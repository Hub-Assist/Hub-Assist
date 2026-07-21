import { Injectable, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { MaintenanceWindow } from '../workspaces/maintenance-window.entity';

export interface ConflictDetail {
  conflictingBookingId?: string;
  overlappingWindow?: {
    startTime: Date;
    endTime: Date;
  };
  reason: string;
  available?: number;
}

@Injectable()
export class ConflictDetectionService {
  async hasConflict(
    manager: EntityManager,
    workspaceId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<ConflictDetail | null> {
    // Lock the workspace for update to prevent concurrent booking race conditions
    const workspace = await manager.findOne(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // 1. Check Maintenance Windows
    const maintenanceQuery = manager.createQueryBuilder(MaintenanceWindow, 'mw')
      .where('mw.workspaceId = :workspaceId', { workspaceId })
      .andWhere('mw.startTime < :endTime AND mw.endTime > :startTime', { startTime, endTime });

    const conflictingMaintenance = await maintenanceQuery.getOne();

    if (conflictingMaintenance) {
      return {
        reason: 'Maintenance Window',
        overlappingWindow: {
          startTime: conflictingMaintenance.startTime,
          endTime: conflictingMaintenance.endTime,
        },
      };
    }

    // 2. Check Overlapping Bookings
    const bookingsQuery = manager.createQueryBuilder(Booking, 'booking')
      .where('booking.workspaceId = :workspaceId', { workspaceId })
      .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
      .andWhere('booking.startTime < :endTime AND booking.endTime > :startTime', { startTime, endTime });

    if (excludeBookingId) {
      bookingsQuery.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
    }

    const overlappingBookings = await bookingsQuery.getMany();

    if (overlappingBookings.length > 0) {
      // Calculate max concurrent bookings during the requested interval
      // Since capacity could be > 1, we must ensure that at no point in the requested interval 
      // the number of concurrent bookings (including the new one) exceeds capacity.
      
      const events: { time: number; type: 'start' | 'end' }[] = [];
      
      // We only care about the overlap window [startTime, endTime]
      events.push({ time: startTime.getTime(), type: 'start' });
      events.push({ time: endTime.getTime(), type: 'end' });
      
      for (const b of overlappingBookings) {
        // Only consider the parts of the bookings that intersect with our requested window
        const overlapStart = Math.max(startTime.getTime(), b.startTime.getTime());
        const overlapEnd = Math.min(endTime.getTime(), b.endTime.getTime());
        if (overlapStart < overlapEnd) {
          events.push({ time: overlapStart, type: 'start' });
          events.push({ time: overlapEnd, type: 'end' });
        }
      }

      // Sort events: time ascending, and for same time, 'end' before 'start'
      // to not over-count if a booking ends exactly when another starts.
      events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        if (a.type === b.type) return 0;
        return a.type === 'end' ? -1 : 1;
      });

      let currentConcurrent = 0;
      let maxConcurrent = 0;
      for (const event of events) {
        if (event.type === 'start') {
          currentConcurrent++;
          if (currentConcurrent > maxConcurrent) {
            maxConcurrent = currentConcurrent;
          }
        } else {
          currentConcurrent--;
        }
      }

      // currentConcurrent tracks the number of overlapping bookings at any point.
      // Wait, the new booking is ALSO added to the events list.
      // So maxConcurrent includes the new booking.
      if (maxConcurrent > workspace.capacity) {
        // Find one specific conflicting booking to report
        const firstConflict = overlappingBookings[0];
        const available = Math.max(0, workspace.capacity - (maxConcurrent - 1));
        return {
          conflictingBookingId: firstConflict.id,
          reason: 'capacity_exceeded',
          available,
          overlappingWindow: {
            startTime: firstConflict.startTime,
            endTime: firstConflict.endTime,
          },
        };
      }
    }

    return null; // No conflict
  }
}
