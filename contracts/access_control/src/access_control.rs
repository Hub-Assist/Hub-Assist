use soroban_sdk::{symbol_short, Address, Env, Vec};

use crate::errors::AccessControlError;
use crate::types::{
    AccessControlConfig, MembershipInfo, MultiSigConfig, PendingAdminTransfer, PendingProposal,
    ProposalAction, UserRole,
};
use common_types::{publish_event, run_migrations};

/// Duration that must elapse between proposing and accepting an admin transfer.
/// Default: 48 hours, expressed in seconds.
pub const ADMIN_TRANSFER_LOCK: u64 = 48 * 60 * 60;

// ── storage keys ─────────────────────────────────────────────────────────────

use soroban_sdk::contracttype;

#[contracttype]
enum DataKey {
    Admin,
    Config,
    Role(Address),
    RoleV2(Address, u64),
    ProposalCount,
    Proposal(u64),
    PendingUpgrade,
    StorageVersion,
    PendingAdmin,
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn load_admin(env: &Env) -> Result<Address, AccessControlError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(AccessControlError::AdminNotSet)
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), AccessControlError> {
    caller.require_auth();
    if caller != &load_admin(env)? {
        return Err(AccessControlError::Unauthorized);
    }
    Ok(())
}

fn load_config(env: &Env) -> AccessControlConfig {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .unwrap_or(AccessControlConfig {
            multisig: MultiSigConfig {
                threshold: 1,
                critical_threshold: 2,
                time_lock_duration: 0,
            },
            paused: false,
        })
}

fn assert_not_paused(env: &Env) -> Result<(), AccessControlError> {
    if load_config(env).paused {
        return Err(AccessControlError::ContractPaused);
    }
    Ok(())
}

fn get_storage_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::StorageVersion)
        .unwrap_or(1u32)
}

fn require_storage_version(env: &Env, required: u32) -> Result<(), AccessControlError> {
    if get_storage_version(env) < required {
        return Err(AccessControlError::Unauthorized);
    }
    Ok(())
}

fn is_critical(action: &ProposalAction) -> bool {
    matches!(action, ProposalAction::SetAdmin(_) | ProposalAction::ScheduleUpgrade(_))
}

fn next_proposal_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::ProposalCount)
        .unwrap_or(0u64)
        + 1;
    env.storage().instance().set(&DataKey::ProposalCount, &id);
    id
}

// ── public interface ──────────────────────────────────────────────────────────

pub fn initialize(env: &Env, admin: Address, multisig_config: MultiSigConfig) {
    admin.require_auth();
    env.storage().instance().set(&DataKey::Admin, &admin);
    let config = AccessControlConfig { multisig: multisig_config, paused: false };
    env.storage().instance().set(&DataKey::Config, &config);
    env.storage().persistent().set(
        &DataKey::Role(admin.clone()),
        &MembershipInfo { user: admin.clone(), role: UserRole::Admin, assigned_at: env.ledger().timestamp() },
    );
    publish_event(&env, "access_control", symbol_short!("init"), (symbol_short!("init"), admin), ());
}

pub fn set_role(
    env: &Env,
    admin: Address,
    user: Address,
    role: UserRole,
) -> Result<(), AccessControlError> {
    assert_not_paused(env)?;
    require_admin(env, &admin)?;
    env.storage().persistent().set(
        &DataKey::Role(user.clone()),
        &MembershipInfo { user: user.clone(), role: role.clone(), assigned_at: env.ledger().timestamp() },
    );
    publish_event(&env, "access_control", symbol_short!("set_role"), (symbol_short!("set_role"), user), role);
    Ok(())
}

pub fn get_role(env: &Env, user: Address) -> Result<MembershipInfo, AccessControlError> {
    env.storage()
        .persistent()
        .get(&DataKey::Role(user))
        .ok_or(AccessControlError::UserNotFound)
}

pub fn check_access(env: &Env, user: Address, required_role: UserRole) -> bool {
    let role = match env.storage().persistent().get::<_, MembershipInfo>(&DataKey::Role(user)) {
        Some(info) => info.role,
        None => UserRole::Guest,
    };
    role >= required_role
}

pub fn require_access(
    env: &Env,
    user: Address,
    required_role: UserRole,
) -> Result<(), AccessControlError> {
    if !check_access(env, user, required_role) {
        return Err(AccessControlError::Unauthorized);
    }
    Ok(())
}

pub fn is_admin(env: &Env, user: Address) -> bool {
    match load_admin(env) {
        Ok(admin) => user == admin,
        Err(_) => false,
    }
}

