import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { UserRole } from '../user.entity';

export class UserSearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit: number = 20;
}
