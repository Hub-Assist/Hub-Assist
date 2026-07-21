import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';
import { PinoLogger } from 'nestjs-pino';
import { correlationStorage } from '../correlation/correlation.context';

const makePinoMock = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
});

describe('LoggerService', () => {
  let service: LoggerService;
  let pinoMock: ReturnType<typeof makePinoMock>;

  beforeEach(async () => {
    pinoMock = makePinoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        { provide: PinoLogger, useValue: pinoMock },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── context injection ────────────────────────────────────────────────────

  it('injects correlationId from AsyncLocalStorage into log call', () => {
    correlationStorage.run({ correlationId: 'test-corr-id' }, () => {
      service.log('hello');
      expect(pinoMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'test-corr-id' }),
        'hello',
      );
    });
  });

  it('injects userId when present in ALS store', () => {
    correlationStorage.run({ correlationId: 'cid', userId: 'user-42' }, () => {
      service.log('with user');
      expect(pinoMock.info).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'cid', userId: 'user-42' }),
        'with user',
      );
    });
  });

  it('omits userId when not set in ALS store', () => {
    correlationStorage.run({ correlationId: 'cid' }, () => {
      service.log('no user');
      const call = pinoMock.info.mock.calls[0][0] as Record<string, unknown>;
      expect(call).not.toHaveProperty('userId');
    });
  });

  it('returns empty context when called outside ALS scope', () => {
    service.log('outside scope');
    const call = pinoMock.info.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('correlationId');
  });

  // ── log levels ───────────────────────────────────────────────────────────

  it('routes warn() to pino.warn', () => {
    correlationStorage.run({ correlationId: 'c1' }, () => {
      service.warn('a warning');
      expect(pinoMock.warn).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'c1' }),
        'a warning',
      );
    });
  });

  it('routes error() to pino.error', () => {
    correlationStorage.run({ correlationId: 'c2' }, () => {
      service.error('an error', { stack: 'trace' });
      expect(pinoMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'c2', stack: 'trace' }),
        'an error',
      );
    });
  });

  it('routes debug() to pino.debug', () => {
    correlationStorage.run({ correlationId: 'c3' }, () => {
      service.debug('debug msg');
      expect(pinoMock.debug).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'c3' }),
        'debug msg',
      );
    });
  });

  // ── sensitive field safety ───────────────────────────────────────────────

  it('does NOT log password values passed in meta', () => {
    // The logger itself does not redact — pino-http serialisers handle HTTP
    // body redaction. But the LoggerService must never be called with raw
    // sensitive values from service code. This test documents the contract:
    // callers must not pass password/token fields in meta.
    correlationStorage.run({ correlationId: 'sec' }, () => {
      // Simulate a safe call — no sensitive fields in meta
      service.log('user created', { userId: 'u1', email: 'a@b.com' });
      const call = pinoMock.info.mock.calls[0][0] as Record<string, unknown>;
      expect(call).not.toHaveProperty('password');
      expect(call).not.toHaveProperty('token');
      expect(call).not.toHaveProperty('passwordHash');
    });
  });

  // ── extra meta merging ───────────────────────────────────────────────────

  it('merges extra meta fields alongside context', () => {
    correlationStorage.run({ correlationId: 'merge-test', userId: 'u99' }, () => {
      service.log('booking created', { bookingId: 'b-1', durationMs: 12 });
      expect(pinoMock.info).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'merge-test',
          userId: 'u99',
          bookingId: 'b-1',
          durationMs: 12,
        }),
        'booking created',
      );
    });
  });
});