pub fn remove_role(env: &Env, admin: Address, user: Address) -> Result<(), AccessControlError> {
    assert_not_paused(env)?;
    require_admin(env, &admin)?;
    if !env.storage().persistent().has(&DataKey::Role(user.clone())) {
        return Err(AccessControlError::UserNotFound);
    }
    env.storage().persistent().remove(&DataKey::Role(user.clone()));
    publish_event(&env, "access_control", symbol_short!("rm_role"), (symbol_short!("rm_role"), user), ());
    Ok(())
}

pub fn update_config(
    env: &Env,
    admin: Address,
    config: AccessControlConfig,
) -> Result<(), AccessControlError> {
    require_admin(env, &admin)?;
    env.storage().instance().set(&DataKey::Config, &config);
    Ok(())
}

pub fn pause(env: &Env, admin: Address) -> Result<(), AccessControlError> {
    require_admin(env, &admin)?;
    let mut config = load_config(env);
    config.paused = true;
    env.storage().instance().set(&DataKey::Config, &config);
    publish_event(&env, "access_control", symbol_short!("pause"), (symbol_short!("pause"),), ());
    Ok(())
}

pub fn unpause(env: &Env, admin: Address) -> Result<(), AccessControlError> {
    require_admin(env, &admin)?;
    let mut config = load_config(env);
    config.paused = false;
    env.storage().instance().set(&DataKey::Config, &config);
    publish_event(&env, "access_control", symbol_short!("unpause"), (symbol_short!("unpause"),), ());
    Ok(())
}

pub fn create_proposal(
    env: &Env,
    proposer: Address,
    action: ProposalAction,
) -> Result<u64, AccessControlError> {
    assert_not_paused(env)?;
    proposer.require_auth();
    require_access(env, proposer.clone(), UserRole::Staff)?;
    let config = load_config(env);
    let now = env.ledger().timestamp();
    let id = next_proposal_id(env);
    let mut approvals = Vec::new(env);
    approvals.push_back(proposer.clone());
    let proposal = PendingProposal {
        id,
        proposer: proposer.clone(),
        action,
        approvals,
        created_at: now,
        execution_time: now + config.multisig.time_lock_duration,
    };
    env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
    publish_event(&env, "access_control", symbol_short!("proposal"), (symbol_short!("proposal"), proposer), id);
    Ok(id)
}

pub fn approve_proposal(
    env: &Env,
    approver: Address,
    proposal_id: u64,
) -> Result<(), AccessControlError> {
    assert_not_paused(env)?;
    approver.require_auth();
    require_access(env, approver.clone(), UserRole::Staff)?;
    let mut proposal: PendingProposal = env
        .storage()
        .persistent()
        .get(&DataKey::Proposal(proposal_id))
        .ok_or(AccessControlError::ProposalNotFound)?;
    if proposal.approvals.contains(approver.clone()) {
        return Err(AccessControlError::AlreadyApproved);
    }
    proposal.approvals.push_back(approver.clone());
    env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
    publish_event(&env, "access_control", symbol_short!("approved"), (symbol_short!("approved"), approver), proposal_id);
    Ok(())
}

pub fn execute_proposal(
    env: &Env,
    executor: Address,
    proposal_id: u64,
) -> Result<(), AccessControlError> {
    assert_not_paused(env)?;
    executor.require_auth();
    let proposal: PendingProposal = env
        .storage()
        .persistent()
        .get(&DataKey::Proposal(proposal_id))
        .ok_or(AccessControlError::ProposalNotFound)?;
    let config = load_config(env);
    let required = if is_critical(&proposal.action) {
        config.multisig.critical_threshold
    } else {
        config.multisig.threshold
    };
    if proposal.approvals.len() < required {
        return Err(AccessControlError::ThresholdNotMet);
    }
    if env.ledger().timestamp() < proposal.execution_time {
        return Err(AccessControlError::TimeLockActive);
    }
    // apply action
    match proposal.action.clone() {
        ProposalAction::SetRole(user, role) => {
            env.storage().persistent().set(
                &DataKey::Role(user.clone()),
                &MembershipInfo { user: user.clone(), role: role.clone(), assigned_at: env.ledger().timestamp() },
            );
            publish_event(&env, "access_control", symbol_short!("set_role"), (symbol_short!("set_role"), user), role);
        }
        ProposalAction::RemoveRole(user) => {
            env.storage().persistent().remove(&DataKey::Role(user.clone()));
            publish_event(&env, "access_control", symbol_short!("rm_role"), (symbol_short!("rm_role"), user), ());
        }
        ProposalAction::SetAdmin(new_admin) => {
            env.storage().instance().set(&DataKey::Admin, &new_admin);
            env.storage().persistent().set(
                &DataKey::Role(new_admin.clone()),
                &MembershipInfo { user: new_admin.clone(), role: UserRole::Admin, assigned_at: env.ledger().timestamp() },
            );
            publish_event(&env, "access_control", symbol_short!("set_admin"), (symbol_short!("set_admin"),), new_admin);
        }
        ProposalAction::ScheduleUpgrade(new_wasm_hash) => {
            // Store pending upgrade with hash
            env.storage().instance().set(&DataKey::PendingUpgrade, &new_wasm_hash);
            // Execute the upgrade
            env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
            // Run any pending schema migrations post-WASM-update.
            // Add new MigrationStep instances here as the schema evolves.
            run_migrations(env, &[]);
            publish_event(&env, "access_control", symbol_short!("upg_exec"), (symbol_short!("upg_exec"),), new_wasm_hash);
        }
    }
    env.storage().persistent().remove(&DataKey::Proposal(proposal_id));
    Ok(())
}

