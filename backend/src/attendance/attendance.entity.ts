import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum AttendanceAction {
  CLOCK_IN = 'clock_in',
  CLOCK_OUT = 'clock_out',
}

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: AttendanceAction })
  action!: AttendanceAction;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @Column({ nullable: true })
  hubId?: string;

  @Column({ default: false })
  autoCompleted: boolean = false;

  @Column({ nullable: true })
  autoCompletedReason?: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
