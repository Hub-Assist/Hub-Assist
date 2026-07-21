# Soft-Delete Cascade Rules

```mermaid
erDiagram
  users ||--o{ bookings : soft_delete_cascades
  users ||--o{ refresh_tokens : soft_delete_cascades
  users ||--o{ attendance : soft_delete_cascades
  workspaces ||--o{ bookings : future_confirmed_cancelled

  users {
    uuid id
    timestamp deletedAt
  }
  bookings {
    uuid id
    uuid userId
    uuid workspaceId
    enum status
    timestamp deletedAt
  }
  refresh_tokens {
    uuid id
    uuid userId
    timestamp deletedAt
  }
  attendance {
    uuid id
    uuid userId
    timestamp deletedAt
  }
  workspaces {
    uuid id
    timestamp deletedAt
  }
```

User soft-delete cascades to bookings, refresh tokens, and attendance records. Workspace soft-delete preserves booking history and cancels only future confirmed bookings.
