import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Booking, BookingStatus } from './booking.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { RecurrenceService } from './recurrence.service';
import { ConflictDetectionService } from './conflict-detection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CancellationPolicyService } from './cancellation-policy.service';

/**
 * Handles recurring booking series creation and cancellation.
 * Extracted from BookingsService to follow single responsibility principle.
 */
@Injectable()
export class BookingSeriesService {
  constructor(
    @InjectRepository(Booking) private repo: Repository<Booking>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    private recurrenceService: RecurrenceService,
    private conflictDetectionService: ConflictDetectionService,
    private notificationsService: NotificationsService,
    private cancellationPolicyService: CancellationPolicyService,
  ) {}

  /**
   * Create a recurring booking series.
   * Validates all instances for conflicts before inserting.
   */
  async createSeries(
    userId: string,
    workspaceId: string,
    startTime: Date,
    endTime: Date,
    recurrenceRule: string,
    pricePerHour: number,
    totalAmounts: number[],
    stellarTxHash?: string,
  ): Promise<Booking[]> {
    return this.repo.manager.transaction(async (manager) => {
      const durationMs = endTime.getTime() - startTime.getTime();

      if (durationMs <= 0) {
        throw new BadRequestException('endTime must be after startTime');
      }

      const instances = this.recurrenceService.expandInstances(
        recurrenceRule,
        startTime,
        durationMs,
      );

      // Check conflicts for ALL instances before inserting any (atomic)
      for (const instance of instances) {
        const conflict = await this.conflictDetectionService.hasConflict(
          manager,
          workspaceId,
          instance.startTime,
          instance.endTime,
        );

        if (conflict) {
          throw new ConflictException({
            message: `Recurring series conflict detected on instance starting ${instance.startTime.toISOString()}`,
            conflictDetail: conflict,
          });
        }
      }

      // All clear — batch-insert all instances
      const seriesId = uuidv4();
      const bookings: Booking[] = instances.map((instance, index) => {
        const totalAmount = totalAmounts[index] ?? 0;

        return manager.create(Booking, {
          workspaceId,
          userId,
          startTime: instance.startTime,
          endTime: instance.endTime,
          totalAmount,
          status: BookingStatus.PENDING,
          stellarTxHash: stellarTxHash ?? null,
          // Only the first instance carries the RRULE string
          recurrenceRule: index === 0 ? recurrenceRule : undefined,
          seriesId,
          instanceIndex: index,
        });
      });

      const saved = await manager.save(bookings);

      const workspace = await manager.findOne(Workspace, {
        where: { id: workspaceId },
      });

      this.notificationsService.sendToUser(userId, 'booking:series_created', {
        seriesId,
        instanceCount: saved.length,
        workspaceName: workspace?.name,
      });

      return saved;
    });
  }

  /**
   * Find all bookings in a series.
   */
  async findBySeries(seriesId: string): Promise<Booking[]> {
    const bookings = await this.repo.find({
      where: { seriesId },
      order: { instanceIndex: 'ASC' },
    });

    if (bookings.length === 0) {
      throw new NotFoundException(`No bookings found for series "${seriesId}"`);
    }

    return bookings;
  }

  /**
   * Cancel all future instances of a recurring series.
   */
  async cancelSeries(seriesId: string, userId: string) {
    const now = new Date();
    const allInstances = await this.repo.find({ where: { seriesId } });

    if (allInstances.length === 0) {
      throw new NotFoundException(`No bookings found for series "${seriesId}"`);
    }

    const owner = allInstances[0];
    if (owner.userId !== userId) {
      throw new ForbiddenException('Not authorized to cancel this booking series');
    }

    const futureInstances = allInstances.filter(
      (b) => b.startTime > now && b.status !== BookingStatus.CANCELLED,
    );

    if (futureInstances.length === 0) {
      return {
        cancelledCount: 0,
        preservedCount: allInstances.length,
        message: 'No future instances to cancel.',
      };
    }

    const cancelledAt = now;
    for (const instance of futureInstances) {
      const bookingWithWorkspace = await this.repo.findOne({
        where: { id: instance.id },
        relations: ['workspace'],
      });
      if (bookingWithWorkspace) {
        const refundEval = await this.cancellationPolicyService.evaluateRefund(
          bookingWithWorkspace,
          cancelledAt,
        );
        instance.refundAmount = refundEval.refundAmount;
      }
      instance.status = BookingStatus.CANCELLED;
    }

    await this.repo.save(futureInstances);
    this.notificationsService.sendToUser(userId, 'booking:series_cancelled', {
      seriesId,
      cancelledCount: futureInstances.length,
    });
    return {
      cancelledCount: futureInstances.length,
      preservedCount: allInstances.length - futureInstances.length,
      message: `Cancelled ${futureInstances.length} future instance(s). Past instances preserved.`,
    };
  }
}
