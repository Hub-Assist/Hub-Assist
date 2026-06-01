import { Module } from '@nestjs/common';
import { CacheInvalidationService } from './cache-invalidation.service';

@Module({
  providers: [CacheInvalidationService],
  exports: [CacheInvalidationService],
})
export class CacheModule {}
