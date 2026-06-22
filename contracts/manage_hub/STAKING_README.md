# StakingModule — Unstaking Cooldown

## Overview

The `StakingModule` enforces an **unstaking cooldown period** to prevent rapid stake/unstake cycles that could game reward calculations. When a staker initiates an unstake, their tokens (principal + accrued rewards) are locked in a `PendingWithdrawal` and can only be claimed after the cooldown has elapsed.

Default cooldown: **7 days**. Configurable by admin via `set_cooldown_days`.

---

## Cooldown Mechanics

### Unstake flow

```
staker calls unstake()
  │
  ├─ Lock period check: now >= staked_at + tier.lock_period_seconds
  │
  ├─ Rewards calculation frozen at unstake timestamp
  │   (rewards stop accruing on the unstaked amount)
  │
  ├─ PendingWithdrawal { amount: principal + rewards, claimable_at: now + cooldown }
  │   stored in persistent storage
  │
  └─ Active stake record removed (no further reward accrual)

After cooldown elapses, staker calls claim_unstaked()
  │
  ├─ Checks env.ledger().timestamp() >= claimable_at for each entry
  │
  ├─ Transfers all matured withdrawals to staker in a single call
  │
  └─ Immature withdrawals remain in the list for future claims
```

### Key properties

- **Rewards stop accruing** at the exact moment `unstake()` is called — not at claim time.
- **Each unstake is independent.** A partial unstake and a full unstake each get their own `PendingWithdrawal` with their own `claimable_at`.
- **Multiple pending withdrawals accumulate.** Calling `claim_unstaked()` sweeps all matured entries in one transaction; immature entries remain.
- **Emergency unstake bypasses the cooldown.** The penalty (default 5%) is the tradeoff.
- **Partial unstakes** (`partial_unstake`) follow the same cooldown path. The pro-rated rewards for the removed portion are locked alongside the principal.

---

## Storage

| Key | Type | Description |
|-----|------|-------------|
| `StakeKey::CooldownSecs` | `u64` | Cooldown duration in seconds (instance storage) |
| `StakeKey::PendingWithdrawals(Address)` | `Vec<PendingWithdrawal>` | Ordered list of pending withdrawals per staker |

The `PendingWithdrawal` struct (defined in `common_types`):

```rust
pub struct PendingWithdrawal {
    pub amount: i128,       // principal + rewards locked at unstake time
    pub claimable_at: u64,  // Unix timestamp after which claim is allowed
    pub staker: Address,    // owner of this withdrawal
}
```

---

## Functions

### `unstake(env, staker)`

Initiates an unstake for the caller's full active stake.

- Requires staker auth.
- Enforces tier lock period.
- Calculates rewards up to `now`; rewards **stop accruing** from this point.
- Creates a `PendingWithdrawal` in persistent storage.
- Removes the active `StakeInfo` record.
- Emits `("ust_pend", staker) → claimable_at`.

### `claim_unstaked(env, staker)`

Transfers all matured pending withdrawals to the staker.

- Requires staker auth.
- Panics `"no pending withdrawals"` if none exist.
- Panics `"cooldown not elapsed"` if no withdrawal is yet claimable.
- Transfers the total matured amount in one token transfer.
- Removes claimed entries; immature entries persist.
- Emits `("ust_clmd", staker) → total_claimed`.

### `set_cooldown_days(env, admin, days)`

Admin-only. Sets the cooldown duration.

- `days` must be > 0.
- New cooldown applies to **future** unstake calls only; existing `PendingWithdrawal` entries keep their original `claimable_at`.
- Emits `("cd_set", admin) → days`.

### `get_pending_withdrawals(env, staker) → Vec<PendingWithdrawal>`

Returns the full list of pending (unclaimed) withdrawals for a staker.

### `get_cooldown_secs(env) → u64`

Returns the configured cooldown in seconds.

---

## Events

| Topic | Data | Function |
|-------|------|----------|
| `("ust_pend", staker)` | `claimable_at: u64` | `unstake` |
| `("ust_clmd", staker)` | `total_claimed: i128` | `claim_unstaked` |
| `("cd_set", admin)` | `days: u64` | `set_cooldown_days` |
| `("pust_pend", staker)` | `(amount, claimable_at)` | `partial_unstake` |

---

## Testing

All cooldown tests are in `manage_hub/src/test.rs` under the `// Staking cooldown tests` section:

| Test | What it verifies |
|------|-----------------|
| `test_unstake_creates_pending_withdrawal_not_immediate_transfer` | `unstake()` creates a `PendingWithdrawal`; no tokens sent immediately |
| `test_unstake_removes_active_stake_record` | Active `StakeInfo` is removed after `unstake()` |
| `test_claim_unstaked_before_cooldown_panics` | `claim_unstaked()` before cooldown elapses panics |
| `test_claim_unstaked_after_cooldown_transfers_tokens` | After cooldown, tokens are correctly transferred |
| `test_claim_unstaked_with_no_withdrawals_panics` | No pending withdrawals → panic |
| `test_multiple_pending_withdrawals_independent_cooldowns` | Multiple partial unstakes accumulate; each has its own `claimable_at`; partial claims work correctly |
| `test_set_cooldown_days_changes_cooldown` | Admin can reconfigure cooldown duration |
| `test_cooldown_applies_configured_duration` | New cooldown is used for subsequent unstakes |
| `test_set_cooldown_days_non_admin_fails` | Non-admin cannot change cooldown |
| `test_set_cooldown_days_zero_panics` | Zero-day cooldown is rejected |
| `test_rewards_stop_accruing_after_unstake` | Reward amount is frozen at unstake time; no extra accrual during cooldown |

Run tests:

```bash
cd contracts
cargo test --package manage_hub
```
