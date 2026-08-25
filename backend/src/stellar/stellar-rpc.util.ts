import { Logger } from '@nestjs/common';
import { StellarRpcError } from './stellar-rpc.error';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
}

/**
 * Runs `operation` with exponential backoff: on failure it retries up to
 * `policy.maxRetries` additional times (delay doubling each attempt,
 * starting at `policy.baseDelayMs`), then throws a typed StellarRpcError
 * wrapping the last error instead of letting the raw rejection propagate.
 */
export async function withStellarRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  policy: RetryPolicy,
  logger: Logger,
): Promise<T> {
  const totalAttempts = policy.maxRetries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= totalAttempts) {
        break;
      }

      const delayMs = policy.baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        `${operationName} failed on attempt ${attempt}/${totalAttempts}: ${
          (error as Error).message
        }. Retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }

  throw new StellarRpcError(
    `${operationName} failed after ${totalAttempts} attempt(s): ${(lastError as Error)?.message}`,
    operationName,
    totalAttempts,
    lastError,
  );
}
