# Hub-Assist Event Schema Documentation

This document defines the **standardized event schema** used across all Hub-Assist Soroban contracts.

## Standard Format

All events follow this **three-topic** structure:

```rust
("hubassist", "<contract_name>", "<action>")
```

Topic 0: `hubassist` (namespace)
Topic 1: Contract name (e.g. `access_control`, `membership_token`, `payment_escrow`)
Topic 2: Action name (e.g. `set_role`, `issue`, `dispute`)

This format enables reliable off-chain indexing without custom parsers per contract.

## Compatibility and helper usage

All contracts should emit events through the shared helper:

```rust
use common_types::publish_event;
```

The helper emits both:

- the new standardized topic tuple: `("hubassist", contract, action)`
- the original legacy topics used by older listeners

This preserves backwards compatibility while making the canonical schema explicit for new consumers.

## Event Catalog

### access_control

Standard topic: `("hubassist", "access_control", "<action>")`

- `init`
  - data: `()`
  - legacy topic: `("init", admin)`
- `set_role`
  - data: `role`
  - legacy topic: `("set_role", user)`
- `rm_role`
  - data: `()`
  - legacy topic: `("rm_role", user)`
- `pause`
  - data: `()`
  - legacy topic: `("pause",)`
- `unpause`
  - data: `()`
  - legacy topic: `("unpause",)`
- `proposal`
  - data: `proposal_id`
  - legacy topic: `("proposal", proposer)`
- `approved`
  - data: `proposal_id`
  - legacy topic: `("approved", approver)`
- `set_admin`
  - data: `new_admin`
  - legacy topic: `("set_admin",)`
- `upg_exec`
  - data: `new_wasm_hash`
  - legacy topic: `("upg_exec",)`
- `migrated`
  - data: `()`
  - legacy topic: `("migrated",)`

### membership_token

Standard topic: `("hubassist", "membership_token", "<action>")`

- `paused`
  - data: `admin`
  - legacy topic: `("paused",)`
- `unpaused`
  - data: `admin`
  - legacy topic: `("unpaused",)`
- `issue`
  - data: `id`
  - legacy topic: `("issue", owner)`
- `transfer`
  - data: `(id, new_owner)`
  - legacy topic: `("transfer", old_owner)`
- `status_tr`
  - data: `(id, current_status, new_status)`
  - legacy topic: `("status_tr",)`
- `renew`
  - data: `(id, new_expiry_date)`
  - legacy topic: `("renew", token.owner)`
- `revoke`
  - data: `id`
  - legacy topic: `("revoke", token.owner)`

> Note: batch operations in `membership_token` reuse the same `issue` and `transfer` actions for each item emitted.

### payment_escrow

Standard topic: `("hubassist", "payment_escrow", "<action>")`

- `paused`
  - data: `admin`
  - legacy topic: `("paused",)`
- `unpaused`
  - data: `admin`
  - legacy topic: `("unpaused",)`
- `dispute`
  - data: `(escrow_id, evidence_hash)`
  - legacy topic: `("dispute",)`
- `evidence`
  - data: `(escrow_id, caller, evidence_hash)`
  - legacy topic: `("evidence",)`
- `arb_rel`
  - data: `escrow_id`
  - legacy topic: `("arb_rel",)`
- `arb_ref`
  - data: `escrow_id`
  - legacy topic: `("arb_ref",)`
- `vote`
  - data: `(escrow_id, arbitrator, decision)`
  - legacy topic: `("vote",)`
- `disp_exp`
  - data: `escrow_id`
  - legacy topic: `("disp_exp",)`
- `auto_rel`
  - data: `(caller, escrow_id)`
  - legacy topic: `("auto_rel", caller)`

### workspace_booking

Standard topic: `("hubassist", "workspace_booking", "<action>")`

- `book`
  - data: `id`
  - legacy topic: `("book", workspace_id)`
- `confirm_b`
  - data: `booking_id`
  - legacy topic: `("confirm_b",)`
- `batch_ok`
  - data: `(admin, count)`
  - legacy topic: `("batch_ok",)`
- `cancel`
  - data: `booking_id`
  - legacy topic: `("cancel",)`
- `state_chg`
  - data: `(old_state, new_state)`
  - legacy topic: `("state_chg", workspace_id)`

### manage_hub_subscription

Standard topic: `("hubassist", "manage_hub_subscription", "<action>")`

- `tier_feat`
  - data: `(tier, features.len())`
  - legacy topic: `("tier_feat",)`
- `sub_new`
  - data: `(user, tier_id, amount)`
  - legacy topic: `("sub_new",)`
- `sub_cncl`
  - data: `(user,)`
  - legacy topic: `("sub_cncl",)`
- `sub_paus`
  - data: `(user, reason)`
  - legacy topic: `("sub_paus",)`
- `sub_res`
  - data: `(user,)`
  - legacy topic: `("sub_res",)`
- `sub_renw`
  - data: `(user, new_expiry)`
  - legacy topic: `("sub_renw",)`

### manage_hub_rewards

Standard topic: `("hubassist", "manage_hub_rewards", "<action>")`

- `rwrd_clm`
  - data: `(staker, pending)`
  - legacy topic: `("rwrd_clm",)`
- `merkle_rt`
  - data: `(merkle_root, total_amount)`
  - legacy topic: `("merkle_rt",)`
- `claim_rwd`
  - data: `(claimant, amount)`
  - legacy topic: `("claim_rwd",)`

### manage_hub_membership_token

Standard topic: `("hubassist", "manage_hub_membership_token", "<action>")`

- `transfer`
  - data: `(id, old_user, new_user)`
  - legacy topic: `("transfer",)`
- `revoked`
  - data: `(id,)`
  - legacy topic: `("revoked",)`
