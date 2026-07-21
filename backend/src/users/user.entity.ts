import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';
import { ProfilePictureUrls } from '../cloudinary/cloudinary.service';

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  STAFF = 'staff',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role!: UserRole;

  @Column({ nullable: true })
  stellarPublicKey?: string;

  // OTP fields for verification and password reset
  @Column({ nullable: true })
  otp?: string;

  @Column({ type: 'timestamp', nullable: true })
  otpExpiry?: Date;

  @Column({ default: 0 })
  otpAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  otpInvalidatedAt?: Date;

  @Column({ default: 0 })
  otpResendCount!: number;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  /**
   * @deprecated Use `profilePictureUrls` instead.
   * Kept for backward compatibility – returns the avatar variant URL when
   * `profilePictureUrls` is set, otherwise the original single URL.
   */
  @Column({ nullable: true })
  profilePicture?: string;

  /**
   * Multi-resolution profile picture URLs stored as JSONB.
   *
   * Keys:
   *  - thumbnail : 50×50  – use for comment avatars, notification icons
   *  - avatar    : 200×200 – use for profile headers, user cards
   *  - full      : 800×800 – use for profile detail pages
   */
  @Column({ type: 'jsonb', nullable: true })
  profilePictureUrls?: ProfilePictureUrls;

  /**
   * Cloudinary public ID for the profile picture.
   * Used for deletion when user is deleted or picture is replaced.
   */
  @Column({ nullable: true })
  profilePicturePublicId?: string;

  @Column({ default: false })
  totpEnabled: boolean;

  @Column({ nullable: true })
  totpSecret?: string;

  @Column({ type: 'simple-array', nullable: true })
  backupCodes?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
