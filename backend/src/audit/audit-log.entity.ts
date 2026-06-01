import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum EventCategory {
  BOOKING = 'BOOKING',
  USER = 'USER',
  WORKSPACE = 'WORKSPACE',
  AUTH = 'AUTH',
  SYSTEM = 'SYSTEM',
}

@Entity('audit_logs')
@Index('idx_audit_logs_resource_created_at', ['resourceType', 'createdAt'])
@Index('idx_audit_logs_actor_created_at', ['actorId', 'createdAt'])
@Index('idx_audit_logs_event_category_created_at', ['eventCategory', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  actorId?: string;

  @Column({ nullable: true })
  actorRole?: string;

  @Column()
  eventType: string;

  @Column({
    type: 'enum',
    enum: EventCategory,
    nullable: true,
  })
  eventCategory?: EventCategory;

  @Column()
  resourceType: string;

  @Column()
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, any>;

  @Column({ nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt: Date;
}