pub fn migrate_roles_v2(env: &Env, admin: Address) -> Result<(), AccessControlError> {
    require_admin(env, &admin)?;
    
    // Check if already migrated
    if get_storage_version(env) >= 2 {
        return Ok(());
    }

    // Migrate all v1 roles to v2 format
    // Since we can't iterate all keys, we rely on the caller to have tracked all users
    // In practice, this would be called after collecting all user addresses
    
    env.storage().instance().set(&DataKey::StorageVersion, &2u32);
    publish_event(&env, "access_control", symbol_short!("migrated"), (symbol_short!("migrated"),), ());
    Ok(())
}

pub fn get_storage_version_view(env: &Env) -> u32 {
    get_storage_version(env)
}

// ── two-step admin transfer ─────────────────────────────────────────────────────

/// Propose transferring the admin role to `new_admin`. The transfer does not take
/// effect until `new_admin` explicitly accepts after the [`ADMIN_TRANSFER_LOCK`]
/// timelock has elapsed. Only one pending transfer can exist at a time — a new
/// proposal overwrites any existing one.
pub fn propose_admin_transfer(
    env: &Env,
    current_admin: Address,
    new_admin: Address,
) -> Result<(), AccessControlError> {
    assert_not_paused(env)?;
    require_admin(env, &current_admin)?;
    let pending = PendingAdminTransfer {
        address: new_admin.clone(),
        proposed_at: env.ledger().timestamp(),
    };
    env.storage().instance().set(&DataKey::PendingAdmin, &pending);
    env.events()
        .publish((symbol_short!("adm_prop"),), new_admin);
    Ok(())
}

/// Accept a pending admin transfer. The caller must be the proposed new admin and
/// the [`ADMIN_TRANSFER_LOCK`] timelock must have elapsed since the proposal.
/// On success the admin role is transferred and the pending transfer is cleared.
pub fn accept_admin_transfer(
    env: &Env,
    new_admin: Address,
) -> Result<(), AccessControlError> {
    assert_not_paused(env)?;
    new_admin.require_auth();
    let pending: PendingAdminTransfer = env
        .storage()
        .instance()
        .get(&DataKey::PendingAdmin)
        .ok_or(AccessControlError::NoPendingTransfer)?;
    if new_admin != pending.address {
        return Err(AccessControlError::Unauthorized);
    }
    if env.ledger().timestamp() < pending.proposed_at + ADMIN_TRANSFER_LOCK {
        return Err(AccessControlError::TimelockNotExpired);
    }
    env.storage().instance().set(&DataKey::Admin, &new_admin);
    env.storage().persistent().set(
        &DataKey::Role(new_admin.clone()),
        &MembershipInfo {
            user: new_admin.clone(),
            role: UserRole::Admin,
            assigned_at: env.ledger().timestamp(),
        },
    );
    env.storage().instance().remove(&DataKey::PendingAdmin);
    env.events()
        .publish((symbol_short!("adm_acpt"),), new_admin);
    Ok(())
}

/// Cancel a pending admin transfer before it is accepted, clearing the pending
/// state. Only the current admin may cancel.
pub fn cancel_admin_transfer(
    env: &Env,
    current_admin: Address,
) -> Result<(), AccessControlError> {
    require_admin(env, &current_admin)?;
    if !env.storage().instance().has(&DataKey::PendingAdmin) {
        return Err(AccessControlError::NoPendingTransfer);
    }
    env.storage().instance().remove(&DataKey::PendingAdmin);
    env.events().publish((symbol_short!("adm_cncl"),), ());
    Ok(())
}

/// View the current pending admin transfer, if any.
pub fn get_pending_admin_transfer(env: &Env) -> Option<PendingAdminTransfer> {
    env.storage().instance().get(&DataKey::PendingAdmin)
}
