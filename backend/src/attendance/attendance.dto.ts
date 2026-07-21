import { IsOptional, IsObject, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IANAZone } from 'luxon';
import { IsIANATimezone } from '../common/validators/is-iana-timezone.validator';

export class ClockInDto {
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

export class ClockOutDto {
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

/**
 * Utility used by AttendanceService to validate IANA timezone strings
 * independently of the class-validator pipeline (e.g. in unit tests).
 */
export function isValidIANAZone(tz: string): boolean {
  return IANAZone.isValidZone(tz);
}

export class AttendanceSummaryQueryDto {
  @ApiPropertyOptional({
    description:
      'IANA timezone name for bucketing (e.g. "America/New_York", "Europe/London"). Defaults to UTC.',
    example: 'America/New_York',
    default: 'UTC',
  })
  @IsOptional()
  @IsIANATimezone()
  timezone?: string = 'UTC';

  @ApiPropertyOptional({
    description: 'Aggregation period',
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: 'daily' | 'weekly' | 'monthly' = 'daily';

  @ApiPropertyOptional({
    description: 'Start of the reporting window (ISO 8601). Defaults to 30 days ago.',
    example: '2026-05-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End of the reporting window (ISO 8601). Defaults to now.',
    example: '2026-05-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
