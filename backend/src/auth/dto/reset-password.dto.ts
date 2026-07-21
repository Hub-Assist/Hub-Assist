import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { NoSanitize } from '../../common/decorators/no-sanitize.decorator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  /**
   * OTP is a 6-digit numeric code — must not be altered by the sanitization
   * pipeline, as any modification would cause verification failure.
   */
  @NoSanitize()
  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @Length(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}
