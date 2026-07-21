# Audit Events

Audit logs are append-only. PostgreSQL triggers reject `UPDATE` and `DELETE` against `audit_logs`.

Default retention: `730` days, configurable with `AUDIT_LOG_RETENTION_DAYS`.

| Event | Resource | Captures |
|---|---|---|
| `user.role_updated` | `user` | Actor, before role/user state, after role/user state, IP address. |
| `booking.confirmed` | `booking` | Actor, booking state before confirmation, confirmed booking state, IP address. |
| `workspace.updated` | `workspace` | Actor, workspace state before update, updated workspace state, IP address. |
