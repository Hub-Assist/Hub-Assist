import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('daily_utilization_snapshots')
@Index('idx_utilization_date_workspace', ['date', 'workspaceId'], { unique: true })
@Index('idx_utilization_date', ['date'])
export class DailyUtilizationSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column('uuid')
  workspaceId: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceType?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  bookedHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  availableHours: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  occupancyRate: number; // percentage 0-100

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
