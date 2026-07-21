import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * TokenBlacklistService
 *
 * Stores revoked JWT IDs (jti) in Redis with a TTL that matches the token's
 * remaining lifetime. A single Redis GET is used per request — no list scans.
 *
 * Key format:  blacklist:jti:<jti>
 * Value:       '1'  (presence is the signal; value is irrelevant)
 * TTL:         seconds until the access token would naturally expire
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly KEY_PREFIX = 'blacklist:jti:';

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Add a jti to the blacklist.
   *
   * @param jti   The JWT ID claim (UUID v4) to revoke.
   * @param ttlMs Remaining token lifetime in **milliseconds**.
   *              The Redis entry will expire at the same moment the token would.
   */
  async blacklistToken(jti: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) {
      // Token is already expired — nothing to blacklist.
      return;
    }

    const key = `${this.KEY_PREFIX}${jti}`;
    // cache-manager v5 uses milliseconds for TTL
    await this.cacheManager.set(key, '1', ttlMs);
    this.logger.debug(`Blacklisted jti=${jti} for ${ttlMs}ms`);
  }

  /**
   * Check whether a jti has been revoked.
   *
   * This is a single Redis GET — O(1), no list scans.
   *
   * @param jti The JWT ID claim to check.
   * @returns   `true` if the token has been revoked, `false` otherwise.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const key = `${this.KEY_PREFIX}${jti}`;
    const value = await this.cacheManager.get<string>(key);
    return value !== null && value !== undefined;
  }
}
