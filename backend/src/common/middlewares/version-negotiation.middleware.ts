import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * VersionNegotiationMiddleware
 *
 * Logs which API version a client is targeting on every request.
 * Extracts the version from the URI path (e.g. /api/v1/...) and attaches it
 * to the request object as `req.apiVersion` for downstream use.
 *
 * This middleware is intentionally lightweight — it performs no routing logic
 * and adds negligible overhead.
 */
@Injectable()
export class VersionNegotiationMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ApiVersioning');

  /** Matches /api/v<digits>/ at the start of the path. */
  private static readonly VERSION_PATTERN = /^\/api\/v(\d+)\//;

  use(req: Request, _res: Response, next: NextFunction): void {
    const match = VersionNegotiationMiddleware.VERSION_PATTERN.exec(req.path);
    const version = match ? match[1] : '1'; // default to v1

    // Attach to request so controllers / interceptors can read it if needed.
    (req as any).apiVersion = version;

    this.logger.debug(
      `${req.method} ${req.path} → API v${version} [${req.ip ?? 'unknown'}]`,
    );

    next();
  }
}
