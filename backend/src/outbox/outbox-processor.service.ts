import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxProcessorService {
  constructor(private readonly outboxService: OutboxService) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { waitForCompletion: true })
  processOutbox() {
    return this.outboxService.processPending();
  }
}
