import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  STAFF = 'staff',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

   @Column({ default: false })
   isVerified: boolean;

   @Column({ nullable: true })
   profilePicture?: string;

   @CreateDateColumn()
   createdAt!: Date;

   @DeleteDateColumn({ nullable: true })
   deletedAt?: Date;
}
