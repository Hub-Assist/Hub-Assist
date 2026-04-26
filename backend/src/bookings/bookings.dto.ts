import { IsString, IsDateString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { BookingStatus } from './booking.entity';

export class CreateBookingDto {
  @IsString()
  workspaceId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsNumber()
  totalAmount: number;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  stellarTxHash?: string;
}
