import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { calculateNextRetryAt, isDeadLetter } from '../utils/retry-backoff';
import { OutboxEvent, OutboxEventStatus, OutboxEventType } from './outbox-event.entity';
import { StellarService } from '../stellar/stellar.service';

const MAX_OUTBOX_ATTEMPTS = 5;

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
        .andWhere('(event.nextRetryAt IS NULL OR event.nextRetryAt <= :now)', { now: new Date() })
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
      const attempts = event.retryCount + 1;
      const isDead = isDeadLetter(attempts, MAX_OUTBOX_ATTEMPTS);

      await this.repo.update(event.id, {
        retryCount: attempts,
        status: isDead ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
        nextRetryAt: isDead ? event.nextRetryAt : calculateNextRetryAt(attempts),
        processedAt: isDead ? new Date() : null,
      });

      if (isDead) {
        this.logger.error(`Outbox event ${event.id} dead after ${attempts} attempts: ${(error as Error).message}`);
      } else {
        this.logger.warn(`Outbox event ${event.id} failed on attempt ${attempts}: ${(error as Error).message}`);
      }
    }
  }
}
