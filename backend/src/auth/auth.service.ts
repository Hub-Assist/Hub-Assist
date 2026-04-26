import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { EmailService } from './email.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { ForgotPasswordProvider } from '../users/providers/forgot-password.provider';
import { ResetPasswordProvider } from '../users/providers/reset-password.provider';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private refreshTokenRepository: RefreshTokenRepository,
    private forgotPasswordProvider: ForgotPasswordProvider,
    private resetPasswordProvider: ResetPasswordProvider,
  ) {}

  private generateOtp(): string {
    return randomBytes(3).readUIntBE(0, 3).toString().slice(-6).padStart(6, '0');
  }

  private async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  private async verifyOtp(otp: string, hash: string): Promise<boolean> {
    return bcrypt.compare(otp, hash);
  }

  private generateRefreshToken(): string {
    return randomUUID();
  }

  private async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  async register(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await this.usersService.create({
      email,
      passwordHash,
      otp: otpHash,
      otpExpiry,
    });

    // Send OTP email (non-blocking)
    this.emailService.sendVerificationOtp(email, otp).catch(err => {
      console.error('Failed to send OTP email:', err);
    });

    return { message: 'User registered. Check your email for OTP.' };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.otp || !user.otpExpiry) {
      throw new BadRequestException('No OTP found for this user');
    }

    if (new Date() > user.otpExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    const isValid = await this.verifyOtp(otp, user.otp);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.usersService.update(user.id, {
      isVerified: true,
      otp: null,
      otpExpiry: null,
    });

    return { message: 'Email verified successfully' };
  }

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Rate limit: only resend if previous OTP is expired or doesn't exist
    if (user.otp && user.otpExpiry && new Date() < user.otpExpiry) {
      throw new BadRequestException('OTP already sent. Please wait before requesting a new one.');
    }

    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.update(user.id, {
      otp: otpHash,
      otpExpiry,
    });

    this.emailService.sendVerificationOtp(email, otp).catch(err => {
      console.error('Failed to send OTP email:', err);
    });

    return { message: 'OTP resent to your email' };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = await this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.refreshTokenRepository.create(user.id, refreshTokenHash, expiresAt);

    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email, role: user.role }),
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const tokenRecord = await this.refreshTokenRepository.findByToken(refreshToken);

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersService.findById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old token
    await this.refreshTokenRepository.revokeToken(tokenRecord.id);

    // Issue new refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newRefreshTokenHash = await this.hashRefreshToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.create(user.id, newRefreshTokenHash, expiresAt);

    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email, role: user.role }),
      refresh_token: newRefreshToken,
    };
  }

  async logout(userId: string) {
    await this.refreshTokenRepository.revokeAllUserTokens(userId);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Always return generic success message to prevent enumeration
    const response = { message: 'If an account exists, a password reset OTP has been sent to the email.' };

    if (!user) {
      return response;
    }

    const otp = this.forgotPasswordProvider.generateOtp();
    const otpHash = await this.forgotPasswordProvider.hashOtp(otp);
    const otpExpiry = this.forgotPasswordProvider.getOtpExpiry();

    await this.usersService.update(user.id, {
      otp: otpHash,
      otpExpiry,
    });

    this.emailService.sendPasswordResetOtp(email, otp).catch(err => {
      console.error('Failed to send password reset OTP:', err);
    });

    return response;
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.otp || !user.otpExpiry) {
      throw new BadRequestException('No password reset request found');
    }

    if (new Date() > user.otpExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    const isValid = await this.resetPasswordProvider.verifyOtp(otp, user.otp);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP');
    }

    if (!this.resetPasswordProvider.validatePasswordStrength(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and contain uppercase, lowercase, and numbers',
      );
    }

    const passwordHash = await this.resetPasswordProvider.hashPassword(newPassword);

    await this.usersService.update(user.id, {
      passwordHash,
      otp: null,
      otpExpiry: null,
    });

    this.emailService.sendPasswordResetSuccess(email).catch(err => {
      console.error('Failed to send password reset success email:', err);
    });

    return { message: 'Password reset successfully' };
  }
}
