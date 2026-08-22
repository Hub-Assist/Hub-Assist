import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EmailService } from './email.service';
import { EmailPreviewController } from './email.controller';
import { SmtpCircuitBreaker } from './smtp-circuit-breaker';
import { join } from 'path';

@Global()
@Module({
  imports: [
    ConfigModule,
    // Redis is optional (see RedisHealthIndicator) — when REDIS_URL isn't set,
    // connect lazily and never retry so SmtpCircuitBreaker's client stays idle
    // instead of spamming reconnect attempts or blocking app startup.
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single' as const,
        url: config.get<string>('REDIS_URL') || 'redis://localhost:6379',
        options: {
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          retryStrategy: () => null,
        },
      }),
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST'),
          port: config.get('SMTP_PORT'),
          auth: {
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: config.get('EMAIL_FROM', '"Hub-Assist" <noreply@hub-assist.com>'),
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
        options: {
          partials: {
            dir: join(__dirname, 'templates/layouts'),
            options: {
              strict: true,
            },
          },
        },
      }),
    }),
  ],
  controllers: [EmailPreviewController],
  providers: [EmailService, SmtpCircuitBreaker],
  exports: [EmailService, SmtpCircuitBreaker],
})
export class EmailModule {}
