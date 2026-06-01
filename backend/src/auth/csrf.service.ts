import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Generate a new CSRF token and store it in cache.
   * Tokens are stored per user session (jti) to prevent fixation attacks.
   */
  async generateToken(jti: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    // Store token in cache with 1 hour TTL
    await this.cacheManager.set(`csrf:${jti}`, token, 3600000);
    return token;
  }

  /**
   * Verify a CSRF token against the stored token for the user session.
   * Returns true if valid, false otherwise.
   */
  async verifyToken(jti: string, token: string): Promise<boolean> {
    if (!token || !jti) return false;
    const storedToken = await this.cacheManager.get<string>(`csrf:${jti}`);
    return storedToken === token;
  }

  /**
   * Invalidate the CSRF token for a user session (e.g., on logout).
   */
  async invalidateToken(jti: string): Promise<void> {
    await this.cacheManager.del(`csrf:${jti}`);
  }
}
