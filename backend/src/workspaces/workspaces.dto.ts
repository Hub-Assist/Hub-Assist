import { IsString, IsEnum, IsNumber, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { WorkspaceType, WorkspaceAvailability } from './workspace.entity';

export class CreateWorkspaceDto {
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
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];
}

export class UpdateWorkspaceDto {
  @IsOptional()
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
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
