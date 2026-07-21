import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';

const JWT_SECRET = 'hubassist-secret';

const mockAuthService = {
  register: jest.fn(),
  verifyOtp: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  resendOtp: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tokenBlacklistService: TokenBlacklistService;

  // In-memory blacklist for e2e tests (no Redis required)
  const blacklistedJtis = new Set<string>();

  const mockCacheManager = {
    get: jest.fn().mockImplementation((key: string) => {
      const jti = key.replace('blacklist:jti:', '');
      return Promise.resolve(blacklistedJtis.has(jti) ? '1' : null);
    }),
    set: jest.fn().mockImplementation((key: string) => {
      const jti = key.replace('blacklist:jti:', '');
      blacklistedJtis.add(jti);
      return Promise.resolve();
    }),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const makeToken = (id = 'user-uuid-1', jti = 'test-jti-1') =>
    jwtService.sign({ sub: id, email: 'user@test.com', role: 'member', jti });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        TokenBlacklistService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    const { TransformInterceptor } = await import('../src/common/interceptors/transform.interceptor');
    const { LoggingInterceptor } = await import('../src/common/interceptors/logging.interceptor');
    app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
    await app.init();

    jwtService = module.get(JwtService);
    tokenBlacklistService = module.get(TokenBlacklistService);
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    blacklistedJtis.clear();
  });

  // ── POST /api/v1/auth/register ────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 – creates user and returns message', async () => {
      mockAuthService.register.mockResolvedValue({
        message: 'User registered. Check your email for OTP.',
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'newuser@test.com', password: 'SecurePass123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.message).toBeDefined();
        });
    });
  });

  // ── POST /api/v1/auth/login ───────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('201 – returns access and refresh tokens', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'access-jwt',
        refresh_token: 'refresh-uuid',
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@test.com', password: 'SecurePass123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.access_token).toBeDefined();
          expect(res.body.data.refresh_token).toBeDefined();
        });
    });

    it('401 – wrong password returns unauthorized', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@test.com', password: 'WrongPass' })
        .expect(401);
    });
  });

  // ── POST /api/v1/auth/verify-otp ──────────────────────────────────────────────

  describe('POST /api/v1/auth/verify-otp', () => {
    it('201 – verifies account with valid OTP', async () => {
      mockAuthService.verifyOtp.mockResolvedValue({ message: 'Email verified successfully' });

      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ email: 'user@test.com', otp: '123456' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  // ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('201 – rotates tokens with valid refresh token', async () => {
      mockAuthService.refresh.mockResolvedValue({
        access_token: 'new-access-jwt',
        refresh_token: 'new-refresh-uuid',
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.access_token).toBeDefined();
          expect(res.body.data.refresh_token).toBeDefined();
        });
    });

    it('401 – invalid refresh token returns unauthorized', async () => {
      mockAuthService.refresh.mockRejectedValue(
        new UnauthorizedException('Invalid or revoked refresh token'),
      );

      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  // ── POST /api/v1/auth/forgot-password ────────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('201 – sends reset OTP for existing email', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'Password reset OTP sent to your email',
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user@test.com' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.message).toBeDefined();
        });
    });
  });

  // ── POST /api/v1/auth/reset-password ─────────────────────────────────────────

  describe('POST /api/v1/auth/reset-password', () => {
    it('201 – resets password with valid OTP', async () => {
      mockAuthService.resetPassword.mockResolvedValue({ message: 'Password reset successfully' });

      return request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ email: 'user@test.com', otp: '123456', newPassword: 'NewSecurePass123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.message).toBe('Password reset successfully');
        });
    });

    it('401 – invalid OTP returns unauthorized', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new UnauthorizedException('Invalid or expired OTP'),
      );

      return request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ email: 'user@test.com', otp: '000000', newPassword: 'NewSecurePass123' })
        .expect(401);
    });
  });

  // ── POST /api/v1/auth/logout ──────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('201 – revokes token for authenticated user', async () => {
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.message).toBe('Logged out successfully');
        });
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401));
  });

  // ── JWT Blacklist: login → logout → 401 ──────────────────────────────────────

  describe('JWT Blacklist — login → logout → attempt API call with old token → 401', () => {
    it('rejects a blacklisted access token immediately after logout', async () => {
      const jti = 'blacklist-e2e-jti';
      const token = makeToken('user-uuid-1', jti);

      // Step 1: logout succeeds with the token
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Simulate the blacklist being populated (as AuthService.logout would do)
      await tokenBlacklistService.blacklistToken(jti, 3_600_000);

      // Step 2: the same token is now rejected
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('accepts a valid (non-blacklisted) token', async () => {
      const jti = 'valid-jti-not-blacklisted';
      const token = makeToken('user-uuid-2', jti);

      mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      // Token is NOT blacklisted — request should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    });
  });

  // ── API Versioning ────────────────────────────────────────────────────────────

  describe('API Versioning', () => {
    it('GET /api/v1/auth/* resolves to v1 handler', async () => {
      // The register endpoint is on v1 — a 201/400 (not 404) confirms routing works
      mockAuthService.register.mockResolvedValue({ message: 'ok' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'v1test@test.com', password: 'SecurePass123' });

      expect(res.status).not.toBe(404);
    });

    it('GET /api/auth/* (no version prefix) falls back to v1 via defaultVersion', async () => {
      mockAuthService.register.mockResolvedValue({ message: 'ok' });

      // Without /v1/ prefix — defaultVersion: '1' should still route correctly
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'noversion@test.com', password: 'SecurePass123' });

      // Should resolve to v1 handler (not 404)
      expect(res.status).not.toBe(404);
    });
  });
});
