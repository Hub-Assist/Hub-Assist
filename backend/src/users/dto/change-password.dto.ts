import { IsString, Length, Matches } from 'class-validator';
import { NoSanitize } from '../../common/decorators/no-sanitize.decorator';

export class ChangePasswordDto {
  @IsString()
  @NoSanitize()
  currentPassword!: string;

  @IsString()
  @Length(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}
