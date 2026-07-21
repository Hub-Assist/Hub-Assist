import { IsOptional, IsDateString, IsEnum, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../../bookings/booking.entity';
import { WorkspaceType } from '../../workspaces/workspace.entity';

export type GroupBy = 'day' | 'week' | 'month';

export class RevenueQueryDto {
  @ApiPropertyOptional({
    description: 'Start of the date range (ISO 8601). Defaults to 30 days ago.',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End of the date range (ISO 8601). Defaults to today.',
    example: '2024-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by workspace type.',
    enum: WorkspaceType,
    example: WorkspaceType.HOT_DESK,
  })
  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;

  @ApiPropertyOptional({
    description: 'Filter by booking status.',
    enum: BookingStatus,
    example: BookingStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Aggregation granularity: day, week, or month.',
    enum: ['day', 'week', 'month'],
    default: 'day',
    example: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: GroupBy = 'day';
}
