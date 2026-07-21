import { IsString } from 'class-validator';
import { NoSanitize } from '../../common/decorators/no-sanitize.decorator';

export class RefreshTokenDto {
  /**
   * Refresh tokens are UUIDs — must not be trimmed or altered by the
   * sanitization pipeline, as any modification would invalidate the token.
   */
  @NoSanitize()
  @IsString()
  refreshToken!: string;
}
