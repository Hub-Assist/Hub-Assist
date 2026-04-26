#![cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use crate::{
    errors::AccessControlError,
    types::{AccessControlConfig, MultiSigConfig, ProposalAction, UserRole},
    AccessControlContract, AccessControlContractClient,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn default_multisig() -> MultiSigConfig {
    MultiSigConfig { threshold: 1, critical_threshold: 2, time_lock_duration: 0 }
}

fn setup(env: &Env) -> (Address, AccessControlContractClient) {
    env.mock_all_auths();
    let id = env.register_contract(None, AccessControlContract);
    let client = AccessControlContractClient::new(env, &id);
    let admin = Address::generate(env);
    client.initialize(&admin, &default_multisig());
    (admin, client)
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_admin_role() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    assert!(client.is_admin(&admin));
    let info = client.get_role(&admin).unwrap();
    assert_eq!(info.role, UserRole::Admin);
}

#[test]
fn test_initialize_default_config_not_paused() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    // contract is not paused — set_role should succeed
    let user = Address::generate(&env);
    assert!(client.set_role(&admin, &user, &UserRole::Member).is_ok());
}

// ── set_role / get_role ───────────────────────────────────────────────────────

#[test]
fn test_set_role_success() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let user = Address::generate(&env);
    client.set_role(&admin, &user, &UserRole::Staff).unwrap();
    let info = client.get_role(&user).unwrap();
    assert_eq!(info.role, UserRole::Staff);
    assert_eq!(info.user, user);
}

#[test]
fn test_set_role_non_admin_returns_unauthorized() {
    let env = Env::default();
    let (_, client) = setup(&env);
    let not_admin = Address::generate(&env);
    let user = Address::generate(&env);
    let result = client.try_set_role(&not_admin, &user, &UserRole::Member);
    assert_eq!(result, Err(Ok(AccessControlError::Unauthorized)));
}

#[test]
fn test_get_role_not_found_returns_user_not_found() {
    let env = Env::default();
    let (_, client) = setup(&env);
    let stranger = Address::generate(&env);
    let result = client.try_get_role(&stranger);
    assert_eq!(result, Err(Ok(AccessControlError::UserNotFound)));
}

// ── check_access ──────────────────────────────────────────────────────────────

#[test]
fn test_check_access_returns_true_for_sufficient_role() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let user = Address::generate(&env);
    client.set_role(&admin, &user, &UserRole::Staff).unwrap();
    assert!(client.check_access(&user, &UserRole::Member));
    assert!(client.check_access(&user, &UserRole::Staff));
    assert!(!client.check_access(&user, &UserRole::Admin));
}

#[test]
fn test_check_access_returns_false_for_unknown_user() {
    let env = Env::default();
    let (_, client) = setup(&env);
    let stranger = Address::generate(&env);
    assert!(!client.check_access(&stranger, &UserRole::Guest));
}

// ── require_access ────────────────────────────────────────────────────────────

#[test]
fn test_require_access_ok_for_correct_role() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let user = Address::generate(&env);
    client.set_role(&admin, &user, &UserRole::Member).unwrap();
    assert!(client.require_access(&user, &UserRole::Member).is_ok());
    assert!(client.require_access(&user, &UserRole::Guest).is_ok());
}

#[test]
fn test_require_access_unauthorized_for_wrong_role() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let user = Address::generate(&env);
    client.set_role(&admin, &user, &UserRole::Member).unwrap();
    let result = client.try_require_access(&user, &UserRole::Staff);
    assert_eq!(result, Err(Ok(AccessControlError::Unauthorized)));
}

// ── pause / unpause ───────────────────────────────────────────────────────────

#[test]
fn test_paused_contract_rejects_set_role() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    client.pause(&admin).unwrap();
    let user = Address::generate(&env);
    let result = client.try_set_role(&admin, &user, &UserRole::Member);
    assert_eq!(result, Err(Ok(AccessControlError::ContractPaused)));
}

#[test]
fn test_paused_contract_rejects_create_proposal() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    client.pause(&admin).unwrap();
    let target = Address::generate(&env);
    let result = client.try_create_proposal(
        &admin,
        &ProposalAction::SetRole(target, UserRole::Member),
    );
    assert_eq!(result, Err(Ok(AccessControlError::ContractPaused)));
}

#[test]
fn test_unpause_restores_operations() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    client.pause(&admin).unwrap();
    client.unpause(&admin).unwrap();
    let user = Address::generate(&env);
    assert!(client.set_role(&admin, &user, &UserRole::Member).is_ok());
}

// ── multisig proposal flow ────────────────────────────────────────────────────

