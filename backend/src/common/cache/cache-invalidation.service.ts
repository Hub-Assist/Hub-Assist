import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheInvalidationService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Invalidate dashboard cache keys when data changes.
   * Called when bookings or members are created/updated.
   */
  async invalidateDashboardCache(): Promise<void> {
    await Promise.all([
      this.cacheManager.del('dashboard:stats'),
      this.cacheManager.del('dashboard:growth'),
      this.cacheManager.del('dashboard:admin-stats'),
    ]);
  }
}
