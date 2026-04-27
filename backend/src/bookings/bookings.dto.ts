import { IsString, IsDateString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { SanitizeString } from '../common/transformers/sanitize-string.transformer';
import { BookingStatus } from './booking.entity';

export class CreateBookingDto {
  @SanitizeString()
  @IsString()
  workspaceId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @SanitizeString()
  @IsString()
  stellarTxHash?: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @SanitizeString()
  @IsString()
  stellarTxHash?: string;
}
