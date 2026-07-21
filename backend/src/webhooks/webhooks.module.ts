import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookProcessorService } from './webhook-processor.service';
import { WebhookService } from './webhook.service';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WebhookSubscription, WebhookDelivery])],
  providers: [WebhookService, WebhookProcessorService],
  controllers: [WebhooksController],
  exports: [WebhookService],
})
export class WebhooksModule {}
