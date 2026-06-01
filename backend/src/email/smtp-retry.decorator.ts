import { Logger } from '@nestjs/common';

const logger = new Logger('SmtpRetry');

export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number[];
}

const defaultBackoff = [2 * 60 * 1000, 4 * 60 * 1000, 8 * 60 * 1000]; // 2, 4, 8 minutes

const isRetryableError = (error: any): boolean => {
  // Transient SMTP errors
  const retryableCodes = [421, 450, 451, 452]; // Temporary failures
  if (error.responseCode && retryableCodes.includes(error.responseCode)) {
    return true;
  }

  // Connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH') {
    return true;
  }

  return false;
};

export function Retry(options: RetryOptions = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const backoffMs = options.backoffMs || defaultBackoff;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await originalMethod.apply(this, args);
          if (attempt > 1) {
            logger.log(`${propertyKey} succeeded on attempt ${attempt}`);
          }
          return result;
        } catch (error) {
          lastError = error;

          if (!isRetryableError(error)) {
            logger.warn(`${propertyKey} failed with non-retryable error: ${error.message}`);
            throw error;
          }

          if (attempt < maxAttempts) {
            const delay = backoffMs[attempt - 1] || backoffMs[backoffMs.length - 1];
            logger.warn(
              `${propertyKey} attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            logger.error(`${propertyKey} failed after ${maxAttempts} attempts: ${error.message}`);
          }
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
