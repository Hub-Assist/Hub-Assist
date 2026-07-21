# Stellar Payment Outbox Flow

```mermaid
sequenceDiagram
  participant API as Bookings API
  participant DB as PostgreSQL
  participant Worker as OutboxProcessorService
  participant Stellar as Stellar RPC

  API->>DB: Begin transaction
  API->>DB: Insert/update booking
  API->>DB: Insert outbox_events row
  API->>DB: Commit transaction
  Worker->>DB: Poll pending outbox events every 30s
  Worker->>Stellar: Publish payment event
  Stellar-->>Worker: Accepted / failed
  Worker->>DB: Mark sent or increment retryCount
  Worker->>DB: Mark failed after 5 retries
```

The booking write and outbox event insert commit atomically. Stellar RPC failures do not roll back the booking row; the worker retries pending events until the retry limit is reached.
