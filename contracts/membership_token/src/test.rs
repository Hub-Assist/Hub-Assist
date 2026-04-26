#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, MembershipTokenContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, MembershipTokenContract);
    let client = MembershipTokenContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, contract_id, client, admin)
}

const FUTURE: u64 = 9_999_999_999;

// ── issue_token ───────────────────────────────────────────────────────────────

#[test]
fn test_issue_token_success() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    assert_eq!(id, 1);
    let token = client.get_token(&id);
    assert_eq!(token.owner, owner);
    assert_eq!(token.tier, 1);
    assert_eq!(token.status, MembershipStatus::Active);
}

#[test]
fn test_issue_token_past_expiry_returns_invalid_expiry_date() {
    let (env, _, client, admin) = setup();
    env.ledger().set_timestamp(1_000);
    let owner = Address::generate(&env);
    let result = client.try_issue_token(&admin, &owner, &1, &500);
    assert_eq!(result, Err(Ok(ContractError::InvalidExpiryDate)));
}

#[test]
fn test_issue_token_admin_not_set_returns_admin_not_set() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, MembershipTokenContract);
    let client = MembershipTokenContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    // initialize never called
    let result = client.try_issue_token(&admin, &owner, &1, &FUTURE);
    assert_eq!(result, Err(Ok(ContractError::AdminNotSet)));
}

#[test]
fn test_issue_token_non_admin_returns_not_admin() {
    let (env, _, client, _admin) = setup();
    let not_admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let result = client.try_issue_token(&not_admin, &owner, &1, &FUTURE);
    assert_eq!(result, Err(Ok(ContractError::NotAdmin)));
}

// ── get_token ─────────────────────────────────────────────────────────────────

#[test]
fn test_get_token_not_found_returns_token_not_found() {
    let (_, _, client, _) = setup();
    let result = client.try_get_token(&99);
    assert_eq!(result, Err(Ok(ContractError::TokenNotFound)));
}

#[test]
fn test_get_token_status_expired() {
    let (env, _, client, admin) = setup();
    env.ledger().set_timestamp(1_000);
    let owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &2_000);
    env.ledger().set_timestamp(3_000);
    let status = client.get_token_status(&id);
    assert_eq!(status, MembershipStatus::Expired);
}

// ── transfer_token ────────────────────────────────────────────────────────────

#[test]
fn test_transfer_token_success() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    client.transfer_token(&id, &new_owner);
    assert_eq!(client.get_token(&id).owner, new_owner);
}

#[test]
fn test_transfer_token_expired_returns_error() {
    let (env, _, client, admin) = setup();
    env.ledger().set_timestamp(1_000);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &2_000);
    env.ledger().set_timestamp(3_000);
    let result = client.try_transfer_token(&id, &new_owner);
    assert_eq!(result, Err(Ok(ContractError::InvalidExpiryDate)));
}

#[test]
fn test_transfer_token_revoked_blocked() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    client.revoke_token(&admin, &id);
    let result = client.try_transfer_token(&id, &new_owner);
    assert_eq!(result, Err(Ok(ContractError::TokenRevoked)));
}

#[test]
fn test_transfer_token_grace_period_blocked() {
    let (env, contract_id, client, admin) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    // Patch token status to GracePeriod directly in the contract's storage
    env.as_contract(&contract_id, || {
        let key = DataKey::Token(id);
        let mut token: MembershipToken = env.storage().persistent().get(&key).unwrap();
        token.status = MembershipStatus::GracePeriod;
        env.storage().persistent().set(&key, &token);
    });
    let result = client.try_transfer_token(&id, &new_owner);
    assert_eq!(result, Err(Ok(ContractError::GracePeriodBlock)));
}

// ── renew_token ───────────────────────────────────────────────────────────────

#[test]
fn test_renew_token_success() {
    let (env, _, client, admin) = setup();
    env.ledger().set_timestamp(1_000);
    let owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &2_000);
    env.ledger().set_timestamp(3_000);
    client.renew_token(&admin, &id, &FUTURE);
    assert_eq!(client.get_token_status(&id), MembershipStatus::Active);
}

