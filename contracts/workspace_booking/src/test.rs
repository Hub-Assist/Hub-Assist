#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

struct TestEnv {
    env: Env,
    admin: Address,
    token: Address,
    contract_id: Address,
}

impl TestEnv {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WorkspaceBooking);
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        WorkspaceBookingClient::new(&env, &contract_id).initialize(&admin, &token);
        Self { env, admin, token, contract_id }
    }

    fn client(&self) -> WorkspaceBookingClient {
        WorkspaceBookingClient::new(&self.env, &self.contract_id)
    }

    fn dummy_hash(&self) -> BytesN<32> {
        BytesN::from_array(&self.env, &[0u8; 32])
    }

    fn register_hot_desk(&self) -> u32 {
        self.client().register_workspace(
            &self.admin,
            &String::from_str(&self.env, "Desk A"),
            &WorkspaceType::HotDesk,
            &1,
            &10,
        )
    }
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_admin_and_token() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, WorkspaceBooking);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    WorkspaceBookingClient::new(&env, &contract_id).initialize(&admin, &token);
    // no panic = success
}

// ── register_workspace ────────────────────────────────────────────────────────

#[test]
fn test_register_workspace_by_admin() {
    let t = TestEnv::new();
    let id = t.register_hot_desk();
    assert_eq!(id, 1);
    let ws = t.client().get_workspace(&id);
    assert_eq!(ws.capacity, 1);
    assert_eq!(ws.price_per_hour, 10);
    assert_eq!(ws.availability, WorkspaceAvailability::Available);
}

#[test]
#[should_panic]
fn test_register_workspace_non_admin_panics() {
    let t = TestEnv::new();
    let non_admin = Address::generate(&t.env);
    t.client().register_workspace(
        &non_admin,
        &String::from_str(&t.env, "Desk B"),
        &WorkspaceType::HotDesk,
        &1,
        &10,
    );
}

// ── book ──────────────────────────────────────────────────────────────────────

#[test]
fn test_book_creates_pending_booking() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    assert_eq!(booking_id, 1);
    let booking = t.client().get_booking(&booking_id);
    assert_eq!(booking.status, BookingStatus::Pending);
    assert_eq!(booking.member, member);
}

#[test]
fn test_book_invalid_time_range() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let err = t
        .client()
        .try_book(&member, &ws_id, &5000, &1000, &10, &t.dummy_hash())
        .unwrap_err()
        .unwrap();
    assert_eq!(err, ContractError::InvalidTimeRange);
}

#[test]
fn test_book_overlapping_returns_error() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    t.client().book(&member, &ws_id, &1000, &5000, &40, &t.dummy_hash());
    let err = t
        .client()
        .try_book(&member, &ws_id, &3000, &7000, &40, &t.dummy_hash())
        .unwrap_err()
        .unwrap();
    assert_eq!(err, ContractError::OverlappingBooking);
}

// ── confirm ───────────────────────────────────────────────────────────────────

#[test]
fn test_confirm_by_admin_changes_status() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    t.client().confirm(&t.admin, &booking_id);
    assert_eq!(t.client().get_booking(&booking_id).status, BookingStatus::Confirmed);
}

#[test]
#[should_panic]
fn test_confirm_non_admin_panics() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    let non_admin = Address::generate(&t.env);
    t.client().confirm(&non_admin, &booking_id);
}

#[test]
fn test_confirm_already_confirmed_returns_error() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    t.client().confirm(&t.admin, &booking_id);
    let err = t
        .client()
        .try_confirm(&t.admin, &booking_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, ContractError::BookingAlreadyConfirmed);
}

// ── cancel ────────────────────────────────────────────────────────────────────

#[test]
fn test_cancel_by_owner() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    t.client().cancel(&member, &booking_id);
    assert_eq!(t.client().get_booking(&booking_id).status, BookingStatus::Cancelled);
}

#[test]
fn test_cancel_by_admin() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    t.client().cancel(&t.admin, &booking_id);
    assert_eq!(t.client().get_booking(&booking_id).status, BookingStatus::Cancelled);
}

#[test]
fn test_cancel_unauthorized_returns_error() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member = Address::generate(&t.env);
    let booking_id = t.client().book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    let stranger = Address::generate(&t.env);
    let err = t
        .client()
        .try_cancel(&stranger, &booking_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, ContractError::Unauthorized);
}

// ── update_workspace_availability ─────────────────────────────────────────────

#[test]
fn test_update_availability_marks_unavailable() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    t.client().update_workspace_availability(
        &t.admin,
        &ws_id,
        &WorkspaceAvailability::Unavailable(UnavailabilityReason::Closed),
    );
    assert_eq!(
        t.client().get_workspace(&ws_id).availability,
        WorkspaceAvailability::Unavailable(UnavailabilityReason::Closed)
    );
}

#[test]
fn test_book_unavailable_workspace_fails() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    t.client().update_workspace_availability(
        &t.admin,
        &ws_id,
        &WorkspaceAvailability::Unavailable(UnavailabilityReason::UnderMaintenance),
    );
    let member = Address::generate(&t.env);
    let err = t
        .client()
        .try_book(&member, &ws_id, &1000, &4600, &10, &t.dummy_hash())
        .unwrap_err()
        .unwrap();
    assert_eq!(err, ContractError::WorkspaceUnavailable);
}

// ── list_member_bookings ──────────────────────────────────────────────────────

#[test]
fn test_list_member_bookings_returns_only_own() {
    let t = TestEnv::new();
    let ws_id = t.register_hot_desk();
    let member_a = Address::generate(&t.env);
    let member_b = Address::generate(&t.env);
    t.client().book(&member_a, &ws_id, &1000, &4600, &10, &t.dummy_hash());
    t.client().book(&member_b, &ws_id, &5000, &9000, &20, &t.dummy_hash());
    let a_bookings = t.client().list_member_bookings(&member_a);
    let b_bookings = t.client().list_member_bookings(&member_b);
    assert_eq!(a_bookings.len(), 1);
    assert_eq!(b_bookings.len(), 1);
    assert_eq!(a_bookings.get(0).unwrap().member, member_a);
    assert_eq!(b_bookings.get(0).unwrap().member, member_b);
}
