import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfService } from './csrf.service';

/**
 * Decorator to skip CSRF protection for specific routes.
 * Used for API-only endpoints (Bearer auth) and webhook callbacks.
 */
export const SkipCsrf = () => Reflector.createDecorator();

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private csrfService: CsrfService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only protect state-mutating methods
    if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      return true;
    }

    // Skip CSRF check if decorator is present
    const skipCsrf = this.reflector.get(SkipCsrf, context.getHandler());
    if (skipCsrf) {
      return true;
    }

    // Skip CSRF check for Bearer token authentication (API-only routes)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return true;
    }

    // For session-based requests, validate CSRF token
    const user = request.user;
    if (!user || !user.jti) {
      throw new ForbiddenException('CSRF validation failed: no user session');
    }

    const csrfToken = request.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    const isValid = await this.csrfService.verifyToken(user.jti, csrfToken);
    if (!isValid) {
      throw new ForbiddenException('CSRF token invalid or expired');
    }

    return true;
  }
}
