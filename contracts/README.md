# HubAssist Smart Contracts

Soroban smart contracts for the HubAssist platform, deployed on the Stellar blockchain.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HubAssist Platform                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ invokes
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐
  │ access_control│  │  manage_hub   │  │ workspace_booking │
  │               │  │               │  │                   │
  │ Role-based    │  │ Membership    │  │ Booking creation  │
  │ permissions   │  │ tokens,       │  │ & cancellation    │
  │ & multi-sig   │  │ subscriptions,│  │                   │
  │ proposals     │  │ staking,      │  │        │          │
  └───────────────┘  │ attendance    │  │        │ escrow   │
          │          └───────────────┘  │        ▼          │
          │ shared types                │ ┌──────────────┐  │
          ▼                             │ │payment_escrow│  │
  ┌───────────────┐                     │ │              │  │
  │ common_types  │◄────────────────────┘ │ Hold, release│  │
  │               │                       │ refund, and  │  │
  │ Shared enums, │                       │ dispute funds│  │
  │ structs, and  │                       └──────────────┘  │
  │ error types   │                                         │
  └───────────────┘                                         │
          ▲                                                  │
          │ shared types                                     │
  ┌───────────────┐                                         │
  │membership_token│◄────────────────────────────────────────┘
  │                │
  │ Issue, renew,  │
  │ revoke, and    │
  │ transfer SRC-20│
  │ membership NFTs│
  └────────────────┘
```

### Deployment order

`common_types` (library, no deploy) → `access_control` → `manage_hub` → `workspace_booking` → `payment_escrow` → `membership_token`

---

## Deployment

### Prerequisites

- Rust toolchain with `wasm32v1-none` target
- Stellar CLI ≥ 23.x
- A funded Stellar account on testnet

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli@23.1.3
stellar keys generate --global alice --network testnet --fund
```

### Automated deployment

```bash
cd contracts
./scripts/deploy.sh alice testnet
```

This builds all contracts, deploys them in dependency order, and writes contract IDs to `contracts/.env.contracts`.

### Initialize contracts

```bash
./scripts/initialize.sh alice <admin-address> <payment-token-address> testnet
```

### Manual deployment (single contract)

```bash
cd contracts
stellar contract build          # builds all workspace members

stellar contract deploy \
  --wasm target/wasm32v1-none/release/<contract>.wasm \
  --source-account alice \
  --network testnet \
  --alias <contract>
```

### Run tests

```bash
cd contracts
cargo test
```

---

## Function Reference

### `access_control`

Manages on-chain roles and multi-sig governance proposals.

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address, multisig_config: MultiSigConfig` | — | One-time setup. Sets admin and multi-sig thresholds. |
| `set_role` | `admin: Address, user: Address, role: UserRole` | `Result<()>` | Assign a role to a user. Admin only. |
| `get_role` | `user: Address` | `Result<MembershipInfo>` | Fetch role info for a user. |
| `check_access` | `user: Address, required_role: UserRole` | `bool` | Returns true if user meets or exceeds the required role. |
| `require_access` | `user: Address, required_role: UserRole` | `Result<()>` | Panics if user lacks the required role. |
| `is_admin` | `user: Address` | `bool` | Returns true if user is the admin. |
| `remove_role` | `admin: Address, user: Address` | `Result<()>` | Remove a user's role. Admin only. |
| `update_config` | `admin: Address, config: AccessControlConfig` | `Result<()>` | Update multi-sig config. Admin only. |
| `pause` | `admin: Address` | `Result<()>` | Pause the contract. Admin only. |
| `unpause` | `admin: Address` | `Result<()>` | Unpause the contract. Admin only. |
| `create_proposal` | `proposer: Address, action: ProposalAction` | `Result<u64>` | Create a governance proposal. Returns proposal ID. |
| `approve_proposal` | `approver: Address, proposal_id: u64` | `Result<()>` | Approve a pending proposal. |
| `execute_proposal` | `executor: Address, proposal_id: u64` | `Result<()>` | Execute an approved proposal after time-lock. |

**Types**

```
MultiSigConfig { threshold: u32, critical_threshold: u32, time_lock_duration: u64 }
UserRole: Guest(0) | Member(1) | Staff(2) | Admin(3)
ProposalAction: SetRole(Address, UserRole) | RemoveRole(Address) | SetAdmin(Address) | ScheduleUpgrade(Address)
```

---

### `manage_hub`

Core hub management: membership tokens, subscriptions, staking, attendance, and upgrades. Library-style modules — no standalone `initialize`.

| Module | Key Functions |
|---|---|
| `MembershipTokenContract` | `issue`, `transfer`, `batch_issue`, `batch_transfer` |
| `SubscriptionModule` | `create_subscription`, `cancel_subscription`, `get_subscription` |
| `StakingModule` | `stake`, `unstake`, `get_stake_info`, `claim_rewards` |
| `AttendanceLogModule` | `log_attendance`, `get_summary`, `get_peak_hours` |
| `TierManagementModule` | `create_tier`, `update_tier`, `get_tier` |
| `RewardsModule` | `distribute_rewards`, `claim_rewards` |
| `BatchModule` | `batch_update` |
| `UpgradeModule` | `upgrade` |
| `MigrationModule` | `migrate` |

---

### `workspace_booking`

Manages workspace registration and booking lifecycle.

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address, payment_token: Address` | — | One-time setup. |
| `register_workspace` | `caller: Address, name: String, workspace_type: WorkspaceType, capacity: u32, price_per_hour: i128` | `u32` | Register a new workspace. Admin only. Returns workspace ID. |
| `update_workspace_availability` | `caller: Address, workspace_id: u32, availability: WorkspaceAvailability` | `Result<()>` | Update availability status. Admin only. |
| `book` | `member: Address, workspace_id: u32, start_time: u64, end_time: u64, amount: i128, stellar_tx_hash: BytesN<32>` | `Result<u64>` | Create a booking. Validates time range, availability, payment, and overlaps. Returns booking ID. |
| `confirm` | `admin: Address, booking_id: u64` | `Result<()>` | Confirm a pending booking. Admin only. |
| `cancel` | `caller: Address, booking_id: u64` | `Result<()>` | Cancel a booking. Callable by the member or admin. |
| `get_workspace` | `id: u32` | `Result<Workspace>` | Fetch workspace by ID. |
| `list_workspaces` | — | `Vec<Workspace>` | List all registered workspaces. |
| `get_booking` | `booking_id: u64` | `Result<Booking>` | Fetch booking by ID. |
| `list_member_bookings` | `member: Address` | `Vec<Booking>` | List all bookings for a member. |

