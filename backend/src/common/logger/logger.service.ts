import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { correlationStorage } from '../correlation/correlation.context';

/**
 * Application-wide logger that automatically injects correlationId and userId
 * from the current AsyncLocalStorage context into every log line.
 *
 * Usage:
 *   constructor(private readonly logger: LoggerService) {}
 *   this.logger.log('message', { extra: 'field' });
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  constructor(private readonly pino: PinoLogger) {}

  private context(): Record<string, unknown> {
    const store = correlationStorage.getStore();
    if (!store) return {};
    const ctx: Record<string, unknown> = { correlationId: store.correlationId };
    if (store.userId) ctx['userId'] = store.userId;
    return ctx;
  }

  log(message: string, meta?: Record<string, unknown>): void {
    this.pino.info({ ...this.context(), ...meta }, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.pino.warn({ ...this.context(), ...meta }, message);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.pino.error({ ...this.context(), ...meta }, message);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.pino.debug({ ...this.context(), ...meta }, message);
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.pino.trace({ ...this.context(), ...meta }, message);
  }

  /** Satisfy NestJS LoggerService interface (used by app.useLogger) */
  fatal(message: string, meta?: Record<string, unknown>): void {
    this.pino.fatal({ ...this.context(), ...meta }, message);
  }
}
