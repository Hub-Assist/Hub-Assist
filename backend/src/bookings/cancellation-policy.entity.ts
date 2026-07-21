import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkspaceType } from '../workspaces/workspace.entity';

/**
 * Defines the refund policy for a given workspace type.
 *
 * Refund brackets (evaluated in order):
 *  1. If hoursBeforeStart >= fullRefundHoursBefore  → 100% refund
 *  2. If hoursBeforeStart >= partialRefundHoursBefore → partialRefundPercent% refund
 *  3. Otherwise                                       → 0% refund (no refund)
 *
 * Default fallback (when no policy is configured for a workspace type):
 *  - Full refund if cancelled > 24 h before start
 *  - No refund otherwise
 */
@Entity('cancellation_policies')
export class CancellationPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The workspace type this policy applies to.
   * One policy per workspace type (enforced at the service layer).
   */
  @Column({ type: 'enum', enum: WorkspaceType, unique: true })
  workspaceType!: WorkspaceType;

  /**
   * Hours before booking start that qualify for a full (100%) refund.
   * E.g. 24 means "cancel at least 24 h before start → full refund".
   */
  @Column({ type: 'int' })
  fullRefundHoursBefore!: number;

  /**
   * Percentage (0–100) refunded in the partial-refund window.
   * E.g. 50 means "50% of totalAmount is refunded".
   */
  @Column({ type: 'int' })
  partialRefundPercent!: number;

  /**
   * Hours before booking start that qualify for a partial refund.
   * Must be < fullRefundHoursBefore.
   * E.g. 2 means "cancel between 2 h and 24 h before start → partial refund".
   */
  @Column({ type: 'int' })
  partialRefundHoursBefore!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
