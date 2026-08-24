import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { BiometricController } from '../src/auth/biometric.controller';
import { BiometricService } from '../src/auth/biometric.service';
import { WebAuthnCredential } from '../src/auth/webauthn-credential.entity';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { User, UserRole } from '../src/users/user.entity';

// The real WebAuthn ceremony (browser platform authenticator + attestation
// cryptography) cannot run headlessly in CI, so the verification calls from
// @simplewebauthn/server are mocked. Everything else — controller routing,
// DTO validation, credential persistence, JWT issuance — runs for real
// against the actual HTTP stack and a real Postgres-backed repository.
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const JWT_SECRET = process.env.JWT_SECRET || 'hubassist-secret';

describe('Biometric / WebAuthn (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let credentialRepo: Repository<WebAuthnCredential>;

  const createUser = async () => {
    const user = userRepo.create({
      email: `biometric-e2e-${crypto.randomUUID()}@test.com`,
      passwordHash: 'irrelevant-hash',
      role: UserRole.MEMBER,
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
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User, WebAuthnCredential]),
      ],
      controllers: [BiometricController],
      providers: [BiometricService],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    userRepo = module.get(getRepositoryToken(User));
    credentialRepo = module.get(getRepositoryToken(WebAuthnCredential));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/v1/auth/biometric/register-options ──────────────────────────

  describe('POST /api/v1/auth/biometric/register-options', () => {
    it('200 – issues WebAuthn registration options for a known user', async () => {
      const user = await createUser();
      (generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'reg-challenge',
        rp: { name: 'HubAssist', id: 'localhost' },
        user: { id: user.id, name: user.email },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-options')
        .send({ userId: user.id })
        .expect(201);

      expect(res.body.data.challenge).toBe('reg-challenge');
      expect(generateRegistrationOptions).toHaveBeenCalledTimes(1);
    });

    it('400 – rejects an unknown userId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-options')
        .send({ userId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });

    it('400 – rejects a missing userId (DTO validation)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-options')
        .send({})
        .expect(400);
    });
  });

  // ── POST /api/v1/auth/biometric/register-verify ────────────────────────────

  describe('POST /api/v1/auth/biometric/register-verify', () => {
    it('201 – persists a new credential on successful verification', async () => {
      const user = await createUser();
      (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: `cred-${user.id}`,
            publicKey: Buffer.from('fake-public-key'),
            counter: 0,
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-verify')
        .send({
          userId: user.id,
          attestationResponse: JSON.stringify({ clientDataJSON: { challenge: 'reg-challenge' } }),
        })
        .expect(201);

      expect(res.body.data.success).toBe(true);

      const stored = await credentialRepo.findOne({ where: { userId: user.id } });
      expect(stored).toBeDefined();
      expect(stored!.credentialId).toBe(`cred-${user.id}`);
    });

    it('400 – rejects when the WebAuthn library reports verification failed', async () => {
      const user = await createUser();
      (verifyRegistrationResponse as jest.Mock).mockResolvedValue({ verified: false });

      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-verify')
        .send({
          userId: user.id,
          attestationResponse: JSON.stringify({ clientDataJSON: { challenge: 'bad-challenge' } }),
        })
        .expect(400);

      const stored = await credentialRepo.findOne({ where: { userId: user.id } });
      expect(stored).toBeNull();
    });

    it('400 – rejects a malformed (non-JSON) attestation response', async () => {
      const user = await createUser();

      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-verify')
        .send({ userId: user.id, attestationResponse: 'not-json' })
        .expect(400);
    });

    it('400 – rejects an unknown userId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/register-verify')
        .send({
          userId: '00000000-0000-0000-0000-000000000000',
          attestationResponse: JSON.stringify({}),
        })
        .expect(400);
    });
  });

  // ── POST /api/v1/auth/biometric/login-options ──────────────────────────────

  describe('POST /api/v1/auth/biometric/login-options', () => {
    it('200 – issues authentication options when a credential is registered', async () => {
      const user = await createUser();
      await credentialRepo.save(
        credentialRepo.create({
          userId: user.id,
          credentialId: `cred-${user.id}`,
          publicKey: Buffer.from('fake-public-key').toString('base64'),
          counter: 0,
        }),
      );
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
        challenge: 'auth-challenge',
        allowCredentials: [{ id: `cred-${user.id}` }],
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/login-options')
        .send({ userId: user.id })
        .expect(201);

      expect(res.body.data.challenge).toBe('auth-challenge');
    });

    it('400 – rejects a user with no registered credentials', async () => {
      const user = await createUser();

      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/login-options')
        .send({ userId: user.id })
        .expect(400);
    });
  });

  // ── POST /api/v1/auth/biometric/login-verify ────────────────────────────────

  describe('POST /api/v1/auth/biometric/login-verify', () => {
    it('201 – returns a JWT and updates the stored counter on successful assertion', async () => {
      const user = await createUser();
      const credentialId = `cred-${user.id}`;
      await credentialRepo.save(
        credentialRepo.create({
          userId: user.id,
          credentialId,
          publicKey: Buffer.from('fake-public-key').toString('base64'),
          counter: 0,
        }),
      );
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/login-verify')
        .send({
          userId: user.id,
          assertionResponse: JSON.stringify({
            id: credentialId,
            clientDataJSON: { challenge: 'auth-challenge' },
          }),
        })
        .expect(201);

      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.accessToken.length).toBeGreaterThan(0);

      const stored = await credentialRepo.findOne({ where: { userId: user.id } });
      expect(Number(stored!.counter)).toBe(1);
    });

    it('401 – rejects assertion for a credential that was never registered', async () => {
      const user = await createUser();

      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/login-verify')
        .send({
          userId: user.id,
          assertionResponse: JSON.stringify({
            id: 'never-registered-credential',
            clientDataJSON: { challenge: 'auth-challenge' },
          }),
        })
        .expect(401);
    });

    it('401 – rejects when the WebAuthn library reports verification failed', async () => {
      const user = await createUser();
      const credentialId = `cred-${user.id}`;
      await credentialRepo.save(
        credentialRepo.create({
          userId: user.id,
          credentialId,
          publicKey: Buffer.from('fake-public-key').toString('base64'),
          counter: 0,
        }),
      );
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({ verified: false });

      await request(app.getHttpServer())
        .post('/api/v1/auth/biometric/login-verify')
        .send({
          userId: user.id,
          assertionResponse: JSON.stringify({
            id: credentialId,
            clientDataJSON: { challenge: 'auth-challenge' },
          }),
        })
        .expect(401);

      const stored = await credentialRepo.findOne({ where: { userId: user.id } });
      expect(Number(stored!.counter)).toBe(0); // unchanged on failure
    });
  });
});
