import type { Params } from 'nestjs-pino';
import { correlationStorage } from '../common/correlation/correlation.context';

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

/**
 * Sensitive field names that must never appear in log output.
 * pino-http redacts these at the serialiser level before any transport sees them.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.otp',
  'req.body.newPassword',
  'req.body.currentPassword',
];

/**
 * nestjs-pino / pino-http configuration.
 *
 * Log format:
 * {
 *   "level": "info",
 *   "time": 1234567890123,
 *   "correlationId": "uuid-v4",
 *   "userId": "uuid | undefined",
 *   "method": "GET",
 *   "path": "/api/v1/attendance/summary",
 *   "statusCode": 200,
 *   "durationMs": 42,
 *   "msg": "request completed"
 * }
 *
 * In development pino-pretty formats the output for readability.
 * In production raw JSON is written to stdout (async, non-blocking).
 */
export const pinoLoggerConfig: Params = {
  pinoHttp: {
    level: logLevel,
    // Non-blocking async transport — never adds latency to the request path
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '[{correlationId}] {msg}',
          },
        }
      : undefined,

    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
    },

    // Merge correlationId + userId from AsyncLocalStorage into every log line
    customProps(req: any): Record<string, unknown> {
      const store = correlationStorage.getStore();
      const props: Record<string, unknown> = {
        correlationId: store?.correlationId ?? req.correlationId ?? 'unknown',
      };
      if (store?.userId) props['userId'] = store.userId;
      return props;
    },

    // Structured request/response summary fields
    customSuccessMessage(req: any, res: any) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage(req: any, res: any, err: Error) {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },

    serializers: {
      req(req: any) {
        return {
          method: req.method,
          path: req.url,
          // Never log the full body — only safe metadata
        };
      },
      res(res: any) {
        return { statusCode: res.statusCode };
      },
    },

    // Map HTTP status codes to log levels
    customLogLevel(_req: any, res: any, err: Error | undefined) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    // Rename pino-http's default "responseTime" to "durationMs" for clarity
    customAttributeKeys: {
      responseTime: 'durationMs',
    },

    // Exclude noisy health-check routes from logs
    autoLogging: {
      ignore(req: any) {
        return /^\/(api\/)?health/.test(req.url ?? '');
      },
    },
  },
};
