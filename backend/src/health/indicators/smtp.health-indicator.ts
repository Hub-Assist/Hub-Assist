import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (!host || !user || !pass) {
      return this.getStatus(key, true, {
        status: 'skipped',
        reason: 'SMTP credentials not configured',
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    try {
      await transporter.verify();
      return this.getStatus(key, true, { status: 'up', host, port });
    } catch (err) {
      throw new HealthCheckError(
        `SMTP health check failed: ${(err as Error).message}`,
        this.getStatus(key, false, {
          status: 'down',
          host,
          port,
          error: (err as Error).message,
        }),
      );
    } finally {
      transporter.close();
    }
  }
}
