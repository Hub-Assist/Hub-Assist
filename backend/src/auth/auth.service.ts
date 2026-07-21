import { Injectable, UnauthorizedException, BadRequestException, TooManyRequestsException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { EmailService } from './email.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { ForgotPasswordProvider } from '../users/providers/forgot-password.provider';
import { ResetPasswordProvider } from '../users/providers/reset-password.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpRateLimitService, OTP_MAX_ATTEMPTS, OTP_RESEND_LIMIT } from './otp-rate-limit.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { PasswordPolicyService } from './password-policy/password-policy.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private refreshTokenRepository: RefreshTokenRepository,
    private forgotPasswordProvider: ForgotPasswordProvider,
    private resetPasswordProvider: ResetPasswordProvider,
    private notificationsService: NotificationsService,
    private otpRateLimitService: OtpRateLimitService,
    private tokenBlacklistService: TokenBlacklistService,
    private passwordPolicyService: PasswordPolicyService,
  ) {}

  private generateOtp(): string {
    return randomBytes(3).readUIntBE(0, 3).toString().slice(-6).padStart(6, '0');
  }

  private async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  private async verifyOtpHash(otp: string, hash: string): Promise<boolean> {
    return bcrypt.compare(otp, hash);
  }

  private generateRefreshToken(): string {
    return randomUUID();
  }

  private async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  private validatePasswordStrength(password: string): boolean {
    // At least 8 characters, at least one uppercase, one lowercase, and one digit
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  }

  /**
   * Sign an access token with a unique jti (UUID v4).
   * The jti is embedded in the payload so it can be blacklisted on logout.
   */
  private signAccessToken(payload: { sub: string; email: string; role: string }): string {
    return this.jwtService.sign({ ...payload, jti: randomUUID() });
  }

  /**
   * Blacklist the access token identified by `jti`.
   * `exp` is the Unix timestamp (seconds) when the token expires.
   */
  async blacklistAccessToken(jti: string, exp: number): Promise<void> {
    const nowMs = Date.now();
    const expMs = exp * 1000;
    const remainingMs = expMs - nowMs;
    await this.tokenBlacklistService.blacklistToken(jti, remainingMs);
  }

  async register(email: string, password: string, firstName?: string, lastName?: string) {
    const policyResult = await this.passwordPolicyService.validate(password);
    if (!policyResult.valid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        violations: policyResult.violations,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await this.usersService.create({
      email,
      passwordHash,
      otp: otpHash,
      otpExpiry,
      firstName,
      lastName,
    });

    // Send OTP email (non-blocking)
    this.emailService.sendVerificationOtp(email, otp).catch(err => {
      console.error('Failed to send OTP email:', err);
    });

    // Notify admins of new member registration
    this.notificationsService.sendToAll('member:registered', { email, userId: user.id });

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

    // Reject if the OTP was already invalidated by too many wrong guesses
    if (user.otpInvalidatedAt) {
      throw new BadRequestException({
        message: 'OTP has been invalidated due to too many wrong attempts. Please request a new OTP.',
        attemptsRemaining: 0,
      });
    }

    if (new Date() > user.otpExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    const isValid = await this.verifyOtpHash(otp, user.otp);

    if (!isValid) {
      const newAttempts = (user.otpAttempts ?? 0) + 1;
      const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - newAttempts);

      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        // Invalidate the OTP — brute-force threshold reached
        await this.usersService.update(user.id, {
          otpAttempts: newAttempts,
          otpInvalidatedAt: new Date(),
        });
        throw new BadRequestException({
          message: 'OTP has been invalidated due to too many wrong attempts. Please request a new OTP.',
          attemptsRemaining: 0,
        });
      }

      // Record the failed attempt
      await this.usersService.update(user.id, { otpAttempts: newAttempts });

      throw new BadRequestException({
        message: 'Invalid OTP',
        attemptsRemaining,
      });
    }

    // Successful verification — clear all OTP state
    await this.usersService.update(user.id, {
      isVerified: true,
      otp: undefined,
      otpExpiry: undefined,
      otpAttempts: 0,
      otpInvalidatedAt: undefined,
      otpResendCount: 0,
    });

    // Clear the Redis sliding window for this user
    await this.otpRateLimitService.clearResendWindow(email);

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = await this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.create(user.id, refreshTokenHash, expiresAt);

    return {
      access_token: this.signAccessToken({ sub: user.id, email: user.email, role: user.role }),
      refresh_token: refreshToken,
    };
  }

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // ── Sliding-window rate limit (Redis primary, DB fallback) ──────────────
    const rateLimitResult = await this.otpRateLimitService.checkAndRecordResend(email);

    if (!rateLimitResult.allowed) {
      throw new TooManyRequestsException({
        message: `Too many OTP resend requests. Please wait ${rateLimitResult.retryAfterSeconds} seconds before trying again.`,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      });
    }

    // DB-level fallback: if Redis was unavailable, enforce via DB counter
    // (OTP_RESEND_LIMIT resends tracked by otpResendCount, reset on successful verify)
    if (rateLimitResult.redisUnavailable && user.otpResendCount >= OTP_RESEND_LIMIT) {
      throw new TooManyRequestsException({
        message: 'Too many OTP resend requests. Please try again later.',
        retryAfterSeconds: 300,
      });
    }

    // Generate a fresh OTP and reset all attempt counters
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.update(user.id, {
      otp: otpHash,
      otpExpiry,
      otpAttempts: 0,
      otpInvalidatedAt: undefined,
      otpResendCount: (user.otpResendCount ?? 0) + 1,
    });

    this.emailService.sendVerificationOtp(email, otp).catch(err => {
      console.error('Failed to send OTP email:', err);
    });

    return {
      message: 'OTP resent to your email',
      resendsRemaining: rateLimitResult.remaining,
    };
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
      access_token: this.signAccessToken({ sub: user.id, email: user.email, role: user.role }),
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
      access_token: this.signAccessToken({ sub: user.id, email: user.email, role: user.role }),
      refresh_token: newRefreshToken,
    };
  }

  async logout(userId: string, jti?: string, exp?: number) {
    await this.refreshTokenRepository.revokeAllUserTokens(userId);

    // Blacklist the current access token so it is rejected immediately,
    // without waiting for its natural expiry.
    if (jti && exp !== undefined) {
      await this.blacklistAccessToken(jti, exp);
    }

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string, jti?: string, exp?: number) {
    // Revoke all refresh tokens for the user
    await this.refreshTokenRepository.revokeAllUserTokens(userId);

    // Blacklist the current access token
    if (jti && exp !== undefined) {
      await this.blacklistAccessToken(jti, exp);
    }

    return { message: 'Logged out from all devices successfully' };
  }

   async forgotPassword(email: string) {
     const user = await this.usersService.findByEmail(email);

     // Always return generic success message to prevent enumeration
     const response = { message: 'If an account exists, a password reset OTP has been sent to the email.' };

     if (!user) {
       return response;
     }

     const otp = this.generateOtp();
     const otpHash = await this.hashOtp(otp);
     const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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

     const isValid = await bcrypt.compare(otp, user.otp);
     if (!isValid) {
       throw new BadRequestException('Invalid OTP');
     }

     const policyResult = await this.passwordPolicyService.validate(newPassword);
     if (!policyResult.valid) {
       throw new BadRequestException({
         message: 'Password does not meet security requirements',
         violations: policyResult.violations,
       });
     }

     const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.usersService.update(user.id, {
      passwordHash,
      otp: undefined,
      otpExpiry: undefined,
    });

     this.emailService.sendPasswordResetSuccess(email).catch(err => {
       console.error('Failed to send password reset success email:', err);
     });

     return { message: 'Password reset successfully' };
   }
}
