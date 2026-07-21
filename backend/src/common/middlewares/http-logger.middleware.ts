import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { correlationStorage } from '../correlation/correlation.context';

/**
 * HttpLoggerMiddleware
 *
 * 1. Reads X-Correlation-ID from the incoming request header; generates a
 *    UUID v4 if absent.
 * 2. Echoes the correlation ID back in the response header so clients can
 *    trace their own requests.
 * 3. Seeds AsyncLocalStorage so every log line emitted during this request
 *    automatically carries correlationId (and userId once auth runs).
 * 4. Logs method, path, statusCode, and durationMs on response finish via
 *    pino-http (configured in main.ts); this middleware only manages context.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? uuidv4();

    // Echo back so the caller can correlate their own logs
    res.setHeader('x-correlation-id', correlationId);

    // Attach to request object for downstream access (e.g. exception filter)
    (req as any).correlationId = correlationId;

    // Run the rest of the request inside the ALS context
    correlationStorage.run({ correlationId }, () => next());
  }
}
