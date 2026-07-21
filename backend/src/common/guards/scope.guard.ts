import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SCOPE_KEY } from '../decorators/require-scope.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.get<string>(REQUIRE_SCOPE_KEY, context.getHandler());
    if (!requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.scope) {
      throw new ForbiddenException('No scope provided');
    }

    const scopes = user.scope.split(' ');
    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException(`Required scope: ${requiredScope}`);
    }

    return true;
  }
}
