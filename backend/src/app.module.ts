import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { pinoLoggerConfig } from './config/logger.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContactModule } from './contact/contact.module';
import { AttendanceModule } from './attendance/attendance.module';
import { BookingsModule } from './bookings/bookings.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { StellarModule } from './stellar/stellar.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { HealthModule } from './health/health.module';
import { HubsModule } from './hubs/hubs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PricingModule } from './pricing/pricing.module';
import { OutboxModule } from './outbox/outbox.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuditLogModule } from './audit/audit-log.module';
import { ReportsModule } from './reports/reports.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { validationSchema } from './config/validation.schema';
import { HttpLoggerMiddleware } from './common/middlewares/http-logger.middleware';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { IdempotencyMiddleware } from './common/middlewares/idempotency.middleware';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { CsrfGuard } from './auth/csrf.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      validationSchema,
    }),
    // Pino structured JSON logger — replaces nest-winston
    LoggerModule.forRoot(pinoLoggerConfig),
    // App-wide LoggerService wrapper (auto-injects correlationId/userId)
    AppLoggerModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get('database');
        return config || {};
      },
    }),
    // ── Redis-backed distributed rate limiter ──────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const throttlers = [{ name: 'default', ttl: 60_000, limit: 10 }];

        if (redisUrl) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { ThrottlerStorageRedisService } = require('@nest-lab/throttler-storage-redis');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const Redis = require('ioredis');
          return { throttlers, storage: new ThrottlerStorageRedisService(new Redis(redisUrl)) };
        }

        return { throttlers };
      },
    }),
    // ── Cache (idempotency + general) ──────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { redisStore } = require('cache-manager-ioredis-yet');
          return { store: redisStore, url: redisUrl, ttl: 300_000 };
        }

        return { ttl: 300_000 };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ContactModule,
    AttendanceModule,
    BookingsModule,
    WorkspacesModule,
    StellarModule,
    DashboardModule,
    NewsletterModule,
    CloudinaryModule,
    HealthModule,
    HubsModule,
    AnalyticsModule,
    NotificationsModule,
    PricingModule,
    OutboxModule,
    WebhooksModule,
    AuditLogModule.forRoot(),
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RedisThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    // LoggingInterceptor registered here so DI (LoggerService) works
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RequestIdMiddleware runs first (kept for backward compat with x-request-id)
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    // HttpLoggerMiddleware seeds AsyncLocalStorage with correlationId
    consumer
      .apply(HttpLoggerMiddleware)
      .exclude('health', 'health/live', 'health/ready')
      .forRoutes('*');

    // Idempotency middleware — applied only to state-mutating POST routes
    // on bookings (and any future mutation-heavy modules).
    // The middleware runs AFTER JwtAuthGuard has populated req.user, which
    // happens at the guard layer (before middleware in NestJS execution order).
    // We therefore apply it as a functional middleware on specific routes so
    // it executes after authentication.
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        { path: 'bookings', method: RequestMethod.POST },
        { path: 'attendance', method: RequestMethod.POST },
        { path: 'contact', method: RequestMethod.POST },
      );
  }
}