#[test]
fn test_renew_token_non_admin_returns_not_admin() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    let not_admin = Address::generate(&env);
    let result = client.try_renew_token(&not_admin, &id, &FUTURE);
    assert_eq!(result, Err(Ok(ContractError::NotAdmin)));
}

// ── revoke_token ──────────────────────────────────────────────────────────────

#[test]
fn test_revoke_token_success() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    client.revoke_token(&admin, &id);
    assert_eq!(client.get_token_status(&id), MembershipStatus::Revoked);
}

#[test]
fn test_revoked_token_cannot_be_transferred() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &1, &FUTURE);
    client.revoke_token(&admin, &id);
    let result = client.try_transfer_token(&id, &new_owner);
    assert_eq!(result, Err(Ok(ContractError::TokenRevoked)));
}

// ── batch_issue_tokens ────────────────────────────────────────────────────────

#[test]
fn test_batch_issue_tokens_success() {
    let (env, _, client, admin) = setup();
    let o1 = Address::generate(&env);
    let o2 = Address::generate(&env);
    let params = soroban_sdk::vec![
        &env,
        IssueParams { owner: o1.clone(), tier: 1, expiry_date: FUTURE },
        IssueParams { owner: o2.clone(), tier: 2, expiry_date: FUTURE },
    ];
    let ids = client.batch_issue_tokens(&admin, &params);
    assert_eq!(ids.len(), 2);
    assert_eq!(client.get_token(&ids.get(0).unwrap()).owner, o1);
    assert_eq!(client.get_token(&ids.get(1).unwrap()).owner, o2);
}

#[test]
fn test_batch_issue_tokens_partial_failure_rolls_back() {
    let (env, _, client, admin) = setup();
    env.ledger().set_timestamp(1_000);
    let o1 = Address::generate(&env);
    let o2 = Address::generate(&env);
    // second param has past expiry — whole batch should fail
    let params = soroban_sdk::vec![
        &env,
        IssueParams { owner: o1, tier: 1, expiry_date: FUTURE },
        IssueParams { owner: o2, tier: 2, expiry_date: 500 }, // past
    ];
    let result = client.try_batch_issue_tokens(&admin, &params);
    assert_eq!(result, Err(Ok(ContractError::InvalidExpiryDate)));
    // no tokens minted — validation runs before any writes
    assert_eq!(client.try_get_token(&1), Err(Ok(ContractError::TokenNotFound)));
}

// ── batch_transfer_tokens ─────────────────────────────────────────────────────

#[test]
fn test_batch_transfer_tokens_success() {
    let (env, _, client, admin) = setup();
    let o1 = Address::generate(&env);
    let o2 = Address::generate(&env);
    let n1 = Address::generate(&env);
    let n2 = Address::generate(&env);
    let id1 = client.issue_token(&admin, &o1, &1, &FUTURE);
    let id2 = client.issue_token(&admin, &o2, &2, &FUTURE);
    let params = soroban_sdk::vec![
        &env,
        TransferParams { id: id1, new_owner: n1.clone() },
        TransferParams { id: id2, new_owner: n2.clone() },
    ];
    client.batch_transfer_tokens(&params);
    assert_eq!(client.get_token(&id1).owner, n1);
    assert_eq!(client.get_token(&id2).owner, n2);
}

// ── snapshot tests ────────────────────────────────────────────────────────────

#[test]
fn test_snapshot_issued_token_fields() {
    let (env, _, client, admin) = setup();
    env.ledger().set_timestamp(1_000);
    let owner = Address::generate(&env);
    let id = client.issue_token(&admin, &owner, &3, &FUTURE);
    let token = client.get_token(&id);
    assert_eq!(token.id, 1);
    assert_eq!(token.tier, 3);
    assert_eq!(token.issued_at, 1_000);
    assert_eq!(token.expiry_date, FUTURE);
    assert_eq!(token.status, MembershipStatus::Active);
}

#[test]
fn test_snapshot_token_count_increments() {
    let (env, _, client, admin) = setup();
    let owner = Address::generate(&env);
    let id1 = client.issue_token(&admin, &owner, &1, &FUTURE);
    let id2 = client.issue_token(&admin, &owner, &1, &FUTURE);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
}
