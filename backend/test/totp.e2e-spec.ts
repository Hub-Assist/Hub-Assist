import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TotpController } from '../src/auth/totp.controller';
import { TotpService } from '../src/auth/totp.service';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { User, UserRole } from '../src/users/user.entity';

const JWT_SECRET = process.env.JWT_SECRET || 'hubassist-secret';

// ── RFC 6238 TOTP code generator (mirrors TotpService's private algorithm) ────
// Used to compute codes for a known secret so we can drive the real HTTP
// endpoints with valid/invalid/stale codes without depending on an external
// authenticator app.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of input.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totpCodeForCounter(secret: string, counter: number): string {
  const decodedSecret = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', decodedSecret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function currentTotpCode(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return totpCodeForCounter(secret, counter);
}

function staleTotpCode(secret: string): string {
  // 5 windows (~2.5 min) away — outside the service's ±1 window tolerance.
  const counter = Math.floor(Date.now() / 1000 / 30) - 5;
  return totpCodeForCounter(secret, counter);
}

// Minimal real-repository-backed stand-in for UsersService — TotpController
// only ever calls findById/update, so we implement exactly those against the
// real Postgres-backed repository instead of pulling in UsersService's full
// (unrelated) provider graph.
class RepoBackedUsersService {
  constructor(private readonly repo: Repository<User>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<User>) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    Object.assign(user, data);
    return this.repo.save(user);
  }
}

describe('TOTP (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userRepo: Repository<User>;

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const makeToken = (userId: string) =>
    jwtService.sign({ sub: userId, email: 'totp-e2e@test.com', role: 'member' });

  const createUser = async (overrides: Partial<User> = {}) => {
    const user = userRepo.create({
      email: `totp-e2e-${crypto.randomUUID()}@test.com`,
      passwordHash: 'irrelevant-hash',
      role: UserRole.MEMBER,
      ...overrides,
    });
    return userRepo.save(user);
  };

  beforeAll(async () => {
    const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for e2e tests');
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User]),
      ],
      controllers: [TotpController],
      providers: [
        TotpService,
        JwtStrategy,
        TokenBlacklistService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: AuthService, useValue: {} }, // unused by TotpController — only injected for typing
        {
          provide: UsersService,
          useFactory: (repo: Repository<User>) => new RepoBackedUsersService(repo),
          inject: [getRepositoryToken(User)],
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    jwtService = module.get(JwtService);
    userRepo = module.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/auth/totp/setup ──────────────────────────────────────────

  describe('POST /api/v1/auth/totp/setup', () => {
    it('201 – issues a secret, QR URI and manual entry key for a fresh user', async () => {
      const user = await createUser();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/totp/setup')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.secret).toMatch(/^[A-Z2-7]+$/);
      expect(res.body.data.manualEntryKey).toBe(res.body.data.secret);
      expect(res.body.data.qrCodeUri).toContain('otpauth://totp/');
      expect(res.body.data.qrCodeUri).toContain(encodeURIComponent(user.email));
    });

    it('400 – rejects setup when TOTP is already enabled', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' });

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/setup')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(400);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).post('/api/v1/auth/totp/setup').expect(401));
  });

  // ── GET /api/v1/auth/totp/status ──────────────────────────────────────────

  describe('GET /api/v1/auth/totp/status', () => {
    it('200 – reports disabled for a fresh user', async () => {
      const user = await createUser();

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/totp/status')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(200);

      expect(res.body.data.totpEnabled).toBe(false);
    });

    it('200 – reports enabled once totpEnabled is set', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/totp/status')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(200);

      expect(res.body.data.totpEnabled).toBe(true);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).get('/api/v1/auth/totp/status').expect(401));
  });

  // ── POST /api/v1/auth/totp/enable ─────────────────────────────────────────

  describe('POST /api/v1/auth/totp/enable', () => {
    it('400 – rejects an incorrect code for a freshly-issued setup secret', async () => {
      const user = await createUser();

      const setupRes = await request(app.getHttpServer())
        .post('/api/v1/auth/totp/setup')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(201);

      const code = currentTotpCode(setupRes.body.data.secret);

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/enable')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code })
        .expect(400);
    });

    it('400 – rejects a malformed (non-6-digit) code', async () => {
      const user = await createUser();

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/enable')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code: '123' })
        .expect(400);
    });

    it('400 – rejects enabling when already enabled', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' });

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/enable')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code: '123456' })
        .expect(400);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/totp/enable')
        .send({ code: '123456' })
        .expect(401));
  });

  // ── POST /api/v1/auth/totp/verify ─────────────────────────────────────────

  describe('POST /api/v1/auth/totp/verify', () => {
    const KNOWN_SECRET = 'JBSWY3DPEHPK3PXP';

    it('201 – verifies a valid current code for an enrolled user', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: KNOWN_SECRET });
      const code = currentTotpCode(KNOWN_SECRET);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/totp/verify')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code })
        .expect(201);

      expect(res.body.data.valid).toBe(true);
    });

    it('400 – rejects a stale code outside the tolerance window (replay of an old code)', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: KNOWN_SECRET });
      const staleCode = staleTotpCode(KNOWN_SECRET);

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/verify')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code: staleCode })
        .expect(400);
    });

    it('400 – rejects an arbitrary invalid code', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: KNOWN_SECRET });

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/verify')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code: '000000' })
        .expect(400);
    });

    it('400 – rejects verification when TOTP is not enabled for the account', async () => {
      const user = await createUser();

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/verify')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code: '123456' })
        .expect(400);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/totp/verify')
        .send({ code: '123456' })
        .expect(401));
  });

  // ── POST /api/v1/auth/totp/disable ────────────────────────────────────────

  describe('POST /api/v1/auth/totp/disable', () => {
    const KNOWN_SECRET = 'JBSWY3DPEHPK3PXP';

    it('201 – disables TOTP with a valid code', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: KNOWN_SECRET });
      const code = currentTotpCode(KNOWN_SECRET);

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/disable')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code })
        .expect(201);

      const statusRes = await request(app.getHttpServer())
        .get('/api/v1/auth/totp/status')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(200);

      expect(statusRes.body.data.totpEnabled).toBe(false);
    });

    it('400 – rejects disabling with an invalid code and leaves TOTP enabled', async () => {
      const user = await createUser({ totpEnabled: true, totpSecret: KNOWN_SECRET });

      await request(app.getHttpServer())
        .post('/api/v1/auth/totp/disable')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ code: '000000' })
        .expect(400);

      const statusRes = await request(app.getHttpServer())
        .get('/api/v1/auth/totp/status')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .expect(200);

      expect(statusRes.body.data.totpEnabled).toBe(true);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/totp/disable')
        .send({ code: '123456' })
        .expect(401));
  });
});
