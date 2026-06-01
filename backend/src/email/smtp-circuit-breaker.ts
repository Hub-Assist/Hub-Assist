import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class SmtpCircuitBreaker {
  private readonly logger = new Logger(SmtpCircuitBreaker.name);
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30 * 60 * 1000; // 30 minutes
  private readonly key = 'smtp:circuit-breaker';

  constructor(@InjectRedis() private redis: Redis) {}

  async recordSuccess(): Promise<void> {
    await this.redis.del(this.key);
    this.logger.debug('Circuit breaker reset on success');
  }

  async recordFailure(): Promise<void> {
    const failures = await this.redis.incr(`${this.key}:failures`);
    await this.redis.expire(`${this.key}:failures`, 60); // Reset counter after 1 minute of no failures

    if (failures >= this.failureThreshold) {
      await this.redis.setex(this.key, this.resetTimeout / 1000, CircuitBreakerState.OPEN);
      this.logger.warn(`Circuit breaker opened after ${failures} failures`);
    }
  }

  async getState(): Promise<CircuitBreakerState> {
    const state = await this.redis.get(this.key);
    if (state === CircuitBreakerState.OPEN) {
      return CircuitBreakerState.OPEN;
    }
    return CircuitBreakerState.CLOSED;
  }

  async isOpen(): Promise<boolean> {
    return (await this.getState()) === CircuitBreakerState.OPEN;
  }
}
