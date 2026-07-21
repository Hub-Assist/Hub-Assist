import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Configurable spam keyword stored in the database.
 * Admins can add/remove keywords without a code deploy.
 */
@Entity('spam_keywords')
export class SpamKeyword {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The keyword or phrase to match (case-insensitive) */
  @Column({ unique: true })
  keyword!: string;

  /** Weight contribution to the spam score [0, 1] */
  @Column({ type: 'float', default: 0.2 })
  weight!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
