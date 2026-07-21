# Auth Module

NestJS authentication module for HubAssist. Handles registration, OTP verification,
JWT issuance, refresh-token rotation, biometric (WebAuthn) login, and password reset.

---

## JWT Revocation Strategy

### Problem

Standard JWTs are stateless — once issued, they remain valid until their `exp` claim
is reached. This means a token cannot be invalidated on logout, role change, or a
security incident without waiting for natural expiry (default: 1 hour).

### Solution — Redis-backed `jti` blacklist

Every access token now carries a `jti` (JWT ID) claim — a UUID v4 generated at sign
time. On revocation events the `jti` is stored in Redis with a TTL equal to the
token's remaining lifetime. `JwtStrategy.validate()` performs a single Redis `GET`
on every authenticated request to check whether the `jti` has been revoked.

```
┌──────────┐  POST /auth/logout   ┌─────────────┐  SET blacklist:jti:<jti> TTL  ┌───────┐
│  Client  │ ──────────────────▶  │ AuthService │ ──────────────────────────────▶│ Redis │
└──────────┘                      └─────────────┘                                └───────┘

┌──────────┐  GET /api/v1/...     ┌─────────────┐  GET blacklist:jti:<jti>       ┌───────┐
│  Client  │ ──────────────────▶  │ JwtStrategy │ ──────────────────────────────▶│ Redis │
└──────────┘  Bearer <token>      └─────────────┘  null → allow / '1' → 401      └───────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| `jti` = UUID v4 | Unpredictable, globally unique, never reused |
| Single Redis `GET` per request | O(1) lookup; adds < 2 ms to request latency |
| TTL = remaining token lifetime | Blacklist entry auto-expires when the token would have expired anyway — no manual cleanup needed |
| In-memory fallback | When `REDIS_URL` is not set (CI / local dev without Redis) the `CacheModule` falls back to an in-memory store. Revocation still works within a single process; it is **not** distributed. Set `REDIS_URL` in production. |

### Revocation triggers

| Event | Where | What happens |
|---|---|---|
| `POST /api/v1/auth/logout` | `AuthController.logout` | `jti` + `exp` extracted from `req.user`; `AuthService.logout` blacklists the token and revokes all refresh tokens |
| `PATCH /api/v1/users/:id/role` | `UsersController.updateRole` | The admin's current access token is blacklisted immediately after the role update |
| Security incident | Call `AuthService.blacklistAccessToken(jti, exp)` directly | Blacklists any token whose `jti` and `exp` are known |

### Redis key format

```
blacklist:jti:<UUID v4>   →   '1'   (TTL = remaining token lifetime in ms)
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | _(none)_ | Redis connection string. Falls back to in-memory cache if absent. Required in production. |
| `JWT_SECRET` | _(required)_ | HMAC secret for signing access tokens. |
| `JWT_EXPIRES_IN` | `1h` | Access token lifetime (ms-style duration). |

---

## API Versioning

URI-based versioning is enabled globally in `main.ts`:

```ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

All controllers are annotated with `@Controller({ version: '1', path: '...' })`.

### URL structure

| Path | Resolves to |
|---|---|
| `/api/v1/auth/login` | v1 handler (explicit) |
| `/api/auth/login` | v1 handler (via `defaultVersion: '1'`) |
| `/api/v2/auth/login` | v2 handler (when introduced) |

### Swagger docs

| URL | Description |
|---|---|
| `/api/v1/docs` | v1 Swagger UI (current stable) |
| `/api/v2/docs` | v2 Swagger UI (preview / future) |
| `/api/docs` | Alias → v1 (backwards compat) |

### Deprecation policy

- v1 endpoints are **never removed** — they are deprecated with `@deprecated` Swagger
  annotations and a `Sunset` response header 12 months before removal.
- Breaking changes are introduced in v2 only.
- Version header negotiation (`X-API-Version`) can be added as a follow-up.
