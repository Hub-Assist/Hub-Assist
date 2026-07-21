import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * Extends the stock ThrottlerGuard to:
 *  1. Key rate-limit buckets by authenticated user ID (falls back to IP).
 *  2. Append X-RateLimit-Limit, X-RateLimit-Window, and Retry-After headers.
 *
 * Works with both the in-memory store (local dev) and the Redis-backed
 * ThrottlerStorageRedisService (staging / production).
 */
@Injectable()
export class RedisThrottlerGuard extends ThrottlerGuard {
  /**
   * Use the authenticated user's ID as the throttle tracker key so that
   * rate-limit counters are per-user rather than per-IP. Falls back to IP
   * for unauthenticated routes (e.g. /auth/login, /auth/resend-otp).
   */
  protected async getTracker(req: Request): Promise<string> {
    const userId: string | undefined =
      (req as any).user?.id ?? (req as any).user?.sub;
    return userId ?? req.ip ?? 'anonymous';
  }

  /**
   * @nestjs/throttler v6 passes a single ThrottlerRequest object.
   * We call super first, then attach informational headers on success.
   */
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const result = await super.handleRequest(requestProps);

    const res = requestProps.context.switchToHttp().getResponse<Response>();
    res.setHeader('X-RateLimit-Limit', requestProps.limit);
    // ttl is in milliseconds — convert to seconds for the header
    res.setHeader('X-RateLimit-Window', Math.ceil(requestProps.ttl / 1000));

    return result;
  }

  /**
   * Called when the rate limit is exceeded (429). Adds Retry-After header
   * before delegating to the base class which throws ThrottlerException.
   */
  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();

    const retryAfterSeconds = Math.ceil(throttlerLimitDetail.ttl / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    res.setHeader('X-RateLimit-Limit', throttlerLimitDetail.limit);
    res.setHeader('X-RateLimit-Remaining', 0);

    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
