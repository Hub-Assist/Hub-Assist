import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { TerminusModule, HealthCheckService, TypeOrmHealthIndicator, HealthCheckError } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { RedisHealthIndicator } from '../src/health/indicators/redis.health-indicator';
import { StellarHealthIndicator } from '../src/health/indicators/stellar.health-indicator';
import { SmtpHealthIndicator } from '../src/health/indicators/smtp.health-indicator';
import { CloudinaryHealthIndicator } from '../src/health/indicators/cloudinary.health-indicator';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

const JWT_SECRET = 'hubassist-secret';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

const makeDbIndicator = (healthy = true) => ({
  pingCheck: jest.fn().mockImplementation(async (key: string) => {
    if (!healthy) {
      throw new HealthCheckError('DB down', { [key]: { status: 'down' } });
    }
    return { [key]: { status: 'up' } };
  }),
});

const makeRedisIndicator = (healthy = true) => ({
  isHealthy: jest.fn().mockImplementation(async (key: string) => {
    if (!healthy) {
      throw new HealthCheckError('Redis down', { [key]: { status: 'down' } });
    }
    return { [key]: { status: 'up' } };
  }),
});

const makeOptionalIndicator = (key: string, healthy = true) => ({
  isHealthy: jest.fn().mockImplementation(async () => {
    if (!healthy) {
      throw new HealthCheckError(`${key} down`, { [key]: { status: 'down' } });
    }
    return { [key]: { status: 'up' } };
  }),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Health (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  // Build a fresh app for each describe block so we can swap indicator mocks
  async function buildApp(options: {
    dbHealthy?: boolean;
    redisHealthy?: boolean;
    stellarHealthy?: boolean;
    smtpHealthy?: boolean;
    cloudinaryHealthy?: boolean;
  } = {}) {
    const {
      dbHealthy = true,
      redisHealthy = true,
      stellarHealthy = true,
      smtpHealthy = true,
      cloudinaryHealthy = true,
    } = options;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TerminusModule,
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [HealthController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: TypeOrmHealthIndicator, useValue: makeDbIndicator(dbHealthy) },
        { provide: RedisHealthIndicator, useValue: makeRedisIndicator(redisHealthy) },
        { provide: StellarHealthIndicator, useValue: makeOptionalIndicator('stellar_rpc', stellarHealthy) },
        { provide: SmtpHealthIndicator, useValue: makeOptionalIndicator('smtp', smtpHealthy) },
        { provide: CloudinaryHealthIndicator, useValue: makeOptionalIndicator('cloudinary', cloudinaryHealthy) },
      ],
    }).compile();

    const nestApp = module.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    nestApp.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
    await nestApp.init();

    jwtService = module.get(JwtService);
    return nestApp;
  }

  const adminToken = () =>
    jwtService.sign({ sub: 'admin-uuid', email: 'admin@test.com', role: 'admin' });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ── GET /health/live ───────────────────────────────────────────────────────

  describe('GET /api/v1/health/live', () => {
    it('200 – always returns ok regardless of dependency state', async () => {
      app = await buildApp({ dbHealthy: false, redisHealthy: false });

      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(typeof res.body.uptime).toBe('number');
          expect(res.body.memory).toBeDefined();
        });
    });

    it('200 – no auth required', async () => {
      app = await buildApp();
      return request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    });
  });

  // ── GET /health/ready ──────────────────────────────────────────────────────

  describe('GET /api/v1/health/ready', () => {
    it('200 – returns ok when DB and Redis are healthy', async () => {
      app = await buildApp({ dbHealthy: true, redisHealthy: true });

      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });

    it('503 – returns service unavailable when database connection is down', async () => {
      app = await buildApp({ dbHealthy: false });

      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(503)
        .expect((res) => {
          expect(res.body.status).toBe('error');
          expect(res.body.error?.database ?? res.body.details?.database).toBeDefined();
        });
    });

    it('503 – returns service unavailable when Redis is down', async () => {
      app = await buildApp({ dbHealthy: true, redisHealthy: false });

      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(503)
        .expect((res) => {
          expect(res.body.status).toBe('error');
        });
    });

    it('200 – no auth required', async () => {
      app = await buildApp();
      return request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    });
  });

  // ── GET /health ────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('200 – alias for /ready when healthy', async () => {
      app = await buildApp();
      return request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });
  });

  // ── GET /health/deep ───────────────────────────────────────────────────────

  describe('GET /api/v1/health/deep', () => {
    it('401 – rejects unauthenticated requests', async () => {
      app = await buildApp();
      return request(app.getHttpServer()).get('/api/v1/health/deep').expect(401);
    });

    it('200 – returns ok for admin when all dependencies are healthy', async () => {
      app = await buildApp();

      return request(app.getHttpServer())
        .get('/api/v1/health/deep')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.details?.database).toBeDefined();
        });
    });

    it('503 – returns degraded when one optional dependency is down', async () => {
      app = await buildApp({ stellarHealthy: false });

      return request(app.getHttpServer())
        .get('/api/v1/health/deep')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(503)
        .expect((res) => {
          expect(res.body.status).toBe('error');
        });
    });
  });
});