**Types**

```
WorkspaceType: Desk | PrivateOffice | MeetingRoom | EventSpace
WorkspaceAvailability: Available | Unavailable(UnavailabilityReason)
BookingStatus: Pending | Confirmed | Cancelled
```

---

### `payment_escrow`

Holds funds in escrow for bookings with dispute support.

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address, payment_token: Address, default_dispute_window: u64` | — | One-time setup. `default_dispute_window` is in seconds. |
| `create_escrow` | `depositor: Address, beneficiary: Address, amount: i128, release_time: u64` | `Result<u64>` | Lock funds in escrow. Transfers tokens from depositor. Returns escrow ID. |
| `release` | `caller: Address, escrow_id: u64` | `Result<()>` | Release funds to beneficiary. Callable by beneficiary or admin after `release_time + dispute_window`. |
| `refund` | `admin: Address, escrow_id: u64` | `Result<()>` | Refund depositor. Admin only. |
| `dispute` | `depositor: Address, escrow_id: u64` | `Result<()>` | Mark escrow as disputed. Depositor only, while Active. |
| `get_escrow` | `id: u64` | `Result<Escrow>` | Fetch escrow by ID. |
| `list_depositor_escrows` | `depositor: Address` | `Vec<Escrow>` | List all escrows created by depositor. |
| `list_beneficiary_escrows` | `beneficiary: Address` | `Vec<Escrow>` | List all escrows where address is beneficiary. |

**Types**

```
EscrowStatus: Active | Released | Refunded | Disputed
```

---

### `membership_token`

SRC-20-style membership tokens with tiers and expiry.

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `initialize` | `admin: Address` | — | One-time setup. |
| `issue_token` | `admin: Address, owner: Address, tier: u32, expiry_date: u64` | `Result<u64>` | Mint a new token. Returns token ID. |
| `transfer_token` | `id: u64, new_owner: Address` | `Result<()>` | Transfer token to new owner. Caller must be current owner. Blocked if Revoked, Expired, or GracePeriod. |
| `renew_token` | `admin: Address, id: u64, new_expiry_date: u64` | `Result<()>` | Extend token expiry. Admin only. |
| `revoke_token` | `admin: Address, id: u64` | `Result<()>` | Permanently revoke a token. Admin only. |
| `get_token` | `id: u64` | `Result<MembershipToken>` | Fetch token by ID. |
| `get_token_status` | `id: u64` | `Result<MembershipStatus>` | Get computed status (accounts for expiry). |
| `batch_issue_tokens` | `admin: Address, params: Vec<IssueParams>` | `Result<Vec<u64>>` | Mint multiple tokens atomically. |
| `batch_transfer_tokens` | `params: Vec<TransferParams>` | `Result<()>` | Transfer multiple tokens atomically. |

**Types**

```
MembershipStatus: Active | Expired | Revoked | GracePeriod
IssueParams { owner: Address, tier: u32, expiry_date: u64 }
TransferParams { id: u64, new_owner: Address }
```

---

### `common_types`

Library crate — not deployable. Provides shared enums, structs, and error types used across contracts.

---

## Event Reference

Events are published via `env.events().publish(topics, data)`.

### `workspace_booking`

| Topic | Data | Emitted by |
|---|---|---|
| `("book", workspace_id: u32)` | `booking_id: u64` | `book` |
| `("confirm",)` | `booking_id: u64` | `confirm` |
| `("cancel",)` | `booking_id: u64` | `cancel` |

### `membership_token`

| Topic | Data | Emitted by |
|---|---|---|
| `("issue", owner: Address)` | `token_id: u64` | `issue_token`, `batch_issue_tokens` |
| `("transfer", old_owner: Address)` | `(token_id: u64, new_owner: Address)` | `transfer_token`, `batch_transfer_tokens` |
| `("renew", owner: Address)` | `(token_id: u64, new_expiry_date: u64)` | `renew_token` |
| `("revoke", owner: Address)` | `token_id: u64` | `revoke_token` |

---

## Resources

- [Soroban Documentation](https://developers.stellar.org/docs/learn/soroban)
- [Stellar CLI Reference](https://developers.stellar.org/docs/tools/stellar-cli)
- [Soroban SDK](https://docs.rs/soroban-sdk/)
