#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

// ── helpers ───────────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    admin: Address,
    contract_id: Address,
    token_id: Address,
}

impl TestEnv {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        // start at t=1000 so release_time arithmetic is clean
        env.ledger().with_mut(|li| li.timestamp = 1000);

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = sac.address();

        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, PaymentEscrow);
        PaymentEscrowClient::new(&env, &contract_id).initialize(
            &admin,
            &token_id,
            &500, // dispute_window = 500s
        );

        TestEnv { env, admin, contract_id, token_id }
    }

    fn client(&self) -> PaymentEscrowClient {
        PaymentEscrowClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> token::Client {
        token::Client::new(&self.env, &self.token_id)
    }

    fn token_admin(&self) -> token::StellarAssetClient {
        token::StellarAssetClient::new(&self.env, &self.token_id)
    }

    fn mint(&self, to: &Address, amount: i128) {
        self.token_admin().mint(to, &amount);
    }

    /// Create a standard escrow: release_time = now + 100, dispute_window = 500
    /// So release is allowed at t >= 1600 (1000 + 100 + 500).
    fn create_default_escrow(&self, depositor: &Address, beneficiary: &Address) -> u64 {
        self.mint(depositor, 1000);
        self.client()
            .create_escrow(depositor, beneficiary, &100, &1100)
            .unwrap()
    }

    fn advance_past_window(&self) {
        self.env.ledger().with_mut(|li| li.timestamp = 2000);
    }
}

// ── create_escrow ─────────────────────────────────────────────────────────────

#[test]
fn test_create_escrow_transfers_tokens_and_creates_active_record() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    let id = t.client().create_escrow(&depositor, &beneficiary, &200, &2000).unwrap();

    // tokens moved from depositor to contract
    assert_eq!(t.token().balance(&depositor), 300);
    assert_eq!(t.token().balance(&t.contract_id), 200);

    let escrow = t.client().get_escrow(&id);
    assert_eq!(escrow.status, EscrowStatus::Active);
    assert_eq!(escrow.amount, 200);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.beneficiary, beneficiary);
}

#[test]
fn test_create_escrow_invalid_amount_returns_error() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let err = t
        .client()
        .try_create_escrow(&depositor, &beneficiary, &0, &2000)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, ContractError::InvalidAmount);
}

// ── release ───────────────────────────────────────────────────────────────────

#[test]
fn test_release_by_beneficiary_after_window() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.advance_past_window();
    t.client().release(&beneficiary, &id).unwrap();

    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Released);
    assert_eq!(t.token().balance(&beneficiary), 100);
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_release_by_admin_after_window() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.advance_past_window();
    t.client().release(&t.admin, &id).unwrap();

    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Released);
}

#[test]
fn test_release_before_window_returns_error() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    // still at t=1000, window expires at 1600
    let err = t.client().try_release(&beneficiary, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::DisputeWindowActive);
}

#[test]
fn test_release_already_released_returns_error() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.advance_past_window();
    t.client().release(&beneficiary, &id).unwrap();

    let err = t.client().try_release(&beneficiary, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::EscrowAlreadyReleased);
}

// ── refund ────────────────────────────────────────────────────────────────────

#[test]
fn test_refund_by_admin_returns_tokens_to_depositor() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    let balance_before = t.token().balance(&depositor);
    t.client().refund(&t.admin, &id).unwrap();

    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Refunded);
    assert_eq!(t.token().balance(&depositor), balance_before + 100);
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_refund_already_refunded_returns_error() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.client().refund(&t.admin, &id).unwrap();
    let err = t.client().try_refund(&t.admin, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::EscrowAlreadyReleased);
}

// ── dispute ───────────────────────────────────────────────────────────────────

#[test]
fn test_depositor_can_dispute_active_escrow() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.client().dispute(&depositor, &id).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Disputed);
}

#[test]
fn test_disputed_escrow_cannot_be_released() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.client().dispute(&depositor, &id).unwrap();
    t.advance_past_window();

    let err = t.client().try_release(&beneficiary, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::EscrowInDispute);
}

#[test]
fn test_admin_can_refund_disputed_escrow() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.client().dispute(&depositor, &id).unwrap();
    t.client().refund(&t.admin, &id).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Refunded);
}

// ── unauthorized access ───────────────────────────────────────────────────────

#[test]
fn test_release_by_stranger_returns_unauthorized() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.advance_past_window();
    let stranger = Address::generate(&t.env);
    let err = t.client().try_release(&stranger, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::Unauthorized);
}

#[test]
fn test_refund_by_non_admin_returns_unauthorized() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    let err = t.client().try_refund(&depositor, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::Unauthorized);
}

#[test]
fn test_dispute_by_non_depositor_returns_unauthorized() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    let err = t.client().try_dispute(&beneficiary, &id).unwrap_err().unwrap();
    assert_eq!(err, ContractError::Unauthorized);
}
