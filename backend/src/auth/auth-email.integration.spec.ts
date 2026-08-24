/**
 * Integration smoke test proving OTP / password-reset emails are actually
 * dispatched end-to-end: AuthService -> the real EmailService (Nodemailer +
 * Handlebars, backend/src/email/email.service.ts) -> a captured SMTP sink.
 *
 * Uses Nodemailer's built-in JSON transport as the sink so no network I/O
 * or real mail server is required, while still exercising real template
 * rendering and the real MailerService/EmailService call chain — unlike
 * auth.service.spec.ts, which mocks EmailService entirely.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerModule, MailerService } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';
import { SmtpCircuitBreaker } from '../email/smtp-circuit-breaker';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenRepository } from './refresh-token.repository';
import { ForgotPasswordProvider } from '../users/providers/forgot-password.provider';
import { ResetPasswordProvider } from '../users/providers/reset-password.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { PasswordPolicyService } from './password-policy/password-policy.service';
import { LoggerService } from '../common/logger/logger.service';
import { User, UserRole } from '../users/user.entity';

describe('AuthService -> EmailService dispatch (integration smoke test)', () => {
  let authService: AuthService;
  let mailerService: MailerService;

  const mockUser: User = {
    id: 'user-1',
    email: 'smoke@test.com',
    passwordHash: 'hash',
    role: UserRole.MEMBER,
    isVerified: false,
    createdAt: new Date(),
    otpAttempts: 0,
    otpResendCount: 0,
    isActive: true,
    totpEnabled: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MailerModule.forRoot({
          transport: { jsonTransport: true },
          defaults: { from: '"Hub-Assist" <noreply@hub-assist.com>' },
          template: {
            dir: join(__dirname, '../email/templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
          options: {
            partials: {
              dir: join(__dirname, '../email/templates/layouts'),
              options: { strict: true },
            },
          },
        }),
      ],
      providers: [
        AuthService,
        EmailService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        {
          provide: SmtpCircuitBreaker,
          useValue: {
            isOpen: jest.fn().mockResolvedValue(false),
            recordSuccess: jest.fn().mockResolvedValue(undefined),
            recordFailure: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UsersService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockUser),
            findByEmail: jest.fn().mockResolvedValue(mockUser),
            update: jest.fn().mockResolvedValue(mockUser),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
        { provide: RefreshTokenRepository, useValue: { create: jest.fn().mockResolvedValue(undefined) } },
        { provide: ForgotPasswordProvider, useValue: {} },
        { provide: ResetPasswordProvider, useValue: {} },
        { provide: NotificationsService, useValue: { sendToAll: jest.fn() } },
        {
          provide: OtpRateLimitService,
          useValue: {
            checkAndRecordResend: jest.fn().mockResolvedValue({ allowed: true, remaining: 2, retryAfterSeconds: 0 }),
            clearResendWindow: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: TokenBlacklistService, useValue: { blacklistToken: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: PasswordPolicyService,
          useValue: { validate: jest.fn().mockResolvedValue({ valid: true, violations: [] }) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    mailerService = module.get(MailerService);
  });

  /**
   * Registers a one-shot capture on the real MailerService.sendMail (the
   * boundary to the SMTP sink) and returns a promise that resolves with
   * whatever was actually dispatched — still running the real send underneath,
   * so template rendering and transport errors surface as test failures.
   */
  function captureNextSend(): Promise<any> {
    const realSendMail = mailerService.sendMail.bind(mailerService);
    return new Promise((resolve, reject) => {
      jest.spyOn(mailerService, 'sendMail').mockImplementation(async (opts: any) => {
        try {
          const result = await realSendMail(opts);
          resolve(opts);
          return result;
        } catch (err) {
          reject(err);
          throw err;
        }
      });
    });
  }

  it('dispatches a real OTP email through the SMTP sink during registration', async () => {
    const nextSend = captureNextSend();

    await authService.register(mockUser.email, 'Password123');

    await expect(nextSend).resolves.toMatchObject({
      to: mockUser.email,
      subject: 'Verify Your Email',
      template: 'otp-verification',
    });
  });

  it('dispatches a real password-reset OTP email through the SMTP sink during forgotPassword', async () => {
    const nextSend = captureNextSend();

    await authService.forgotPassword(mockUser.email);

    await expect(nextSend).resolves.toMatchObject({
      to: mockUser.email,
      subject: 'Reset Your Password',
      template: 'password-reset',
    });
  });

  it('dispatches a real password-reset success email through the SMTP sink during resetPassword', async () => {
    const bcrypt = require('bcrypt');
    const otp = '123456';
    const userWithOtp = {
      ...mockUser,
      otp: await bcrypt.hash(otp, 10),
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
    };
    (authService as any).usersService.findByEmail.mockResolvedValue(userWithOtp);
    (authService as any).usersService.update.mockResolvedValue(mockUser);

    const nextSend = captureNextSend();

    await authService.resetPassword(mockUser.email, otp, 'NewPassword123');

    await expect(nextSend).resolves.toMatchObject({
      to: mockUser.email,
      subject: 'Password Reset Successful',
    });
  });
});
