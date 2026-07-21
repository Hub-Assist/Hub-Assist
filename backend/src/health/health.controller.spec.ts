import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator, HealthCheckError } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { StellarHealthIndicator } from './indicators/stellar.health-indicator';
import { SmtpHealthIndicator } from './indicators/smtp.health-indicator';
import { CloudinaryHealthIndicator } from './indicators/cloudinary.health-indicator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHealthService(overrides: Partial<{ check: jest.Mock }> = {}) {
  return {
    check: overrides.check ?? jest.fn(),
  } as unknown as HealthCheckService;
}

function makeDbIndicator(overrides: Partial<{ pingCheck: jest.Mock }> = {}) {
  return {
    pingCheck: overrides.pingCheck ?? jest.fn(),
  } as unknown as TypeOrmHealthIndicator;
}

function makeRedisIndicator(overrides: Partial<{ isHealthy: jest.Mock }> = {}) {
  return { isHealthy: overrides.isHealthy ?? jest.fn() } as unknown as RedisHealthIndicator;
}

function makeStellarIndicator(overrides: Partial<{ isHealthy: jest.Mock }> = {}) {
  return { isHealthy: overrides.isHealthy ?? jest.fn() } as unknown as StellarHealthIndicator;
}

function makeSmtpIndicator(overrides: Partial<{ isHealthy: jest.Mock }> = {}) {
  return { isHealthy: overrides.isHealthy ?? jest.fn() } as unknown as SmtpHealthIndicator;
}

function makeCloudinaryIndicator(overrides: Partial<{ isHealthy: jest.Mock }> = {}) {
  return { isHealthy: overrides.isHealthy ?? jest.fn() } as unknown as CloudinaryHealthIndicator;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthCheckService;
  let dbIndicator: TypeOrmHealthIndicator;
  let redisIndicator: RedisHealthIndicator;

  async function buildController(
    healthServiceOverride?: Partial<{ check: jest.Mock }>,
  ) {
    healthService = makeHealthService(healthServiceOverride);
    dbIndicator = makeDbIndicator();
    redisIndicator = makeRedisIndicator();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthService },
        { provide: TypeOrmHealthIndicator, useValue: dbIndicator },
        { provide: RedisHealthIndicator, useValue: redisIndicator },
        { provide: StellarHealthIndicator, useValue: makeStellarIndicator() },
        { provide: SmtpHealthIndicator, useValue: makeSmtpIndicator() },
        { provide: CloudinaryHealthIndicator, useValue: makeCloudinaryIndicator() },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  }

  // ── liveness ──────────────────────────────────────────────────────────────

  describe('GET /health/live', () => {
    it('returns status ok with process metadata', async () => {
      await buildController();
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.pid).toBe('number');
      expect(result.memory).toHaveProperty('heapUsedMb');
      expect(result.memory).toHaveProperty('rssMb');
    });

    it('never calls any health indicator', async () => {
      await buildController();
      controller.liveness();

      expect((healthService.check as jest.Mock)).not.toHaveBeenCalled();
    });
  });

  // ── readiness ─────────────────────────────────────────────────────────────

  describe('GET /health/ready', () => {
    it('returns ok result when all checks pass', async () => {
      const okResult = {
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' }, redis: { status: 'up' } },
      };

      await buildController({ check: jest.fn().mockResolvedValue(okResult) });
      const result = await controller.readiness();

      expect(result.status).toBe('ok');
      expect((healthService.check as jest.Mock)).toHaveBeenCalledTimes(1);
    });

    it('propagates error when database is down', async () => {
      const dbDownError = new HealthCheckError('DB down', {
        status: 'error',
        info: {},
        error: { database: { status: 'down' } },
        details: { database: { status: 'down' } },
      });

      await buildController({ check: jest.fn().mockRejectedValue(dbDownError) });

      await expect(controller.readiness()).rejects.toThrow(HealthCheckError);
    });

    it('returns degraded when redis is down but db is up', async () => {
      const degradedResult = {
        status: 'error',
        info: { database: { status: 'up' } },
        error: { redis: { status: 'down' } },
        details: { database: { status: 'up' }, redis: { status: 'down' } },
      };

      // Terminus throws HealthCheckError for non-ok status
      const degradedError = new HealthCheckError('Redis down', degradedResult);
      await buildController({ check: jest.fn().mockRejectedValue(degradedError) });

      await expect(controller.readiness()).rejects.toThrow(HealthCheckError);
    });
  });

  // ── deep ──────────────────────────────────────────────────────────────────

  describe('GET /health/deep', () => {
    it('calls all five indicators', async () => {
      const okResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };

      await buildController({ check: jest.fn().mockResolvedValue(okResult) });
      await controller.deep();

      // health.check is called with an array of 5 factory functions
      const checkCall = (healthService.check as jest.Mock).mock.calls[0][0] as (() => unknown)[];
      expect(checkCall).toHaveLength(5);
    });

    it('returns degraded when one optional dependency is down', async () => {
      const degradedResult = {
        status: 'error',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          smtp: { status: 'up' },
          cloudinary: { status: 'up' },
        },
        error: { stellar_rpc: { status: 'down', error: 'timeout' } },
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          stellar_rpc: { status: 'down' },
          smtp: { status: 'up' },
          cloudinary: { status: 'up' },
        },
      };

      const degradedError = new HealthCheckError('Stellar down', degradedResult);
      await buildController({ check: jest.fn().mockRejectedValue(degradedError) });

      await expect(controller.deep()).rejects.toThrow(HealthCheckError);
    });
  });
});
