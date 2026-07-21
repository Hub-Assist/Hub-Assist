import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { ForgotPasswordProvider } from '../users/providers/forgot-password.provider';
import { ResetPasswordProvider } from '../users/providers/reset-password.provider';
import { TokenBlacklistService } from './token-blacklist.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/user.entity';

jest.mock('bcrypt');

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let emailService: jest.Mocked<EmailService>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let tokenBlacklistService: jest.Mocked<TokenBlacklistService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashedPassword123',
    role: UserRole.MEMBER,
    isVerified: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetSuccess: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RefreshTokenRepository,
          useValue: {
            create: jest.fn(),
            findByToken: jest.fn(),
            revokeToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
          },
        },
        {
          provide: ForgotPasswordProvider,
          useValue: {},
        },
        {
          provide: ResetPasswordProvider,
          useValue: {},
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: jest.fn().mockResolvedValue(undefined),
            isBlacklisted: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendToAll: jest.fn(),
            sendToUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    emailService = module.get(EmailService);
    refreshTokenRepository = module.get(RefreshTokenRepository);
    tokenBlacklistService = module.get(TokenBlacklistService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const email = 'newuser@example.com';
      const password = 'Password123';
      const hashedPassword = 'hashedPassword';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.register(email, password);

      expect(result).toEqual({ message: 'User registered. Check your email for OTP.' });
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          passwordHash: hashedPassword,
          otp: expect.any(String),
          otpExpiry: expect.any(Date),
        }),
      );
      expect(emailService.sendVerificationOtp).toHaveBeenCalledWith(email, expect.any(String));
    });

    it('should throw error when duplicate email exists', async () => {
      const email = 'existing@example.com';
      const password = 'Password123';

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      usersService.create.mockRejectedValue(new Error('Duplicate email'));

      await expect(service.register(email, password)).rejects.toThrow('Duplicate email');
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'Password123';
      const accessToken = 'jwt-access-token';
      const refreshToken = 'refresh-token-uuid';

      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
      jwtService.sign.mockReturnValue(accessToken);
      refreshTokenRepository.create.mockResolvedValue({} as any);

      const result = await service.login(email, password);

      expect(result).toEqual({
        access_token: accessToken,
        refresh_token: expect.any(String),
      });
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          jti: expect.any(String),
        }),
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const email = 'test@example.com';
      const password = 'WrongPassword';

      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(email, password)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(email, password)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'Password123';

      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(email, password)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(email, password)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for unverified user', async () => {
      const email = 'unverified@example.com';
      const password = 'Password123';
      const unverifiedUser = { ...mockUser, isVerified: false };

      usersService.findByEmail.mockResolvedValue(unverifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(email, password)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(email, password)).rejects.toThrow('Please verify your email first');
    });
  });

  describe('verifyOtp', () => {
    it('should successfully verify valid OTP and return tokens', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry, isVerified: false };

      usersService.findByEmail.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.update.mockResolvedValue({ ...userWithOtp, isVerified: true });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
      refreshTokenRepository.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('access-token');

      const result = await service.verifyOtp(email, otp);

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: expect.any(String),
      });
      expect(usersService.update).toHaveBeenCalledWith(userWithOtp.id, {
        isVerified: true,
        otp: undefined,
        otpExpiry: undefined,
      });
    });

    it('should throw BadRequestException for expired OTP', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() - 1000); // Expired
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithOtp);

      await expect(service.verifyOtp(email, otp)).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp(email, otp)).rejects.toThrow('OTP has expired');
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyOtp(email, otp)).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp(email, otp)).rejects.toThrow('Invalid OTP');
    });

    it('should throw BadRequestException when user not found', async () => {
      const email = 'nonexistent@example.com';
      const otp = '123456';

      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.verifyOtp(email, otp)).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp(email, otp)).rejects.toThrow('User not found');
    });

    it('should throw BadRequestException when no OTP found', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const userWithoutOtp = { ...mockUser, otp: undefined, otpExpiry: undefined };

      usersService.findByEmail.mockResolvedValue(userWithoutOtp);

      await expect(service.verifyOtp(email, otp)).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp(email, otp)).rejects.toThrow('No OTP found for this user');
    });
  });

  describe('resendOtp', () => {
    it('should successfully resend OTP when previous expired', async () => {
      const email = 'test@example.com';
      const expiredOtpExpiry = new Date(Date.now() - 1000);
      const userWithExpiredOtp = { ...mockUser, otp: 'oldHash', otpExpiry: expiredOtpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithExpiredOtp);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newOtpHash');
      usersService.update.mockResolvedValue(mockUser);

      const result = await service.resendOtp(email);

      expect(result).toEqual({ message: 'OTP resent to your email' });
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          otp: 'newOtpHash',
          otpExpiry: expect.any(Date),
        }),
      );
    });

    it('should throw BadRequestException when OTP still valid', async () => {
      const email = 'test@example.com';
      const validOtpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const userWithValidOtp = { ...mockUser, otp: 'validHash', otpExpiry: validOtpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithValidOtp);

      await expect(service.resendOtp(email)).rejects.toThrow(BadRequestException);
      await expect(service.resendOtp(email)).rejects.toThrow('OTP already sent. Please wait before requesting a new one.');
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset OTP for existing user', async () => {
      const email = 'test@example.com';

      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('otpHash');
      usersService.update.mockResolvedValue(mockUser);

      const result = await service.forgotPassword(email);

      expect(result).toEqual({
        message: 'If an account exists, a password reset OTP has been sent to the email.',
      });
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          otp: 'otpHash',
          otpExpiry: expect.any(Date),
        }),
      );
      expect(emailService.sendPasswordResetOtp).toHaveBeenCalledWith(email, expect.any(String));
    });

    it('should return generic message for non-existent user', async () => {
      const email = 'nonexistent@example.com';

      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword(email);

      expect(result).toEqual({
        message: 'If an account exists, a password reset OTP has been sent to the email.',
      });
      expect(usersService.update).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid OTP', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const newPassword = 'NewPassword123';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      usersService.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword(email, otp, newPassword);

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          passwordHash: 'newHashedPassword',
          otp: undefined,
          otpExpiry: undefined,
        }),
      );
      expect(emailService.sendPasswordResetSuccess).toHaveBeenCalledWith(email);
    });

    it('should throw BadRequestException for weak password', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const weakPassword = 'weak';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.resetPassword(email, otp, weakPassword)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(email, otp, weakPassword)).rejects.toThrow(
        'Password must be at least 8 characters and contain uppercase, lowercase, and numbers',
      );
    });

    it('should throw BadRequestException for expired OTP', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const newPassword = 'NewPassword123';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() - 1000);
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithOtp);

      await expect(service.resetPassword(email, otp, newPassword)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(email, otp, newPassword)).rejects.toThrow('OTP has expired');
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const email = 'test@example.com';
      const otp = '123456';
      const newPassword = 'NewPassword123';
      const otpHash = 'hashedOtp';
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const userWithOtp = { ...mockUser, otp: otpHash, otpExpiry };

      usersService.findByEmail.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.resetPassword(email, otp, newPassword)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(email, otp, newPassword)).rejects.toThrow('Invalid OTP');
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenRecord = {
        id: 'token-id',
        userId: mockUser.id,
        token: 'hashedToken',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: false,
      };
      const newAccessToken = 'new-access-token';

      refreshTokenRepository.findByToken.mockResolvedValue(tokenRecord as any);
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedRefreshToken');
      jwtService.sign.mockReturnValue(newAccessToken);
      refreshTokenRepository.revokeToken.mockResolvedValue(undefined);
      refreshTokenRepository.create.mockResolvedValue({} as any);

      const result = await service.refresh(refreshToken);

      expect(result).toEqual({
        access_token: newAccessToken,
        refresh_token: expect.any(String),
      });
      expect(refreshTokenRepository.revokeToken).toHaveBeenCalledWith(tokenRecord.id);
      expect(refreshTokenRepository.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const refreshToken = 'revoked-token';
      const tokenRecord = {
        id: 'token-id',
        userId: mockUser.id,
        token: 'hashedToken',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: true,
      };

      refreshTokenRepository.findByToken.mockResolvedValue(tokenRecord as any);

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(refreshToken)).rejects.toThrow('Invalid or revoked refresh token');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const refreshToken = 'expired-token';
      const tokenRecord = {
        id: 'token-id',
        userId: mockUser.id,
        token: 'hashedToken',
        expiresAt: new Date(Date.now() - 1000),
        isRevoked: false,
      };

      refreshTokenRepository.findByToken.mockResolvedValue(tokenRecord as any);

      await expect(service.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(refreshToken)).rejects.toThrow('Refresh token has expired');
    });
  });

  describe('logout', () => {
    it('should successfully logout user and revoke refresh tokens', async () => {
      const userId = 'user-123';

      refreshTokenRepository.revokeAllUserTokens.mockResolvedValue(undefined);

      const result = await service.logout(userId);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(refreshTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(userId);
    });

    it('should blacklist the access token jti when jti and exp are provided', async () => {
      const userId = 'user-123';
      const jti = 'test-jti-uuid';
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      refreshTokenRepository.revokeAllUserTokens.mockResolvedValue(undefined);

      await service.logout(userId, jti, exp);

      expect(tokenBlacklistService.blacklistToken).toHaveBeenCalledWith(
        jti,
        expect.any(Number),
      );
      // TTL should be approximately 1 hour in ms (allow ±5 seconds)
      const [, ttlMs] = (tokenBlacklistService.blacklistToken as jest.Mock).mock.calls[0];
      expect(ttlMs).toBeGreaterThan(3_595_000);
      expect(ttlMs).toBeLessThanOrEqual(3_600_000);
    });

    it('should NOT call blacklistToken when jti is absent', async () => {
      refreshTokenRepository.revokeAllUserTokens.mockResolvedValue(undefined);

      await service.logout('user-123');

      expect(tokenBlacklistService.blacklistToken).not.toHaveBeenCalled();
    });
  });
});
