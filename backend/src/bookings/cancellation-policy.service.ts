import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CancellationPolicy } from './cancellation-policy.entity';
import { Booking } from './booking.entity';
import { WorkspaceType } from '../workspaces/workspace.entity';
import {
  CreateCancellationPolicyDto,
  UpdateCancellationPolicyDto,
} from './cancellation-policy.dto';

export interface RefundEvaluation {
  /** Monetary amount to refund (0 if no refund). */
  refundAmount: number;
  /** Percentage of totalAmount refunded (0, partial, or 100). */
  refundPercent: number;
  /** Human-readable explanation of the refund decision. */
  reason: string;
}

/**
 * Default policy applied when no CancellationPolicy row exists for a workspace type.
 *  - Full refund if cancelled > 24 h before start
 *  - No refund otherwise
 */
const DEFAULT_POLICY = {
  fullRefundHoursBefore: 24,
  partialRefundPercent: 0,
  partialRefundHoursBefore: 0,
} as const;

@Injectable()
export class CancellationPolicyService {
  constructor(
    @InjectRepository(CancellationPolicy)
    private readonly policyRepo: Repository<CancellationPolicy>,
  ) {}

  // ── Refund evaluation ──────────────────────────────────────────────────────

  /**
   * Evaluates the refund for a booking being cancelled at `cancelledAt`.
   *
   * Policy is evaluated against `booking.startTime`, NOT `booking.createdAt`.
   * Policy changes do NOT retroactively affect existing bookings — the policy
   * is fetched at cancellation time but the booking's own totalAmount is used
   * as the base for calculation.
   *
   * @param booking     - The booking being cancelled (must have workspace relation loaded)
   * @param cancelledAt - The moment of cancellation (defaults to now)
   */
  async evaluateRefund(
    booking: Booking,
    cancelledAt: Date = new Date(),
  ): Promise<RefundEvaluation> {
    const workspaceType = booking.workspace?.type;

    // Load the configured policy for this workspace type (may be undefined)
    const policy = workspaceType
      ? await this.policyRepo.findOne({ where: { workspaceType } })
      : null;

    const effective = policy ?? DEFAULT_POLICY;

    const hoursBeforeStart =
      (booking.startTime.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);

    const totalAmount = Number(booking.totalAmount);

    // Bracket 1: Full refund
    if (hoursBeforeStart >= effective.fullRefundHoursBefore) {
      return {
        refundAmount: totalAmount,
        refundPercent: 100,
        reason: `Cancelled ${hoursBeforeStart.toFixed(1)} h before start — full refund (threshold: ${effective.fullRefundHoursBefore} h).`,
      };
    }

    // Bracket 2: Partial refund
    if (
      effective.partialRefundPercent > 0 &&
      hoursBeforeStart >= effective.partialRefundHoursBefore
    ) {
      const refundAmount = Number(
        ((totalAmount * effective.partialRefundPercent) / 100).toFixed(2),
      );
      return {
        refundAmount,
        refundPercent: effective.partialRefundPercent,
        reason:
          `Cancelled ${hoursBeforeStart.toFixed(1)} h before start — ` +
          `${effective.partialRefundPercent}% partial refund ` +
          `(threshold: ${effective.partialRefundHoursBefore} h).`,
      };
    }

    // Bracket 3: No refund
    return {
      refundAmount: 0,
      refundPercent: 0,
      reason: `Cancelled ${hoursBeforeStart.toFixed(1)} h before start — no refund (below minimum threshold).`,
    };
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async findAll(): Promise<CancellationPolicy[]> {
    return this.policyRepo.find();
  }

  async findByWorkspaceType(
    workspaceType: WorkspaceType,
  ): Promise<CancellationPolicy> {
    const policy = await this.policyRepo.findOne({ where: { workspaceType } });
    if (!policy) {
      throw new NotFoundException(
        `No cancellation policy found for workspace type "${workspaceType}".`,
      );
    }
    return policy;
  }

  async create(dto: CreateCancellationPolicyDto): Promise<CancellationPolicy> {
    const policy = this.policyRepo.create(dto);
    return this.policyRepo.save(policy);
  }

  async update(
    workspaceType: WorkspaceType,
    dto: UpdateCancellationPolicyDto,
  ): Promise<CancellationPolicy> {
    const policy = await this.findByWorkspaceType(workspaceType);
    Object.assign(policy, dto);
    return this.policyRepo.save(policy);
  }

  async remove(workspaceType: WorkspaceType): Promise<void> {
    const policy = await this.findByWorkspaceType(workspaceType);
    await this.policyRepo.remove(policy);
  }
}
