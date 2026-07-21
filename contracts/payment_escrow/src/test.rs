#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env,
};

// Booking-type constants matching business domain
const HOT_DESK: u32 = 1;
const PRIVATE_OFFICE: u32 = 2;

const TWO_DAYS: u64 = 2 * 24 * 3600;   // 172_800 s
const SEVEN_DAYS: u64 = 7 * 24 * 3600; // 604_800 s

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
            &500, // default dispute_window = 500s
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

    fn zero_hash(&self) -> BytesN<32> {
        BytesN::<32>::from_array(&self.env, &[0u8; 32])
    }

    /// Create escrow with default booking type (0 → falls back to default 500s window).
    /// release_time = now(1000) + 100 = 1100. Window expires at 1100 + 500 = 1600.
    fn create_default_escrow(&self, depositor: &Address, beneficiary: &Address) -> u64 {
        self.mint(depositor, 1000);
        self.client()
            .create_escrow(depositor, beneficiary, &100, &1100, &0)
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

    let id = t.client().create_escrow(&depositor, &beneficiary, &200, &2000, &0).unwrap();

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
        .try_create_escrow(&depositor, &beneficiary, &0, &2000, &0)
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

    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Disputed);
}

#[test]
fn test_disputed_escrow_cannot_be_released() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
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

    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
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

    let err = t.client().try_dispute(&beneficiary, &id, &t.zero_hash()).unwrap_err().unwrap();
    assert_eq!(err, ContractError::Unauthorized);
}

// ── multiple escrows ──────────────────────────────────────────────────────────

#[test]
fn test_multiple_escrows_same_depositor() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 1_000);

    let id1 = t.client().create_escrow(&depositor, &beneficiary, &200, &2000, &0).unwrap();
    let id2 = t.client().create_escrow(&depositor, &beneficiary, &300, &2000, &0).unwrap();

    assert_ne!(id1, id2);
    assert_eq!(t.token().balance(&t.contract_id), 500);
}

// ── list escrows ──────────────────────────────────────────────────────────────

#[test]
fn test_list_depositor_escrows_returns_correct_ids() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 1_000);

    let id1 = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &0).unwrap();
    let id2 = t.client().create_escrow(&depositor, &beneficiary, &200, &2000, &0).unwrap();

    let escrows = t.client().list_depositor_escrows(&depositor);
    assert_eq!(escrows.len(), 2);
    assert_eq!(escrows.get(0).unwrap().id, id1);
    assert_eq!(escrows.get(1).unwrap().id, id2);
}

#[test]
fn test_list_beneficiary_escrows_returns_correct_ids() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 1_000);

    let id1 = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &0).unwrap();
    let id2 = t.client().create_escrow(&depositor, &beneficiary, &150, &2000, &0).unwrap();

    let escrows = t.client().list_beneficiary_escrows(&beneficiary);
    assert_eq!(escrows.len(), 2);
    assert_eq!(escrows.get(0).unwrap().id, id1);
    assert_eq!(escrows.get(1).unwrap().id, id2);
}

// ── token balances ────────────────────────────────────────────────────────────

#[test]
fn test_token_balances_correct_after_release() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    let id = t.client().create_escrow(&depositor, &beneficiary, &300, &1100, &0).unwrap();
    assert_eq!(t.token().balance(&depositor), 200);
    assert_eq!(t.token().balance(&t.contract_id), 300);

    t.advance_past_window();
    t.client().release(&beneficiary, &id).unwrap();

    assert_eq!(t.token().balance(&beneficiary), 300);
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_token_balances_correct_after_refund() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    let id = t.client().create_escrow(&depositor, &beneficiary, &300, &1100, &0).unwrap();
    assert_eq!(t.token().balance(&depositor), 200);

    t.client().refund(&t.admin, &id).unwrap();

    assert_eq!(t.token().balance(&depositor), 500);
    assert_eq!(t.token().balance(&t.contract_id), 0);
}

#[test]
fn test_dispute_already_released_escrow_returns_error() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.advance_past_window();
    t.client().release(&beneficiary, &id).unwrap();

    let err = t.client().try_dispute(&depositor, &id, &t.zero_hash()).unwrap_err().unwrap();
    assert_eq!(err, ContractError::EscrowAlreadyReleased);
}

