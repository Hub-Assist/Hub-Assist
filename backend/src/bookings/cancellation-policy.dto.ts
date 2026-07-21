import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceType } from '../workspaces/workspace.entity';

/**
 * DTO for creating a new cancellation policy.
 *
 * ## Refund Brackets
 *
 * Evaluated in order against `hoursBeforeStart = booking.startTime - cancelledAt`:
 *
 * | Condition | Refund |
 * |-----------|--------|
 * | `hoursBeforeStart >= fullRefundHoursBefore` | 100% of `totalAmount` |
 * | `hoursBeforeStart >= partialRefundHoursBefore` | `partialRefundPercent`% of `totalAmount` |
 * | Otherwise | 0% (no refund) |
 *
 * ### Formula
 * ```
 * refundAmount = totalAmount × (refundPercent / 100)
 * ```
 *
 * ### Default fallback (no policy configured)
 * - Full refund if cancelled > 24 h before start
 * - No refund otherwise
 */
export class CreateCancellationPolicyDto {
  @ApiProperty({
    enum: WorkspaceType,
    description: 'Workspace type this policy applies to (one policy per type)',
    example: WorkspaceType.MEETING_ROOM,
  })
  @IsEnum(WorkspaceType)
  workspaceType!: WorkspaceType;

  @ApiProperty({
    description:
      'Hours before booking start that qualify for a full (100%) refund',
    example: 24,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  fullRefundHoursBefore!: number;

  @ApiProperty({
    description: 'Percentage (0–100) refunded in the partial-refund window',
    example: 50,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  partialRefundPercent!: number;

  @ApiProperty({
    description:
      'Hours before booking start that qualify for a partial refund. Must be less than fullRefundHoursBefore.',
    example: 2,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @ValidateIf((o) => o.partialRefundPercent > 0)
  partialRefundHoursBefore!: number;
}

export class UpdateCancellationPolicyDto {
  @ApiPropertyOptional({
    description: 'Hours before start for full refund',
    example: 48,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  fullRefundHoursBefore?: number;

  @ApiPropertyOptional({
    description: 'Partial refund percentage (0–100)',
    example: 25,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  partialRefundPercent?: number;

  @ApiPropertyOptional({
    description: 'Hours before start for partial refund',
    example: 4,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  partialRefundHoursBefore?: number;
}
