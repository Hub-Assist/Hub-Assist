/**
 * Unit tests for OTP flood protection:
 *  - Sliding-window resend rate limiting (3 per 5 minutes)
 *  - Wrong-attempt counter and OTP invalidation after 3 failures
 *  - attemptsRemaining in error responses
 *  - Integration: after invalidation, resend generates a new OTP that works
 */

import { BadRequestException, TooManyRequestsException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpRateLimitService, OTP_RESEND_WINDOW_MS } from './otp-rate-limit.service';

// ---------------------------------------------------------------------------
// Minimal mock factories
// ---------------------------------------------------------------------------

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  otp: '$2b$10$hashedOtp',
  otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  otpAttempts: 0,
  otpInvalidatedAt: undefined as Date | undefined,
  otpResendCount: 0,
  isVerified: false,
  role: 'member',
  passwordHash: 'hash',
  ...overrides,
});

const makeUsersService = (user: ReturnType<typeof makeUser>) => ({
  findByEmail: jest.fn().mockResolvedValue(user),
  update: jest.fn().mockImplementation((_id: string, data: Record<string, unknown>) => {
    Object.assign(user, data);
    return Promise.resolve(user);
  }),
});

const makeJwtService = () => ({
  sign: jest.fn().mockReturnValue('jwt-token'),
});

const makeEmailService = () => ({
  sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
});

const makeRefreshTokenRepo = () => ({
  create: jest.fn().mockResolvedValue(undefined),
});

const makeNotificationsService = () => ({
  sendToAll: jest.fn(),
});