#[test]
fn test_admin_refund_disputed_escrow_succeeds() {
    let t = TestEnv::new();
    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    let id = t.create_default_escrow(&depositor, &beneficiary);

    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Disputed);

    let balance_before = t.token().balance(&depositor);
    t.client().refund(&t.admin, &id).unwrap();

    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Refunded);
    assert_eq!(t.token().balance(&depositor), balance_before + 100);
}

// ── per-booking-type dispute window tests ─────────────────────────────────────

/// Hot-desk (type 1) gets a 2-day window. Dispute raised on day 1 must succeed.
#[test]
fn test_hot_desk_dispute_within_2_day_window_succeeds() {
    let t = TestEnv::new();
    // Configure 2-day window for hot-desk bookings
    t.client().set_dispute_window(&t.admin, &HOT_DESK, &TWO_DAYS).unwrap();

    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    // now=1000, release_time=2000; window ends at 2000+172800=174800
    let id = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &HOT_DESK).unwrap();

    // Verify snapshotted window
    let escrow = t.client().get_escrow(&id);
    assert_eq!(escrow.dispute_window, TWO_DAYS);

    // Advance to day 1 after release (86400 s after release_time) — still inside window
    t.env.ledger().with_mut(|li| li.timestamp = 2000 + 86_400);
    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Disputed);
}

/// Private-office (type 2) gets a 7-day window. Dispute on day 6 must succeed.
#[test]
fn test_private_office_dispute_on_day_6_within_7_day_window_succeeds() {
    let t = TestEnv::new();
    // Configure 7-day window for private-office bookings
    t.client().set_dispute_window(&t.admin, &PRIVATE_OFFICE, &SEVEN_DAYS).unwrap();

    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    // now=1000, release_time=2000; window ends at 2000+604800=606800
    let id = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &PRIVATE_OFFICE).unwrap();

    let escrow = t.client().get_escrow(&id);
    assert_eq!(escrow.dispute_window, SEVEN_DAYS);

    // Day 6 after release = 6 * 86400 = 518400 s after release_time (still inside 7-day window)
    t.env.ledger().with_mut(|li| li.timestamp = 2000 + 6 * 86_400);
    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Disputed);
}

/// Dispute raised after the hot-desk 2-day window must return DisputeWindowExpired.
#[test]
fn test_dispute_after_window_returns_dispute_window_expired() {
    let t = TestEnv::new();
    t.client().set_dispute_window(&t.admin, &HOT_DESK, &TWO_DAYS).unwrap();

    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    // release_time=2000; window ends at 2000+172800=174800
    let id = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &HOT_DESK).unwrap();

    // Advance past the 2-day window (day 3 after release)
    t.env.ledger().with_mut(|li| li.timestamp = 2000 + 3 * 86_400);
    let err = t.client().try_dispute(&depositor, &id, &t.zero_hash()).unwrap_err().unwrap();
    assert_eq!(err, ContractError::DisputeWindowExpired);
}

/// Config change after escrow creation must NOT affect the snapshotted window.
#[test]
fn test_dispute_window_config_change_does_not_affect_existing_escrow() {
    let t = TestEnv::new();
    // Initially set a 7-day window for private-office
    t.client().set_dispute_window(&t.admin, &PRIVATE_OFFICE, &SEVEN_DAYS).unwrap();

    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    // Create escrow — snapshots 7-day window
    let id = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &PRIVATE_OFFICE).unwrap();
    assert_eq!(t.client().get_escrow(&id).dispute_window, SEVEN_DAYS);

    // Admin shrinks window to 1-day AFTER creation
    t.client().set_dispute_window(&t.admin, &PRIVATE_OFFICE, &86_400).unwrap();

    // Day 2 after release — outside new 1-day window, but inside snapshotted 7-day window
    t.env.ledger().with_mut(|li| li.timestamp = 2000 + 2 * 86_400);
    // Should still succeed because the escrow uses its snapshotted 7-day window
    t.client().dispute(&depositor, &id, &t.zero_hash()).unwrap();
    assert_eq!(t.client().get_escrow(&id).status, EscrowStatus::Disputed);
}

/// Unconfigured booking type falls back to the default dispute window.
#[test]
fn test_unconfigured_booking_type_falls_back_to_default_window() {
    let t = TestEnv::new();
    // type 99 has no per-type config; default is 500s

    let depositor = Address::generate(&t.env);
    let beneficiary = Address::generate(&t.env);
    t.mint(&depositor, 500);

    let id = t.client().create_escrow(&depositor, &beneficiary, &100, &2000, &99).unwrap();
    assert_eq!(t.client().get_escrow(&id).dispute_window, 500);
}