#[test]
fn test_proposal_flow_threshold_1() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let target = Address::generate(&env);
    // admin proposes (auto-approved as first approver) and executes immediately
    let pid = client
        .create_proposal(&admin, &ProposalAction::SetRole(target.clone(), UserRole::Member))
        .unwrap();
    client.execute_proposal(&admin, &pid).unwrap();
    let info = client.get_role(&target).unwrap();
    assert_eq!(info.role, UserRole::Member);
}

#[test]
fn test_proposal_threshold_not_met_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, AccessControlContract);
    let client = AccessControlContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    // threshold = 2
    client.initialize(
        &admin,
        &MultiSigConfig { threshold: 2, critical_threshold: 3, time_lock_duration: 0 },
    );
    let target = Address::generate(&env);
    let pid = client
        .create_proposal(&admin, &ProposalAction::SetRole(target, UserRole::Member))
        .unwrap();
    // only 1 approval (proposer) — threshold is 2
    let result = client.try_execute_proposal(&admin, &pid);
    assert_eq!(result, Err(Ok(AccessControlError::ThresholdNotMet)));
}

#[test]
fn test_proposal_multi_approver_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, AccessControlContract);
    let client = AccessControlContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    let signer2 = Address::generate(&env);
    client.initialize(
        &admin,
        &MultiSigConfig { threshold: 2, critical_threshold: 3, time_lock_duration: 0 },
    );
    // give signer2 Staff role so they can approve
    client.set_role(&admin, &signer2, &UserRole::Staff).unwrap();
    let target = Address::generate(&env);
    let pid = client
        .create_proposal(&admin, &ProposalAction::SetRole(target.clone(), UserRole::Member))
        .unwrap();
    client.approve_proposal(&signer2, &pid).unwrap();
    client.execute_proposal(&admin, &pid).unwrap();
    assert_eq!(client.get_role(&target).unwrap().role, UserRole::Member);
}

#[test]
fn test_approve_proposal_already_approved_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, AccessControlContract);
    let client = AccessControlContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(
        &admin,
        &MultiSigConfig { threshold: 2, critical_threshold: 3, time_lock_duration: 0 },
    );
    let target = Address::generate(&env);
    let pid = client
        .create_proposal(&admin, &ProposalAction::SetRole(target, UserRole::Member))
        .unwrap();
    // admin already approved at creation
    let result = client.try_approve_proposal(&admin, &pid);
    assert_eq!(result, Err(Ok(AccessControlError::AlreadyApproved)));
}

// ── time-lock ─────────────────────────────────────────────────────────────────

#[test]
fn test_time_lock_blocks_early_execution() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let id = env.register_contract(None, AccessControlContract);
    let client = AccessControlContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(
        &admin,
        &MultiSigConfig { threshold: 1, critical_threshold: 2, time_lock_duration: 500 },
    );
    let target = Address::generate(&env);
    let pid = client
        .create_proposal(&admin, &ProposalAction::SetRole(target, UserRole::Member))
        .unwrap();
    // still within lock window (execution_time = 1500, now = 1000)
    let result = client.try_execute_proposal(&admin, &pid);
    assert_eq!(result, Err(Ok(AccessControlError::TimeLockActive)));
}

#[test]
fn test_time_lock_allows_execution_after_delay() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let id = env.register_contract(None, AccessControlContract);
    let client = AccessControlContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(
        &admin,
        &MultiSigConfig { threshold: 1, critical_threshold: 2, time_lock_duration: 500 },
    );
    let target = Address::generate(&env);
    let pid = client
        .create_proposal(&admin, &ProposalAction::SetRole(target.clone(), UserRole::Member))
        .unwrap();
    env.ledger().set_timestamp(1_500);
    client.execute_proposal(&admin, &pid).unwrap();
    assert_eq!(client.get_role(&target).unwrap().role, UserRole::Member);
}

// ── remove_role ───────────────────────────────────────────────────────────────

#[test]
fn test_remove_role_success() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let user = Address::generate(&env);
    client.set_role(&admin, &user, &UserRole::Member).unwrap();
    client.remove_role(&admin, &user).unwrap();
    assert_eq!(
        client.try_get_role(&user),
        Err(Ok(AccessControlError::UserNotFound))
    );
    assert!(!client.check_access(&user, &UserRole::Guest));
}

#[test]
fn test_remove_role_user_not_found_returns_error() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let stranger = Address::generate(&env);
    let result = client.try_remove_role(&admin, &stranger);
    assert_eq!(result, Err(Ok(AccessControlError::UserNotFound)));
}

#[test]
fn test_remove_role_non_admin_returns_unauthorized() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let user = Address::generate(&env);
    client.set_role(&admin, &user, &UserRole::Member).unwrap();
    let not_admin = Address::generate(&env);
    let result = client.try_remove_role(&not_admin, &user);
    assert_eq!(result, Err(Ok(AccessControlError::Unauthorized)));
}
