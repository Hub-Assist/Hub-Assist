import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_EVENT_KEY } from './audit.decorator';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const eventType = this.reflector.get<string>(AUDIT_EVENT_KEY, context.getHandler());
    if (!eventType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap((result) => {
        const resourceId = request.params?.id || result?.id;
        if (!resourceId) {
          return;
        }

        this.auditLogService.log({
          actorId: request.user?.id || request.user?.sub,
          actorRole: request.user?.role,
          eventType,
          resourceType: eventType.split('.')[0],
          resourceId,
          before: request.auditBefore,
          after: result,
          ipAddress: request.ip,
        });
      }),
    );
  }
}
