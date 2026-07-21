import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      // Redis is optional — report as skipped rather than failing
      return this.getStatus(key, true, { status: 'skipped', reason: 'REDIS_URL not configured' });
    }

    const client = new Redis(redisUrl, {
      connectTimeout: 3000,
      commandTimeout: 3000,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      const isUp = pong === 'PONG';
      await client.quit();

      if (!isUp) {
        throw new HealthCheckError(
          'Redis ping did not return PONG',
          this.getStatus(key, false, { status: 'down', response: pong }),
        );
      }

      return this.getStatus(key, true, { status: 'up' });
    } catch (err) {
      client.disconnect();
      if (err instanceof HealthCheckError) throw err;

      throw new HealthCheckError(
        `Redis health check failed: ${(err as Error).message}`,
        this.getStatus(key, false, {
          status: 'down',
          error: (err as Error).message,
        }),
      );
    }
  }
}
