# Access Control Contract

A Soroban smart contract for role-based access control with multi-signature governance and timelocked proposal execution.

## Features

- **Role-Based Access Control**: Guest, Member, Staff, Admin roles with hierarchical permissions
- **Multi-Signature Governance**: Threshold-based proposal approval system
- **Timelocked Execution**: Configurable delay between approval and execution for critical operations
- **Pause/Unpause**: Admin can pause contract operations for emergency situations

## Proposal Lifecycle

### 1. Proposal Creation
- Any Staff or Admin can create a proposal
- Proposer automatically approves their own proposal
- Proposal is assigned a unique ID and stored on-chain
- Execution time is set to: `now + time_lock_duration`

### 2. Approval Phase
- Staff and Admin members can approve pending proposals
- Each approver can only approve once (duplicate approvals rejected)
- Approvals are tracked in a vector (max 10 approvers to prevent unbounded storage)
- Events emitted: `("proposal_approved", approver)` for each approval

### 3. Threshold Validation
- **Standard Operations** (SetRole, RemoveRole): Require `threshold` approvals
- **Critical Operations** (SetAdmin, ScheduleUpgrade): Require `critical_threshold` approvals
- `critical_threshold` must be ≥ 2 for security
- Proposal cannot execute if threshold not met

### 4. Timelock Window
- After threshold is reached, proposal enters timelock period
- Execution blocked until: `current_timestamp >= proposal.execution_time`
- Timelock duration is configurable by admin via `update_config()`
- Events emitted: `("proposal_ready", proposal_id)` when threshold reached

### 5. Execution
- Any user can execute a proposal once timelock expires and threshold is met
- Proposal action is applied atomically
- Proposal record is deleted after execution
- Events emitted: `("set_role", user)`, `("rm_role", user)`, `("set_admin", new_admin)`, or `("upgrade", hash)`

## Configuration

```rust
pub struct MultiSigConfig {
    pub threshold: u32,              // Approvals needed for normal proposals
    pub critical_threshold: u32,     // Approvals needed for critical proposals (≥ 2)
    pub time_lock_duration: u64,     // Seconds to wait after approval before execution
}
```

## Proposal Actions

| Action | Type | Threshold | Description |
|--------|------|-----------|-------------|
| `SetRole(Address, UserRole)` | Standard | `threshold` | Assign a role to a user |
| `RemoveRole(Address)` | Standard | `threshold` | Remove a user's role (reverts to Guest) |
| `SetAdmin(Address)` | Critical | `critical_threshold` | Transfer admin privileges |
| `ScheduleUpgrade(Address)` | Critical | `critical_threshold` | Schedule a contract upgrade |

## Error Handling

| Error | Code | Cause |
|-------|------|-------|
| `Unauthorized` | 1 | Caller lacks required permissions |
| `AdminNotSet` | 2 | Admin address not initialized |
| `UserNotFound` | 3 | User role not found |
| `ProposalNotFound` | 4 | Proposal ID does not exist |
| `AlreadyApproved` | 5 | Approver has already approved this proposal |
| `ThresholdNotMet` | 6 | Insufficient approvals for execution |
| `TimeLockActive` | 7 | Timelock period has not expired |
| `ContractPaused` | 8 | Contract is paused; operations blocked |

## Testing

Run tests with:
```bash
cd contracts/access_control
cargo test
```

### Test Coverage

- ✅ Proposal creation and approval flow
- ✅ Threshold validation (standard vs. critical)
- ✅ Duplicate approval prevention
- ✅ Timelock enforcement (blocks early execution, allows after expiry)
- ✅ Multi-approver scenarios
- ✅ Pause/unpause functionality
- ✅ Role-based access control

## Security Considerations

1. **Approver Deduplication**: Same address cannot approve twice
2. **Bounded Storage**: Approvers vector limited to 10 entries
3. **Timelock Enforcement**: Critical operations have mandatory delay
4. **Critical Threshold**: SetAdmin and ScheduleUpgrade require higher approval count
5. **Pause Mechanism**: Admin can pause contract in emergency
