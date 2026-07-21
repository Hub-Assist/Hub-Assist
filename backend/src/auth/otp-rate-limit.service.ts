import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/** Maximum OTP resend requests allowed within the sliding window. */
export const OTP_RESEND_LIMIT = 3;

/** Sliding-window duration in milliseconds (5 minutes). */
export const OTP_RESEND_WINDOW_MS = 5 * 60 * 1000;

/** Maximum wrong OTP guesses before the OTP is invalidated. */
export const OTP_MAX_ATTEMPTS = 3;

export interface ResendCheckResult {
  /** Whether the resend is allowed. */
  allowed: boolean;
  /** How many resends remain in the current window (only meaningful when allowed). */
  remaining: number;
  /** Seconds until the oldest request in the window expires (only meaningful when blocked). */
  retryAfterSeconds: number;
  /** True when Redis was unavailable and the caller should apply DB-level fallback. */
  redisUnavailable?: boolean;
}

/**
 * Manages per-user OTP rate-limit state using a Redis sliding window.
 * Falls back to a simple DB-level counter when Redis is unavailable.
 *
 * Redis key: `otp:resend:<email>`
 * Value: JSON array of ISO timestamp strings representing each resend event.
 * TTL: OTP_RESEND_WINDOW_MS (auto-expires stale windows).
 */
@Injectable()
export class OtpRateLimitService {
  private readonly logger = new Logger(OtpRateLimitService.name);

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private readonly cache: Cache | null,
  ) {}

  // ── Sliding-window resend check ──────────────────────────────────────────

  /**
   * Check whether a resend is allowed for the given email.
   * Records the new resend timestamp if allowed.
   */
  async checkAndRecordResend(email: string): Promise<ResendCheckResult> {
    if (!this.cache) {
      // Redis unavailable — caller must use DB-level counter fallback
      this.logger.warn('Cache unavailable; OTP resend rate-limit falling back to DB counter');
      return { allowed: true, remaining: OTP_RESEND_LIMIT - 1, retryAfterSeconds: 0, redisUnavailable: true };
    }

    const key = this.buildKey(email);
    const now = Date.now();
    const windowStart = now - OTP_RESEND_WINDOW_MS;

    // Load existing timestamps
    let timestamps: number[] = await this.loadTimestamps(key);

    // Evict entries outside the sliding window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= OTP_RESEND_LIMIT) {
      // Oldest entry determines when the window opens up
      const oldestTs = Math.min(...timestamps);
      const retryAfterMs = oldestTs + OTP_RESEND_WINDOW_MS - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      this.logger.warn(
        `OTP resend rate-limit exceeded for ${email}: ${timestamps.length}/${OTP_RESEND_LIMIT} in window`,
      );

      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    // Record this resend
    timestamps.push(now);
    await this.saveTimestamps(key, timestamps);

    return {
      allowed: true,
      remaining: OTP_RESEND_LIMIT - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Clear the sliding-window state for a user (e.g. after successful verification).
   */
  async clearResendWindow(email: string): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.del(this.buildKey(email));
    } catch (err) {
      this.logger.warn(`Failed to clear OTP resend window for ${email}: ${err}`);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildKey(email: string): string {
    return `otp:resend:${email}`;
  }

  private async loadTimestamps(key: string): Promise<number[]> {
    try {
      const raw = await this.cache!.get<string>(key);
      if (!raw) return [];
      return JSON.parse(raw) as number[];
    } catch (err) {
      this.logger.warn(`Failed to load OTP timestamps from cache: ${err}`);
      return [];
    }
  }

  private async saveTimestamps(key: string, timestamps: number[]): Promise<void> {
    try {
      // TTL = window duration so Redis auto-cleans stale keys
      await this.cache!.set(key, JSON.stringify(timestamps), OTP_RESEND_WINDOW_MS);
    } catch (err) {
      this.logger.warn(`Failed to save OTP timestamps to cache: ${err}`);
    }
  }
}
