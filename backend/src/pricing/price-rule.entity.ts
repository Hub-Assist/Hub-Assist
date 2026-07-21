import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Represents a time-based pricing rule for a workspace.
 *
 * Rules are matched by dayOfWeek + hour range. Multiple rules can exist per
 * workspace (e.g. peak vs off-peak). When a booking spans multiple rules the
 * PricingEngineService calculates a blended rate proportional to the time
 * spent in each rule's window.
 *
 * Validation invariant (enforced at the service layer):
 *   - No two active rules for the same workspace/dayOfWeek may overlap in
 *     [startHour, endHour).
 *   - startHour must be < endHour.
 *   - Hours are integers in [0, 24].
 */
@Entity('price_rules')
@Index(['workspaceId', 'dayOfWeek'])
export class PriceRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** FK to workspaces.id – not a TypeORM relation to keep PricingEngine pure */
  @Column()
  workspaceId!: string;

  /**
   * ISO day-of-week: 0 = Sunday … 6 = Saturday.
   * Matches JavaScript's Date.prototype.getDay().
   */
  @Column({ type: 'smallint' })
  dayOfWeek!: number;

  /** Inclusive start hour in local time [0, 23] */
  @Column({ type: 'smallint' })
  startHour!: number;

  /** Exclusive end hour in local time [1, 24] */
  @Column({ type: 'smallint' })
  endHour!: number;

  /** Rate charged per hour when this rule applies */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  ratePerHour!: number;

  /** Human-readable label, e.g. "Peak", "Off-Peak", "Weekend" */
  @Column({ nullable: true })
  label?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
