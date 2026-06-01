import { IsString, IsEnum, IsNumber, IsOptional, IsArray, IsBoolean, ValidateIf } from 'class-validator';
import { SanitizeString } from '../common/transformers/sanitize-string.transformer';
import { AtLeastOneField } from '../common/validators/at-least-one-field.validator';
import { WorkspaceType, WorkspaceAvailability } from './workspace.entity';

export class CreateWorkspaceDto {
  @SanitizeString()
  @IsString()
  name: string;

  @IsEnum(WorkspaceType)
  type: WorkspaceType;

  @IsNumber()
  capacity: number;

  @IsNumber()
  pricePerHour: number;

  @IsEnum(WorkspaceAvailability)
  availability: WorkspaceAvailability;

  @IsOptional()
  @SanitizeString()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];
}

@AtLeastOneField({ message: 'At least one field must be provided in PATCH request' })
export class UpdateWorkspaceDto {
  @IsOptional()
  @SanitizeString()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(WorkspaceType)
  type?: WorkspaceType;

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  pricePerHour?: number;

  @IsOptional()
  @IsEnum(WorkspaceAvailability)
  availability?: WorkspaceAvailability;

  @IsOptional()
  @ValidateIf((o) => o.availability !== undefined)
  @IsString()
  availabilityReason?: string;

  @IsOptional()
  @SanitizeString()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
