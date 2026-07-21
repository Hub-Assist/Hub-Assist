import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationStore {
  correlationId: string;
  userId?: string;
}

/**
 * Single AsyncLocalStorage instance shared across the entire process.
 * Middleware seeds it per-request; LoggerService reads from it automatically.
 */
export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();
