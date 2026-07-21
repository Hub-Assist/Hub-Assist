import { UnprocessableEntityException, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyMiddleware } from './idempotency.middleware';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret';

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId, email: 'u@test.com' }, TEST_SECRET, { expiresIn: '1h' });
}

function makeReq(overrides: Partial<Request> & { userId?: string } = {}): Request {
  const { userId, ...rest } = overrides;
  const token = userId ? makeToken(userId) : undefined;
  return {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...rest,
  } as unknown as Request;
}

function makeRes(): Response & { _status: number; _body: unknown } {
  const res: any = {
    _status: 200,
    _body: undefined,
    statusCode: 200,
  };
  res.status = jest.fn((code: number) => {
    res._status = code;
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res._body = body;
    return res;
  });
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IdempotencyMiddleware', () => {
  let middleware: IdempotencyMiddleware;
  let mockCache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyMiddleware,
        { provide: CACHE_MANAGER, useValue: mockCache },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(TEST_SECRET) },
        },
      ],
    }).compile();

    middleware = module.get<IdempotencyMiddleware>(IdempotencyMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Header validation ────────────────────────────────────────────────────

  it('throws 422 when X-Idempotency-Key header is missing', async () => {
    const req = makeReq({ userId: 'user-1', headers: {} });
    const res = makeRes();
    await expect(middleware.use(req, res, jest.fn())).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws 422 when key contains whitespace', async () => {
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'bad key';
    const res = makeRes();
    await expect(middleware.use(req, res, jest.fn())).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws 422 when key is empty string', async () => {
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = '';
    const res = makeRes();
    await expect(middleware.use(req, res, jest.fn())).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws 422 when key exceeds 128 characters', async () => {
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'a'.repeat(129);
    const res = makeRes();
    await expect(middleware.use(req, res, jest.fn())).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws 401 when no valid Bearer token is present', async () => {
    const req = makeReq(); // no userId → no token
    (req.headers as any)['x-idempotency-key'] = 'valid-key';
    const res = makeRes();
    await expect(middleware.use(req, res, jest.fn())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── First request (cache miss) ───────────────────────────────────────────

  it('calls next() and stores in-flight sentinel on first request', async () => {
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'key-abc';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledWith(
      'idempotency:user-1:key-abc',
      '__IN_FLIGHT__',
      expect.any(Number),
    );
  });

  it('captures and caches the response when res.json is called with 2xx status', async () => {
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'key-abc';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    // Simulate route handler calling res.json
    res.json({ id: 'booking-1' });

    // Wait for async cache.set
    await new Promise((r) => setImmediate(r));

    expect(mockCache.set).toHaveBeenCalledWith(
      'idempotency:user-1:key-abc',
      { statusCode: 200, body: { id: 'booking-1' } },
      expect.any(Number),
    );
  });

  it('removes in-flight sentinel and does NOT cache on error response', async () => {
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'key-err';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    // Simulate a 409 error response from the route handler
    res.status(409);
    res.json({ message: 'conflict' });

    await new Promise((r) => setImmediate(r));

    // Should NOT have cached the error response
    const setCalls = mockCache.set.mock.calls;
    const cachedResponseCall = setCalls.find(
      ([key, val]) => key === 'idempotency:user-1:key-err' && val !== '__IN_FLIGHT__',
    );
    expect(cachedResponseCall).toBeUndefined();

    // Should have deleted the in-flight sentinel
    expect(mockCache.del).toHaveBeenCalledWith('idempotency:user-1:key-err');
  });

  // ── Duplicate request (cache hit) ────────────────────────────────────────

  it('replays cached response and does NOT call next() on duplicate key', async () => {
    mockCache.get.mockResolvedValue({ statusCode: 201, body: { id: 'booking-1' } });

    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'key-abc';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'booking-1' });
  });

  it('returns 409 when the same key is in-flight (concurrent duplicate)', async () => {
    mockCache.get.mockResolvedValue('__IN_FLIGHT__');

    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'key-abc';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  // ── Cross-user key isolation ─────────────────────────────────────────────

  it('scopes cache key per user so different users with same key are independent', async () => {
    // user-2 has a cached response for the same idempotency key
    mockCache.get.mockImplementation(async (key: string) => {
      if (key === 'idempotency:user-2:shared-key') {
        return { statusCode: 201, body: { id: 'booking-2' } };
      }
      return null;
    });

    // user-1 should NOT get user-2's cached response
    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'shared-key';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    // next() must be called — user-1 has no cached entry for this key
    expect(next).toHaveBeenCalledTimes(1);
    // Cache was checked with user-1's scoped key, not user-2's
    expect(mockCache.get).toHaveBeenCalledWith('idempotency:user-1:shared-key');
  });

  // ── Different keys create independent records ────────────────────────────

  it('calls next() for a different key even when another key is cached', async () => {
    mockCache.get.mockImplementation(async (key: string) => {
      if (key === 'idempotency:user-1:key-old') {
        return { statusCode: 201, body: { id: 'booking-old' } };
      }
      return null;
    });

    const req = makeReq({ userId: 'user-1' });
    (req.headers as any)['x-idempotency-key'] = 'key-new';
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
