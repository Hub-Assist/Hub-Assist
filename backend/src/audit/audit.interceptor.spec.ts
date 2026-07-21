import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_EVENT_KEY } from './audit.decorator';

describe('AuditInterceptor', () => {
  it('captures actor, before state, after state, and request IP', (done) => {
    const reflector = {
      get: jest.fn((key) => (key === AUDIT_EVENT_KEY ? 'booking.confirmed' : undefined)),
    } as unknown as Reflector;
    const auditLogService = { log: jest.fn() };
    const interceptor = new AuditInterceptor(reflector, auditLogService as any);
    const handler = jest.fn();
    const request = {
      params: { id: 'booking-1' },
      user: { id: 'admin-1', role: 'admin' },
      ip: '127.0.0.1',
      auditBefore: { status: 'Pending' },
    };
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => request }),
    };

    interceptor
      .intercept(context as any, { handle: () => of({ id: 'booking-1', status: 'Confirmed' }) } as any)
      .subscribe({
        complete: () => {
          expect(auditLogService.log).toHaveBeenCalledWith({
            actorId: 'admin-1',
            actorRole: 'admin',
            eventType: 'booking.confirmed',
            resourceType: 'booking',
            resourceId: 'booking-1',
            before: { status: 'Pending' },
            after: { id: 'booking-1', status: 'Confirmed' },
            ipAddress: '127.0.0.1',
          });
          done();
        },
      });
  });
});
