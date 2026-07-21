import {
  Injectable,
  NestMiddleware,
  UnprocessableEntityException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/** TTL for cached idempotent responses: 5 minutes in milliseconds */
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

/** Regex: 1–128 printable ASCII chars (no whitespace) */
const KEY_PATTERN = /^[\x21-\x7E]{1,128}$/;

/** Shape stored in cache for a completed request */
interface CachedResponse {
  statusCode: number;
  body: unknown;
}

/** Marker stored while a request is in-flight to detect concurrent duplicates */
const IN_FLIGHT_SENTINEL = '__IN_FLIGHT__';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const rawKey = req.headers['x-idempotency-key'] as string | undefined;

    // Header is required on state-mutating routes where this middleware is applied
    if (!rawKey) {
      throw new UnprocessableEntityException(
        'X-Idempotency-Key header is required for this endpoint',
      );
    }

    if (!KEY_PATTERN.test(rawKey)) {
      throw new UnprocessableEntityException(
        'X-Idempotency-Key must be 1–128 printable ASCII characters with no whitespace',
      );
    }

    // NestJS middleware runs before guards, so req.user is not yet populated.
    // We decode the JWT ourselves to extract the user ID for cache key scoping.
    // This is a read-only decode — full verification happens in JwtAuthGuard.
    const userId = this.extractUserIdFromToken(req);
    if (!userId) {
      throw new UnauthorizedException(
        'Valid Bearer token required to use idempotency key',
      );
    }

    const cacheKey = `idempotency:${userId}:${rawKey}`;

    // Check for an existing cached response
    const cached = await this.cache.get<CachedResponse | typeof IN_FLIGHT_SENTINEL>(cacheKey);

    if (cached === IN_FLIGHT_SENTINEL) {
      // A concurrent request with the same key is already being processed
      res.status(409).json({
        statusCode: 409,
        message: 'A request with this idempotency key is already being processed',
        error: 'Conflict',
      });
      return;
    }

    if (cached) {
      // Replay the stored response — same status, same body
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    // Mark as in-flight before handing off to the route handler
    await this.cache.set(cacheKey, IN_FLIGHT_SENTINEL, IDEMPOTENCY_TTL_MS);

    // Intercept res.json so we can capture the response body and status
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const statusCode = res.statusCode;

      // Only cache successful responses (2xx) — errors should be retryable
      if (statusCode >= 200 && statusCode < 300) {
        this.cache
          .set(cacheKey, { statusCode, body } satisfies CachedResponse, IDEMPOTENCY_TTL_MS)
          .catch(() => {
            // Non-fatal: worst case the next retry creates a new record
          });
      } else {
        // Remove the in-flight sentinel so the client can retry on errors
        this.cache.del(cacheKey).catch(() => {});
      }

      return originalJson(body);
    };

    next();
  }

  /**
   * Decodes (without verifying signature) the Bearer token to extract `sub`.
   * Full cryptographic verification is still performed by JwtAuthGuard later
   * in the request lifecycle. We only need the user ID here for cache scoping.
   */
  private extractUserIdFromToken(req: Request): string | null {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    try {
      const secret = this.configService.get<string>('JWT_SECRET') ?? process.env['JWT_SECRET'];
      if (!secret) return null;
      const payload = jwt.verify(token, secret) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      // Invalid / expired token — let JwtAuthGuard handle the 401
      return null;
    }
  }
}
