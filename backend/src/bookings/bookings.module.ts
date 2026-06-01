import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { CancellationPolicy } from './cancellation-policy.entity';
import { BookingsService } from './bookings.service';
import { ConflictDetectionService } from './conflict-detection.service';
import { CapacityCheckService } from './capacity-check.service';
import { RecurrenceService } from './recurrence.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { BookingsController } from './bookings.controller';
import { StellarModule } from '../stellar/stellar.module';
import { Workspace } from '../workspaces/workspace.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { CacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Workspace, CancellationPolicy]),
    StellarModule,
    NotificationsModule,
    PricingModule,
    OutboxModule,
    WebhooksModule,
    CacheModule,
  ],
  providers: [
    BookingsService,
    ConflictDetectionService,
    CapacityCheckService,
    RecurrenceService,
    CancellationPolicyService,
    RolesGuard,
  ],
  controllers: [BookingsController],
  exports: [BookingsService, CancellationPolicyService, CapacityCheckService],
})
export class BookingsModule {}
