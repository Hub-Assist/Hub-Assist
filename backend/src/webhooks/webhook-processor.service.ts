import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookProcessorService {
  constructor(private readonly webhookService: WebhookService) {}

  @Cron(CronExpression.EVERY_SECOND, { waitForCompletion: true })
  processDeliveries() {
    return this.webhookService.processReady();
  }
}
