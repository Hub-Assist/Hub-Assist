import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'uuid' })
  confirmationToken: string;

  @Column({ default: false })
  isConfirmed: boolean;

  @Column({ type: 'uuid' })
  unsubscribeToken: string;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  subscribedAt: Date;

  @Column({ nullable: true })
  confirmedAt: Date;
}
