import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { User } from '../users/user.entity';
import { RateSnapshot } from '../pricing/pricing.dto';

export enum BookingStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;

  @Column()
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'timestamp' })
  startTime!: Date;

  @Column({ type: 'timestamp' })
  endTime!: Date;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({ nullable: true, default: null })
  stellarTxHash!: string;

  @Column({ nullable: true })
  hubId?: string;

  // ── Recurring booking fields ──────────────────────────────────────────────

  @Column({ nullable: true, type: 'text' })
  recurrenceRule?: string;

  @Column({ nullable: true, type: 'uuid' })
  seriesId?: string;

  @Column({ nullable: true, type: 'int' })
  instanceIndex?: number;

  // ── Cancellation policy fields ────────────────────────────────────────────

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  refundAmount?: number;

  // ── Dynamic pricing snapshot ──────────────────────────────────────────────

  @Column({ type: 'jsonb', nullable: true })
  appliedRateSnapshot?: RateSnapshot;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
