import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceType } from '../../workspaces/workspace.entity';

export class OccupancyQueryDto {
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
    example: WorkspaceType.MEETING_ROOM,
  })
  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;
}
