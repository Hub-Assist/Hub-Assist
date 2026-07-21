import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreatePriceRuleDto {
  @ApiProperty({ description: 'Workspace ID this rule applies to' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({
    description: 'ISO day-of-week: 0 = Sunday, 1 = Monday … 6 = Saturday',
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ description: 'Inclusive start hour (0–23)', minimum: 0, maximum: 23 })
  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @ApiProperty({ description: 'Exclusive end hour (1–24)', minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  endHour!: number;

  @ApiProperty({ description: 'Rate per hour in USD when this rule applies', example: 25.0 })
  @IsNumber()
  @IsPositive()
  ratePerHour!: number;

  @ApiPropertyOptional({ description: 'Human-readable label, e.g. "Peak" or "Off-Peak"' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Whether the rule is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePriceRuleDto extends PartialType(CreatePriceRuleDto) {}

/** Snapshot stored on Booking.appliedRateSnapshot (JSONB) */
export interface RateSegment {
  /** Rule ID that was applied, or "fallback" when workspace.pricePerHour was used */
  ruleId: string;
  label: string;
  startTime: string; // ISO
  endTime: string; // ISO
  hours: number;
  ratePerHour: number;
  segmentCost: number;
}

export interface RateSnapshot {
  segments: RateSegment[];
  totalAmount: number;
  userTier: string;
  tierDiscount: number; // fraction, e.g. 0.1 = 10 %
  calculatedAt: string; // ISO
}
