# Structured Logging & Correlation ID

## Overview

HubAssist uses **[Pino](https://getpino.io)** via **[nestjs-pino](https://github.com/iamolegga/nestjs-pino)** as its structured JSON logger. Every log line is a single JSON object written to stdout, making it trivially parseable by log aggregators (Datadog, Loki, CloudWatch, etc.).

---

## Log Format

Every log line emitted by the application includes these fields:

| Field          | Type     | Always present | Description                                              |
|----------------|----------|----------------|----------------------------------------------------------|
| `level`        | string   | ✅             | `"trace"` `"debug"` `"info"` `"warn"` `"error"` `"fatal"` |
| `time`         | number   | ✅             | Unix epoch milliseconds                                  |
| `correlationId`| string   | ✅             | UUID v4 — ties all log lines for one HTTP request together |
| `userId`       | string   | when authed    | Authenticated user's UUID, injected after JWT validation |
| `method`       | string   | HTTP logs      | HTTP verb (`GET`, `POST`, …)                             |
| `path`         | string   | HTTP logs      | Request URL path                                         |
| `statusCode`   | number   | HTTP logs      | HTTP response status code                                |
| `durationMs`   | number   | HTTP logs      | End-to-end request duration in milliseconds              |
| `msg`          | string   | ✅             | Human-readable log message                               |

### Example — production (raw JSON)

```json
{
  "level": "info",
  "time": 1748620800000,
  "correlationId": "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/v1/attendance/summary",
  "statusCode": 200,
  "durationMs": 42,
  "msg": "GET /api/v1/attendance/summary 200"
}
```

### Example — development (pino-pretty)

```
[12:00:00.000] INFO  [a1b2c3d4] GET /api/v1/attendance/summary 200 — 42ms
```

---

## Correlation ID

### What it is

A **UUID v4** that uniquely identifies a single HTTP request and all work performed on its behalf (database queries, downstream service calls, background tasks spawned within the same async context).

### How it flows

```
Client Request
  │
  ├─ Header: X-Correlation-ID: <uuid>   ← client may supply its own
  │
  ▼
HttpLoggerMiddleware
  ├─ Reads X-Correlation-ID header (or generates UUID v4 if absent)
  ├─ Writes correlationId into AsyncLocalStorage
  └─ Echoes header back: X-Correlation-ID: <uuid>
  │
  ▼
LoggingInterceptor  (runs after JWT guard)
  └─ Writes userId into AsyncLocalStorage store
  │
  ▼
Service / Repository calls
  └─ LoggerService.log() reads correlationId + userId from ALS automatically
  │
  ▼
Response
  └─ Header: X-Correlation-ID: <uuid>   ← always present in response
```

### AsyncLocalStorage

`correlationStorage` is a singleton `AsyncLocalStorage<{ correlationId, userId? }>` defined in `src/common/correlation/correlation.context.ts`. It is seeded once per request by `HttpLoggerMiddleware` and is readable anywhere in the call stack without passing it explicitly.

### Client usage

Send the header on every request to correlate your client-side logs with server logs:

```http
GET /api/v1/attendance/summary HTTP/1.1
Authorization: Bearer <token>
X-Correlation-ID: my-frontend-trace-id-123
```

The same value will appear in every server log line for that request and in the response header.

---

## Log Level

Controlled by the `LOG_LEVEL` environment variable.

| `NODE_ENV`    | Default level |
|---------------|---------------|
| `development` | `debug`       |
| `production`  | `info`        |

Override at runtime:

```bash
LOG_LEVEL=warn node dist/main
```

Valid values: `fatal` `error` `warn` `info` `debug` `trace` `silent`

---

## Sensitive Field Redaction

The following fields are **automatically redacted** by the pino-http serialiser before any transport sees them. They are replaced with `"[REDACTED]"`:

- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`
- `req.body.passwordHash`
- `req.body.token`
- `req.body.refreshToken`
- `req.body.otp`
- `req.body.newPassword`
- `req.body.currentPassword`

Service-level code must **never** pass raw sensitive values as `meta` to `LoggerService`. Log user IDs and resource IDs only.

---

## Development vs Production

| Mode          | Transport    | Format       |
|---------------|--------------|--------------|
| `development` | pino-pretty  | Colourised, human-readable |
| `production`  | stdout (async, non-blocking) | Raw JSON |

Health-check routes (`/health`, `/health/live`, `/health/ready`) are excluded from HTTP access logs to reduce noise.

---

## Using LoggerService in a Service

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class BookingsService {
  constructor(private readonly logger: LoggerService) {}

  async create(userId: string, dto: CreateBookingDto) {
    this.logger.log('Creating booking', { userId, workspaceId: dto.workspaceId });
    // correlationId is injected automatically — no need to pass it
    ...
  }
}
```

`LoggerService` is provided globally via `AppLoggerModule` — no need to import it per-module.
