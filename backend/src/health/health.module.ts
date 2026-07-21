import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { StellarHealthIndicator } from './indicators/stellar.health-indicator';
import { SmtpHealthIndicator } from './indicators/smtp.health-indicator';
import { CloudinaryHealthIndicator } from './indicators/cloudinary.health-indicator';

@Module({
  imports: [
    TerminusModule.forRoot({
      // Terminus will return HTTP 503 on failed checks by default.
      // errorLogStyle: 'minimal' keeps logs clean in production.
      errorLogStyle: 'minimal',
    }),
    ConfigModule,
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    StellarHealthIndicator,
    SmtpHealthIndicator,
    CloudinaryHealthIndicator,
  ],
})
export class HealthModule {}