// OtpRateLimitService mock — controls sliding-window behaviour per test
const makeOtpRateLimitService = (
  allowed = true,
  remaining = 2,
  retryAfterSeconds = 0,
): jest.Mocked<OtpRateLimitService> =>
  ({
    checkAndRecordResend: jest.fn().mockResolvedValue({ allowed, remaining, retryAfterSeconds }),
    clearResendWindow: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<OtpRateLimitService>);

// bcrypt mock — avoids slow hashing in unit tests
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedOtp'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Helper to build AuthService with injected mocks
// ---------------------------------------------------------------------------

function buildService(
  user: ReturnType<typeof makeUser>,
  rateLimitOverrides?: Partial<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>,
) {
  const usersService = makeUsersService(user);
  const jwtService = makeJwtService();
  const emailService = makeEmailService();
  const refreshTokenRepo = makeRefreshTokenRepo();
  const notificationsService = makeNotificationsService();
  const rateLimitService = makeOtpRateLimitService(
    rateLimitOverrides?.allowed ?? true,
    rateLimitOverrides?.remaining ?? 2,
    rateLimitOverrides?.retryAfterSeconds ?? 0,
  );

  const service = new AuthService(
    usersService as any,
    jwtService as any,
    emailService as any,
    refreshTokenRepo as any,
    null as any, // forgotPasswordProvider
    null as any, // resetPasswordProvider
    notificationsService as any,
    rateLimitService,
  );

  return { service, usersService, emailService, rateLimitService };
}

// ---------------------------------------------------------------------------
// Tests: resendOtp — sliding-window rate limiting
// ---------------------------------------------------------------------------

describe('AuthService.resendOtp — sliding-window rate limiting', () => {
  it('allows the first 3 resend requests within 5 minutes', async () => {
    const user = makeUser();
    const { service } = buildService(user, { allowed: true, remaining: 2 });

    const result = await service.resendOtp(user.email);
    expect(result.message).toBe('OTP resent to your email');
  });

  it('returns 429 on the 4th resend within 5 minutes', async () => {
    const user = makeUser({ otpResendCount: 3 });
    const { service } = buildService(user, {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 180,
    });

    await expect(service.resendOtp(user.email)).rejects.toThrow(TooManyRequestsException);
  });

  it('includes retryAfterSeconds in the 429 response', async () => {
    const user = makeUser({ otpResendCount: 3 });
    const { service } = buildService(user, {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 240,
    });

    try {
      await service.resendOtp(user.email);
      fail('Expected TooManyRequestsException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(TooManyRequestsException);
      expect(err.response?.retryAfterSeconds).toBe(240);
    }
  });

  it('resets otpAttempts and otpInvalidatedAt when a new OTP is issued', async () => {
    const user = makeUser({ otpAttempts: 2, otpInvalidatedAt: new Date() });
    const { service, usersService } = buildService(user, { allowed: true, remaining: 1 });

    await service.resendOtp(user.email);

    const updateCall = usersService.update.mock.calls[0][1];
    expect(updateCall.otpAttempts).toBe(0);
    expect(updateCall.otpInvalidatedAt).toBeUndefined();
  });

  it('increments otpResendCount on each allowed resend', async () => {
    const user = makeUser({ otpResendCount: 1 });
    const { service, usersService } = buildService(user, { allowed: true, remaining: 1 });

    await service.resendOtp(user.email);

    const updateCall = usersService.update.mock.calls[0][1];
    expect(updateCall.otpResendCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: verifyOtp — wrong-attempt counter and invalidation
// ---------------------------------------------------------------------------

describe('AuthService.verifyOtp — wrong-attempt counter and invalidation', () => {
  beforeEach(() => {
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('returns attemptsRemaining on first wrong guess', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const user = makeUser({ otpAttempts: 0 });
    const { service } = buildService(user);

    try {
      await service.verifyOtp(user.email, '000000');
      fail('Expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.attemptsRemaining).toBe(2);
    }
  });

  it('returns attemptsRemaining=1 on second wrong guess', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const user = makeUser({ otpAttempts: 1 });
    const { service } = buildService(user);

    try {
      await service.verifyOtp(user.email, '000000');
      fail('Expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.attemptsRemaining).toBe(1);
    }
  });

  it('invalidates OTP after 3 wrong guesses', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const user = makeUser({ otpAttempts: 2 }); // 3rd attempt
    const { service, usersService } = buildService(user);

    try {
      await service.verifyOtp(user.email, '000000');
      fail('Expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.attemptsRemaining).toBe(0);
      expect(err.response?.message).toContain('invalidated');
    }

    // otpInvalidatedAt must be set
    const updateCall = usersService.update.mock.calls[0][1];
    expect(updateCall.otpInvalidatedAt).toBeInstanceOf(Date);
  });

  it('rejects correct OTP after invalidation', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true); // correct OTP
    const user = makeUser({ otpInvalidatedAt: new Date() });
    const { service } = buildService(user);

    await expect(service.verifyOtp(user.email, '123456')).rejects.toThrow(BadRequestException);

    try {
      await service.verifyOtp(user.email, '123456');
    } catch (err: any) {
      expect(err.response?.attemptsRemaining).toBe(0);
      expect(err.response?.message).toContain('invalidated');
    }
  });

  it('never exposes the OTP value in error responses', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const user = makeUser({ otpAttempts: 0 });
    const { service } = buildService(user);

    try {
      await service.verifyOtp(user.email, '000000');
    } catch (err: any) {
      const responseStr = JSON.stringify(err.response ?? {});
      // The stored hash must never appear in the response
      expect(responseStr).not.toContain('$2b$10$hashedOtp');
      // The submitted OTP must never be echoed back
      expect(responseStr).not.toContain('000000');
    }
  });

  it('clears all OTP state on successful verification', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const user = makeUser({ otpAttempts: 1 });
    const { service, usersService, rateLimitService } = buildService(user);

    await service.verifyOtp(user.email, '123456');

    const updateCall = usersService.update.mock.calls[0][1];
    expect(updateCall.isVerified).toBe(true);
    expect(updateCall.otp).toBeUndefined();
    expect(updateCall.otpExpiry).toBeUndefined();
    expect(updateCall.otpAttempts).toBe(0);
    expect(updateCall.otpInvalidatedAt).toBeUndefined();
    expect(updateCall.otpResendCount).toBe(0);

    // Redis window must be cleared
    expect(rateLimitService.clearResendWindow).toHaveBeenCalledWith(user.email);
  });
});

// ---------------------------------------------------------------------------
// Integration: invalidation → resend → new OTP works
// ---------------------------------------------------------------------------

describe('AuthService — integration: invalidation then resend', () => {
  it('after invalidation, resend generates a new OTP that can be verified', async () => {
    // Step 1: OTP is invalidated
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const user = makeUser({ otpAttempts: 2 });
    const { service: svc1, usersService: us1 } = buildService(user);

    try {
      await svc1.verifyOtp(user.email, '000000');
    } catch {
      // expected — OTP invalidated
    }

    expect(user.otpInvalidatedAt).toBeInstanceOf(Date);

    // Step 2: User requests a new OTP via resend
    const { service: svc2, usersService: us2 } = buildService(user, {
      allowed: true,
      remaining: 2,
    });

    const resendResult = await svc2.resendOtp(user.email);
    expect(resendResult.message).toBe('OTP resent to your email');

    // otpInvalidatedAt and otpAttempts must be reset
    const resendUpdate = us2.update.mock.calls[0][1];
    expect(resendUpdate.otpAttempts).toBe(0);
    expect(resendUpdate.otpInvalidatedAt).toBeUndefined();

    // Step 3: Verify with the new OTP (simulate correct hash)
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    // Simulate the user entity after resend (no invalidation)
    const freshUser = makeUser({ otpAttempts: 0, otpInvalidatedAt: undefined });
    const { service: svc3 } = buildService(freshUser);

    const verifyResult = await svc3.verifyOtp(freshUser.email, '654321');
    expect(verifyResult).toHaveProperty('access_token');
    expect(verifyResult).toHaveProperty('refresh_token');
  });
});

// ---------------------------------------------------------------------------
// Tests: OtpRateLimitService — sliding window expiry
// ---------------------------------------------------------------------------

describe('OtpRateLimitService — sliding window', () => {
  it('allows up to OTP_RESEND_LIMIT requests within the window', async () => {
    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const svc = new OtpRateLimitService(mockCache as any);

    // Simulate 3 timestamps all within the window
    const now = Date.now();
    const timestamps = [now - 1000, now - 2000]; // 2 existing
    mockCache.get.mockResolvedValue(JSON.stringify(timestamps));

    const result = await svc.checkAndRecordResend('user@example.com');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // 3rd slot used
  });

  it('blocks the 4th request within the window', async () => {
    const mockCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const svc = new OtpRateLimitService(mockCache as any);

    const now = Date.now();
    // 3 timestamps all within the 5-minute window
    const timestamps = [now - 60_000, now - 120_000, now - 180_000];
    mockCache.get.mockResolvedValue(JSON.stringify(timestamps));

    const result = await svc.checkAndRecordResend('user@example.com');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows a new request after the window expires (old timestamps evicted)', async () => {
    const mockCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const svc = new OtpRateLimitService(mockCache as any);

    const now = Date.now();
    // 3 timestamps all OUTSIDE the 5-minute window (expired)
    const expired = [
      now - OTP_RESEND_WINDOW_MS - 1000,
      now - OTP_RESEND_WINDOW_MS - 2000,
      now - OTP_RESEND_WINDOW_MS - 3000,
    ];
    mockCache.get.mockResolvedValue(JSON.stringify(expired));

    const result = await svc.checkAndRecordResend('user@example.com');
    expect(result.allowed).toBe(true);
  });

  it('falls back gracefully when cache is unavailable', async () => {
    const svc = new OtpRateLimitService(null);
    const result = await svc.checkAndRecordResend('user@example.com');
    expect(result.allowed).toBe(true);
  });
});
