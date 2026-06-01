import { IsString, IsDateString, IsNumber, IsOptional, IsEnum, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeString } from '../common/transformers/sanitize-string.transformer';
import { AtLeastOneField } from '../common/validators/at-least-one-field.validator';
import { BookingStatus } from './booking.entity';

export class CreateBookingDto {
  @SanitizeString()
  @IsString()
  workspaceId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @SanitizeString()
  @IsString()
  stellarTxHash?: string;

  /**
   * Optional RFC 5545 RRULE string to create a recurring series.
   * Examples:
   *   - Weekly for 4 weeks:    "FREQ=WEEKLY;COUNT=4"
   *   - Biweekly for 6 months: "FREQ=WEEKLY;INTERVAL=2;UNTIL=20251231T000000Z"
   *   - Monthly for 3 months:  "FREQ=MONTHLY;COUNT=3"
   *
   * Maximum 52 instances per series. The DTSTART is derived from `startTime`.
   */
  @ApiPropertyOptional({
    description:
      'RFC 5545 RRULE string for recurring bookings. Max 52 instances. ' +
      'Examples: "FREQ=WEEKLY;COUNT=4", "FREQ=MONTHLY;COUNT=3"',
    example: 'FREQ=WEEKLY;COUNT=4',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(RRULE:)?FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i, {
    message: 'recurrenceRule must be a valid RFC 5545 RRULE string starting with FREQ=',
  })
  recurrenceRule?: string;
}

@AtLeastOneField({ message: 'At least one field must be provided in PATCH request' })
export class UpdateBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @SanitizeString()
  @IsString()
  stellarTxHash?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;
}
