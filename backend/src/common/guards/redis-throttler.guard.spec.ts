import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerGuard } from './redis-throttler.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: { ip?: string; userId?: string } = {}): ExecutionContext {
  const req: any = {
    ip: overrides.ip ?? '127.0.0.1',
    user: overrides.userId ? { id: overrides.userId } : undefined,
    headers: {},
    method: 'POST',
    url: '/api/v1/auth/login',
  };
  const res: any = {
    _headers: {} as Record<string, string | number>,
    setHeader: jest.fn((name: string, value: string | number) => {
      res._headers[name] = value;
    }),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedisThrottlerGuard', () => {
  let guard: RedisThrottlerGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 5 }]),
      ],
      providers: [RedisThrottlerGuard],
    }).compile();

    guard = module.get<RedisThrottlerGuard>(RedisThrottlerGuard);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Tracker key ─────────────────────────────────────────────────────────

  it('uses user ID as tracker key when user is authenticated', async () => {
    const ctx = makeContext({ userId: 'user-abc', ip: '10.0.0.1' });
    const req = ctx.switchToHttp().getRequest();
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('user-abc');
  });

  it('falls back to IP when user is not authenticated', async () => {
    const ctx = makeContext({ ip: '192.168.1.1' });
    const req = ctx.switchToHttp().getRequest();
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('192.168.1.1');
  });

  it('uses sub field as fallback when id is absent', async () => {
    const ctx = makeContext();
    const req = ctx.switchToHttp().getRequest();
    req.user = { sub: 'sub-xyz' };
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('sub-xyz');
  });

  // ── Rate-limit headers on throttle exception ─────────────────────────────

  it('sets Retry-After and X-RateLimit-* headers when limit is exceeded', async () => {
    const ctx = makeContext({ ip: '10.0.0.2' });
    const res = ctx.switchToHttp().getResponse<any>();

    const throttlerDetail = {
      limit: 5,
      ttl: 60_000,
      key: 'test-key',
      tracker: '10.0.0.2',
      totalHits: 6,
      timeToExpire: 45_000,
      isBlocked: true,
      timeToBlockExpire: 45_000,
    };

    // throwThrottlingException calls super which throws — we just verify headers
    try {
      await (guard as any).throwThrottlingException(ctx, throttlerDetail);
    } catch {
      // Expected to throw ThrottlerException
    }

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 60);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  // ── handleRequest sets informational headers ─────────────────────────────

  it('sets X-RateLimit-Limit and X-RateLimit-Window headers on successful request', async () => {
    const ctx = makeContext({ userId: 'user-1' });
    const res = ctx.switchToHttp().getResponse<any>();

    // Stub super.handleRequest to avoid hitting the real throttle store
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'handleRequest')
      .mockResolvedValueOnce(true);

    const throttlerRequest = {
      context: ctx,
      limit: 10,
      ttl: 60_000,
      throttler: { name: 'default', ttl: 60_000, limit: 10 },
      blockDuration: 0,
      key: 'test',
      tracker: 'user-1',
      totalHits: 1,
      timeToExpire: 60_000,
      isBlocked: false,
      timeToBlockExpire: 0,
    };

    await (guard as any).handleRequest(throttlerRequest);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Window', 60);
  });
});
