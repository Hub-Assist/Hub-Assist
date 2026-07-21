import { IsEmail, IsString, Length } from 'class-validator';
import { NoSanitize } from '../../common/decorators/no-sanitize.decorator';

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  /**
   * OTP is a 6-digit numeric code — must not be trimmed or altered by the
   * sanitization pipeline, as any modification would cause verification failure.
   */
  @NoSanitize()
  @IsString()
  @Length(6, 6)
  otp!: string;
}
