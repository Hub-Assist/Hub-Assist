import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ContactMessageStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  FLAGGED = 'flagged',
  RESOLVED = 'resolved',
}

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column()
  email!: string;

  @Column()
  subject!: string;

  @Column('text')
  message!: string;

  @Column({ nullable: true })
  ipAddress?: string;

  // ── Spam detection fields ──────────────────────────────────────────────────

  /**
   * Heuristic spam score in [0, 1].
   * Scores > 0.7 are automatically flagged.
   * NOT exposed to submitters via the public API.
   */
  @Column({ type: 'float', default: 0 })
  spamScore!: number;

  /**
   * Array of human-readable flags that contributed to the spam score,
   * e.g. ["HIGH_URL_DENSITY", "SPAM_KEYWORD:buy now"].
   * Stored as JSONB. NOT exposed to submitters.
   */
  @Column({ type: 'jsonb', default: [] })
  spamFlags!: string[];

  @Column({
    type: 'enum',
    enum: ContactMessageStatus,
    default: ContactMessageStatus.PENDING,
  })
  status!: ContactMessageStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
