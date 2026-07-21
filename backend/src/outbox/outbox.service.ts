import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OutboxEvent, OutboxEventStatus, OutboxEventType } from './outbox-event.entity';
import { StellarService } from '../stellar/stellar.service';

const MAX_OUTBOX_RETRIES = 5;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent) private readonly repo: Repository<OutboxEvent>,
    private readonly stellarService: StellarService,
  ) {}

  create(manager: EntityManager, eventType: OutboxEventType, payload: Record<string, any>) {
    return manager.save(OutboxEvent, manager.create(OutboxEvent, { eventType, payload }));
  }

  async processPending(limit = 25): Promise<void> {
    const events = await this.repo.manager.transaction((manager) =>
      manager
        .createQueryBuilder(OutboxEvent, 'event')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('event.status = :status', { status: OutboxEventStatus.PENDING })
        .orderBy('event.createdAt', 'ASC')
        .take(limit)
        .getMany(),
    );

    for (const event of events) {
      await this.publish(event);
    }
  }

  private async publish(event: OutboxEvent): Promise<void> {
    try {
      await this.stellarService.publishPaymentEvent(event.eventType, event.payload);
      event.status = OutboxEventStatus.SENT;
      event.processedAt = new Date();
      await this.repo.save(event);
    } catch (error) {
      const retryCount = event.retryCount + 1;
      await this.repo.update(event.id, {
        retryCount,
        status: retryCount >= MAX_OUTBOX_RETRIES ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
        processedAt: retryCount >= MAX_OUTBOX_RETRIES ? new Date() : null,
      });
      this.logger.warn(`Outbox event ${event.id} failed: ${(error as Error).message}`);
    }
  }
}
