import { Request } from 'express';

/**
 * Shape of `req.user` once JwtStrategy.validate() has run (see auth/jwt.strategy.ts).
 */
export interface AuthenticatedUser {
  id: string;
  sub: string;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
}

/**
 * Express Request carrying the correlation id (`req.id`) attached by pino-http.
 */
export interface RequestWithId extends Request {
  id: string;
}

/**
 * Express Request on a route guarded by JwtAuthGuard. `user` is optional at the
 * type level because this interface is also used ahead of/without that guard
 * (e.g. RedisThrottlerGuard runs on public routes too).
 */
export interface AuthenticatedRequest extends RequestWithId {
  user?: AuthenticatedUser;
  /** Set by controllers before a mutation so AuditInterceptor can log a before/after diff. */
  auditBefore?: unknown;
}
