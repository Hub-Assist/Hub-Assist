import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';
import { correlationStorage } from '../correlation/correlation.context';

/**
 * LoggingInterceptor
 *
 * Logs every HTTP request with method, path, statusCode, and durationMs.
 * Reads userId from the authenticated request and writes it into the
 * AsyncLocalStorage store so all downstream log lines carry it automatically.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();

    // Once JWT guard has run, req.user is populated — write userId into ALS
    const userId: string | undefined = req.user?.id;
    const store = correlationStorage.getStore();
    if (store && userId && !store.userId) {
      store.userId = userId;
    }

    this.logger.log(`→ ${method} ${url}`, { method, path: url });

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log(`← ${method} ${url}`, {
            method,
            path: url,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
          });
        },
        error: (err: Error) => {
          this.logger.error(`✗ ${method} ${url} — ${err.message}`, {
            method,
            path: url,
            durationMs: Date.now() - start,
            error: err.message,
          });
        },
      }),
    );
  }
}
