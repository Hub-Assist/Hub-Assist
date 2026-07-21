# HubAssist Backend

NestJS REST API for the HubAssist platform.

## Database Migrations

TypeORM migrations are used instead of `synchronize: true`. The `synchronize` flag is only enabled in the `test` environment.

### Setup

Ensure `DATABASE_URL` is set in `backend/.env`.

### Commands

```bash
# Generate a new migration (diff entities vs current DB schema)
npm run migration:generate src/migrations/<MigrationName>

# Apply all pending migrations
npm run migration:run

# Revert the last applied migration
npm run migration:revert
```

### Workflow

1. Modify or add entity files under `src/`.
2. Run `migration:generate` — TypeORM diffs the entities against the live schema and writes a new migration file to `src/migrations/`.
3. Review the generated migration file before committing.
4. Run `migration:run` to apply it locally.
5. In production, migrations run automatically on startup (`migrationsRun: true`).

### Migration files

All migration files live in `src/migrations/`. They are compiled to `dist/migrations/` during `npm run build` and executed from there in production.

## Webhooks

Admins can register callback subscriptions with:

```http
POST /api/v1/webhooks
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "url": "https://example.com/hubassist/webhooks",
  "eventTypes": ["booking.confirmed", "member.joined"]
}
```

The response includes the generated secret only at creation time. Secrets are hashed for lookup/audit, encrypted for delivery signing, and never returned again.

Delivery payloads are JSON event bodies. HubAssist includes:

| Header | Description |
|---|---|
| `X-Hub-Event` | Event type, for example `booking.confirmed`. |
| `X-Hub-Delivery` | Unique delivery ID. |
| `X-Hub-Signature-256` | `sha256=<hex-hmac>` HMAC-SHA256 signature over the raw JSON payload. |

Retry schedule: failed callbacks are retried up to 8 times using exponential backoff: `1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s`.

Example event body:

```json
{
  "eventType": "booking.confirmed",
  "data": {
    "id": "booking-1",
    "workspaceId": "workspace-1",
    "userId": "user-1"
  },
  "createdAt": "2026-05-31T00:00:00.000Z"
}
```

Signature verification:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(secret: string, rawBody: string, signature: string) {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```
