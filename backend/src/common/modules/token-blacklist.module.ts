import { Module } from '@nestjs/common';
import { TokenBlacklistService } from '../../auth/token-blacklist.service';

/**
 * Shared module that exposes TokenBlacklistService to any module that needs it
 * without creating circular dependencies (e.g. UsersModule ↔ AuthModule).
 *
 * CacheModule is registered globally in AppModule, so no need to import it here.
 */
@Module({
  providers: [TokenBlacklistService],
  exports: [TokenBlacklistService],
})
export class TokenBlacklistModule {}
