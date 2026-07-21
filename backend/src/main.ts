import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './utils/error';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SanitizationPipe } from './common/pipes/sanitization.pipe';
import { VersionNegotiationMiddleware } from './common/middlewares/version-negotiation.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until the Pino logger is ready
    bufferLogs: true,
  });

  // Replace NestJS default logger with Pino structured JSON logger
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // URI versioning — all routes become /api/v{n}/...
  // defaultVersion: '1' means unversioned paths (e.g. /api/auth/login) also
  // resolve to v1, keeping backwards compatibility.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Version negotiation logging middleware — logs which API version each
  // request is targeting. Must be registered after enableVersioning().
  app.use(new VersionNegotiationMiddleware().use.bind(new VersionNegotiationMiddleware()));

  // Security headers
  app.use(helmet());

  // Response compression
  app.use(compression());

  // CORS — whitelist FRONTEND_URL, allow credentials
  app.enableCors({
    origin: configService.get('FRONTEND_URL'),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new SanitizationPipe(),
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // TransformInterceptor wraps all responses in { success, data, timestamp }
  // LoggingInterceptor is registered as APP_INTERCEPTOR in AppModule (needs DI)
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Swagger — per-version documents ────────────────────────────────────────

  // v1 document — all current endpoints
  const v1Config = new DocumentBuilder()
    .setTitle('HubAssist API — v1')
    .setDescription(
      'A comprehensive coworking and workspace management system powered by Stellar.\n\n' +
      '## Response Format\n\n' +
      'All successful responses are wrapped in a consistent envelope:\n\n' +
      '```json\n' +
      '{\n' +
      '  "success": true,\n' +
      '  "data": <payload>,\n' +
      '  "timestamp": "2026-05-27T16:00:00.000Z"\n' +
      '}\n' +
      '```\n\n' +
      'Error responses retain their original shape (statusCode, message, error, timestamp, path).\n\n' +
      '## JWT Revocation\n\n' +
      'Access tokens are immediately invalidated on logout and role-change events via a ' +
      'Redis-backed blacklist keyed on the `jti` claim. See the auth module README for details.\n\n' +
      '## Rate Limiting\n\n' +
      'All endpoints are rate-limited. Exceeded limits return **429 Too Many Requests** with:\n\n' +
      '| Header | Description |\n' +
      '|--------|-------------|\n' +
      '| `X-RateLimit-Limit` | Maximum requests allowed in the window |\n' +
      '| `X-RateLimit-Window` | Window duration in seconds |\n' +
      '| `Retry-After` | Seconds until the limit resets |\n\n' +
      'Stricter limits apply to auth endpoints: `/auth/login` (5/min), `/auth/resend-otp` (3/5min).\n\n' +
      '## Idempotency\n\n' +
      'State-mutating endpoints (`POST /bookings`, etc.) require an `X-Idempotency-Key` header.\n' +
      'Duplicate requests with the same key and user return the original response for 5 minutes.',
    )
    .setVersion('1.0.0')
    .addServer('/api/v1', 'Version 1 (current)')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();

  const v1Document = SwaggerModule.createDocument(app, v1Config, {
    include: [],          // include all modules
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/v1/docs', app, v1Document);

  // v2 document — placeholder for future breaking changes.
  // v1 endpoints remain fully operational; v2 will be introduced incrementally.
  const v2Config = new DocumentBuilder()
    .setTitle('HubAssist API — v2')
    .setDescription(
      '**v2 is under active development.** v1 endpoints remain fully operational.\n\n' +
      'Breaking changes will be introduced here without affecting v1 consumers.\n\n' +
      '> **Deprecation notice:** v1 endpoints will be sunset 12 months after v2 GA. ' +
      'Clients should migrate to v2 before that date.',
    )
    .setVersion('2.0.0')
    .addServer('/api/v2', 'Version 2 (preview)')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();

  const v2Document = SwaggerModule.createDocument(app, v2Config, {
    include: [],
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/v2/docs', app, v2Document);

  // Legacy docs alias — keeps /api/docs pointing to v1 for backwards compat.
  SwaggerModule.setup('api/docs', app, v1Document);

  await app.listen(3001);
  app.get(Logger).log('HubAssist API running on http://localhost:3001');
  app.get(Logger).log('Swagger UI (v1) → http://localhost:3001/api/v1/docs');
  app.get(Logger).log('Swagger UI (v2) → http://localhost:3001/api/v2/docs');
}
bootstrap();
