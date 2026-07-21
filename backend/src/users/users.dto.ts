import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { SanitizeString } from '../common/transformers/sanitize-string.transformer';
import { AtLeastOneField } from '../common/validators/at-least-one-field.validator';
import { UserRole } from './user.entity';

@AtLeastOneField({ message: 'At least one field must be provided in PATCH request' })
export class UpdateUserDto {
  @IsOptional()
  @SanitizeString()
  @IsString()
  firstName?: string;

  @IsOptional()
  @SanitizeString()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
