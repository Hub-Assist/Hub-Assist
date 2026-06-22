# payment_escrow

Soroban smart contract that holds workspace booking payments in escrow until booking conditions are met, with configurable dispute windows per booking type.

## Overview

Funds are locked at escrow creation and can be:
- **Released** to the beneficiary after `release_time + dispute_window` elapses without a dispute.
- **Refunded** to the depositor by an admin at any time (e.g. cancellation).
- **Disputed** by the depositor within the dispute window, triggering arbitration.

## Dispute Window Configuration

Each booking type can have its own dispute window, allowing low-value bookings (hot-desk) to have a shorter window than high-value ones (private office).

### How it works

1. **Admin sets a per-type window** before or after any escrow is created:
   ```
   set_dispute_window(admin, booking_type: u32, window_seconds: u64)
   ```

2. **Escrow creation snapshots the window** — the value at the time `create_escrow` is called is stored on the `Escrow` struct. Subsequent admin changes to the config do **not** affect existing escrows.

3. **Fallback** — if no per-type config exists for a given `booking_type`, the `default_dispute_window` set during `initialize` is used.

4. **Enforcement** — calling `dispute()` after `release_time + dispute_window` returns `DisputeWindowExpired`.

### Booking type constants (suggested)

| Booking Type | `booking_type` value | Suggested window |
|---|---|---|
| Hot Desk | `1` | 2 days (`172_800` s) |
| Private Office | `2` | 7 days (`604_800` s) |

### Example setup

```rust
// Initialize with a 3-day default window
client.initialize(&admin, &token, &(3 * 24 * 3600));

// Override for hot-desk (2 days)
client.set_dispute_window(&admin, &1u32, &(2 * 24 * 3600));

// Override for private-office (7 days)
client.set_dispute_window(&admin, &2u32, &(7 * 24 * 3600));

// Create a hot-desk escrow — snapshots 2-day window
let escrow_id = client.create_escrow(&depositor, &beneficiary, &amount, &release_time, &1u32);
```

## Functions

| Function | Auth | Description |
|---|---|---|
| `initialize(admin, payment_token, default_dispute_window)` | admin | One-time setup |
| `set_dispute_window(admin, booking_type, window_seconds)` | admin | Set per-type dispute window |
| `create_escrow(depositor, beneficiary, amount, release_time, booking_type)` | depositor | Lock funds; snapshots dispute window |
| `release(caller, escrow_id)` | beneficiary or admin | Release funds after window elapses |
| `refund(caller, escrow_id)` | admin or depositor | Return funds to depositor |
| `dispute(depositor, escrow_id, evidence_hash)` | depositor | Raise dispute within window |
| `submit_evidence(caller, escrow_id, evidence_hash)` | depositor or beneficiary | Attach evidence to open dispute |
| `vote_resolution(arbitrator, escrow_id, decision)` | registered arbitrator | Cast arbitration vote |
| `expire_dispute(escrow_id)` | anyone | Auto-refund after 30-day arbitration timeout |
| `try_auto_release(caller, escrow_id)` | any authenticated caller | Permissionless release after `release_time` |
| `get_escrow(id)` | — | Read escrow state |
| `list_depositor_escrows(depositor)` | — | List escrows by depositor |
| `list_beneficiary_escrows(beneficiary)` | — | List escrows by beneficiary |

## Errors

| Code | Name | Description |
|---|---|---|
| 1 | `AdminNotSet` | Contract not initialized |
| 2 | `Unauthorized` | Caller is not permitted |
| 3 | `EscrowNotFound` | No escrow with given ID |
| 4 | `EscrowAlreadyReleased` | Escrow is already released or refunded |
| 5 | `EscrowInDispute` | Escrow is currently disputed |
| 6 | `DisputeWindowActive` | Release attempted before window expires |
| 7 | `InsufficientBalance` | Insufficient token balance |
| 8 | `PaymentTokenNotSet` | Payment token not configured |
| 9 | `InvalidAmount` | Amount must be positive |
| 10 | `NotYetReleasable` | `release_time` has not passed |
| 11 | `AlreadyProcessed` | Escrow already processed |
| 12 | `DisputeWindowExpired` | Dispute raised after window closed |

## Build & Test

```bash
# Build
cd contracts/payment_escrow
stellar contract build

# Test
cargo test
```
