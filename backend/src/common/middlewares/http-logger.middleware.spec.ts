import { HttpLoggerMiddleware } from './http-logger.middleware';
import { correlationStorage } from '../correlation/correlation.context';
import { Request, Response } from 'express';

const makeReq = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers,
  method: 'GET',
  url: '/api/v1/test',
});

const makeRes = (): Partial<Response> => {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key.toLowerCase()] = value;
      return {} as Response;
    }),
    getHeader: jest.fn((key: string) => headers[key.toLowerCase()]),
    _headers: headers,
  } as any;
};

describe('HttpLoggerMiddleware', () => {
  let middleware: HttpLoggerMiddleware;

  beforeEach(() => {
    middleware = new HttpLoggerMiddleware();
  });

  // ── correlation ID generation ────────────────────────────────────────────

  it('generates a UUID v4 correlationId when header is absent', (done) => {
    const req = makeReq() as Request;
    const res = makeRes() as Response;

    middleware.use(req, res, () => {
      const store = correlationStorage.getStore();
      expect(store?.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      done();
    });
  });

  it('reuses the X-Correlation-ID header value when provided', (done) => {
    const req = makeReq({ 'x-correlation-id': 'my-trace-id' }) as Request;
    const res = makeRes() as Response;

    middleware.use(req, res, () => {
      const store = correlationStorage.getStore();
      expect(store?.correlationId).toBe('my-trace-id');
      done();
    });
  });

  it('echoes correlationId back in the response header', (done) => {
    const req = makeReq({ 'x-correlation-id': 'echo-me' }) as Request;
    const res = makeRes() as Response;

    middleware.use(req, res, () => {
      expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'echo-me');
      done();
    });
  });

  it('attaches correlationId to the request object', (done) => {
    const req = makeReq({ 'x-correlation-id': 'req-attach' }) as Request;
    const res = makeRes() as Response;

    middleware.use(req, res, () => {
      expect((req as any).correlationId).toBe('req-attach');
      done();
    });
  });

  // ── ALS propagation ──────────────────────────────────────────────────────

  it('propagates correlationId through AsyncLocalStorage to nested calls', (done) => {
    const req = makeReq({ 'x-correlation-id': 'propagate-test' }) as Request;
    const res = makeRes() as Response;

    middleware.use(req, res, () => {
      // Simulate a service call happening inside the request lifecycle
      function simulatedServiceCall(): string | undefined {
        return correlationStorage.getStore()?.correlationId;
      }

      expect(simulatedServiceCall()).toBe('propagate-test');
      done();
    });
  });

  it('isolates correlationId between concurrent requests', (done) => {
    const req1 = makeReq({ 'x-correlation-id': 'req-1' }) as Request;
    const req2 = makeReq({ 'x-correlation-id': 'req-2' }) as Request;
    const res1 = makeRes() as Response;
    const res2 = makeRes() as Response;

    let captured1: string | undefined;
    let captured2: string | undefined;
    let count = 0;

    const check = () => {
      if (++count === 2) {
        expect(captured1).toBe('req-1');
        expect(captured2).toBe('req-2');
        done();
      }
    };

    middleware.use(req1, res1, () => {
      // Yield to allow req2 to start
      setImmediate(() => {
        captured1 = correlationStorage.getStore()?.correlationId;
        check();
      });
    });

    middleware.use(req2, res2, () => {
      setImmediate(() => {
        captured2 = correlationStorage.getStore()?.correlationId;
        check();
      });
    });
  });
});
