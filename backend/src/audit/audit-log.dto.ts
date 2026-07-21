import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';

export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export interface AuditLogEvent {
  actorId?: string;
  actorRole?: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ipAddress?: string;
}
