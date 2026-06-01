#![no_std]

mod errors;
mod types;
#[cfg(test)]
mod test;

pub(crate) use errors::ContractError;
pub(crate) use types::{
    Booking, BookingStatus, UnavailabilityReason, Workspace, WorkspaceAvailability, WorkspaceType, WorkspaceState,
};

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, String, Vec};

const LEDGER_TTL: u32 = 535_680; // ~1 year

#[contracttype]
enum DataKey {
    Admin,
    PaymentToken,
    MembershipContract,
    WorkspaceCount,
    Workspace(u32),
    BookingCount,
    Booking(u64),
    MemberBookings(Address),
    Paused,
}

#[contract]
pub struct WorkspaceBooking;

#[contractimpl]
impl WorkspaceBooking {
    pub fn initialize(env: Env, admin: Address, payment_token: Address, membership_contract: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::PaymentToken, &payment_token);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn pause(env: Env, admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("paused"),), admin);
        Ok(())
    }

    pub fn unpause(env: Env, admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((symbol_short!("unpaused"),), admin);
        Ok(())
    }

    pub fn register_workspace(
        env: Env,
        caller: Address,
        name: String,
        workspace_type: WorkspaceType,
        capacity: u32,
        price_per_hour: i128,
    ) -> u32 {
        Self::require_not_paused(&env);
        Self::require_admin(&env, &caller);
        let storage = env.storage().persistent();
        let id: u32 = storage.get(&DataKey::WorkspaceCount).unwrap_or(0u32) + 1;
        let workspace = Workspace {
            id,
            name,
            workspace_type,
            capacity,
            price_per_hour,
            availability: WorkspaceAvailability::Available,
            state: WorkspaceState::Available,
        };
        storage.set(&DataKey::Workspace(id), &workspace);
        storage.extend_ttl(&DataKey::Workspace(id), LEDGER_TTL, LEDGER_TTL);
        storage.set(&DataKey::WorkspaceCount, &id);
        id
    }

    pub fn update_workspace_availability(
        env: Env,
        caller: Address,
        workspace_id: u32,
        availability: WorkspaceAvailability,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env);
        Self::require_admin(&env, &caller);
        let storage = env.storage().persistent();
        let mut workspace: Workspace = storage
            .get(&DataKey::Workspace(workspace_id))
            .ok_or(ContractError::WorkspaceNotFound)?;
        workspace.availability = availability;
        storage.set(&DataKey::Workspace(workspace_id), &workspace);
        storage.extend_ttl(&DataKey::Workspace(workspace_id), LEDGER_TTL, LEDGER_TTL);
        Ok(())
    }

    pub fn book(
        env: Env,
        member: Address,
        workspace_id: u32,
        start_time: u64,
        end_time: u64,
        amount: i128,
        stellar_tx_hash: BytesN<32>,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env);
        member.require_auth();

        if start_time >= end_time {
            return Err(ContractError::InvalidTimeRange);
        }

        let storage = env.storage().persistent();

        let workspace: Workspace = storage
            .get(&DataKey::Workspace(workspace_id))
            .ok_or(ContractError::WorkspaceNotFound)?;

        // Check state machine: block bookings for Unavailable or Maintenance states
        match &workspace.state {
            WorkspaceState::Available => {},
            WorkspaceState::Unavailable { .. } => return Err(ContractError::WorkspaceUnavailable),
            WorkspaceState::Maintenance { .. } => return Err(ContractError::WorkspaceUnavailable),
        }

        if workspace.availability != WorkspaceAvailability::Available {
            return Err(ContractError::WorkspaceUnavailable);
        }

        let hours = (end_time - start_time + 3599) / 3600;
        if amount < workspace.price_per_hour * hours as i128 {
            return Err(ContractError::InsufficientPayment);
        }

        // Atomic overlap prevention: scan all active bookings for this workspace
        // Overlap predicate: !(end_time <= existing.start_time || start_time >= existing.end_time)
        let workspace_bookings: Vec<u64> = storage
            .get(&DataKey::WorkspaceBookings(workspace_id))
            .unwrap_or(vec![&env]);
        
        for booking_id in workspace_bookings.iter() {
            if let Some(b) = storage.get::<DataKey, Booking>(&DataKey::Booking(booking_id)) {
                // Skip cancelled bookings
                if b.status == BookingStatus::Cancelled {
                    continue;
                }
                // Check for time-range overlap
                if !(end_time <= b.start_time || start_time >= b.end_time) {
                    return Err(ContractError::OverlappingBooking);
                }
            }
        }

        // Apply tier-based discount via cross-contract call
        let mut applied_discount_bps: u32 = 0;
        let membership_contract: Address = storage
            .get(&DataKey::MembershipContract)
            .ok_or(ContractError::PaymentTokenNotSet)?;
        
        // Try to get member's token status; if fails, proceed at full price
        let tier_discounts: TierDiscounts = storage
            .get(&DataKey::TierDiscounts)
            .unwrap_or(TierDiscounts {
                guest: 0,
                member: 500,
                gold: 1000,
                platinum: 1500,
            });

        // Attempt cross-contract call to get token status
        // If it fails, we proceed at full price (no panic)
        if let Ok(token_status) = Self::get_member_token_status(&env, &membership_contract, &member) {
            applied_discount_bps = match token_status {
                0 => tier_discounts.guest,      // Guest
                1 => tier_discounts.member,     // Member
                2 => tier_discounts.gold,       // Gold
                3 => tier_discounts.platinum,   // Platinum
                _ => 0,
            };
        }

        let id: u64 = storage.get(&DataKey::BookingCount).unwrap_or(0) + 1;
        let booking = Booking {
            id,
            member: member.clone(),
            workspace_id,
            start_time,
            end_time,
            amount,
            status: BookingStatus::Pending,
            stellar_tx_hash,
            applied_discount_bps,
        };

        storage.set(&DataKey::Booking(id), &booking);
        storage.extend_ttl(&DataKey::Booking(id), LEDGER_TTL, LEDGER_TTL);
        storage.set(&DataKey::BookingCount, &id);

        // Add booking to workspace bookings list
        let mut workspace_bookings: Vec<u64> = storage
            .get(&DataKey::WorkspaceBookings(workspace_id))
            .unwrap_or(vec![&env]);
        workspace_bookings.push_back(id);
        storage.set(&DataKey::WorkspaceBookings(workspace_id), &workspace_bookings);
        storage.extend_ttl(&DataKey::WorkspaceBookings(workspace_id), LEDGER_TTL, LEDGER_TTL);

        // Update member bookings list
        let mut member_bookings: Vec<u64> = storage
            .get(&DataKey::MemberBookings(member.clone()))
            .unwrap_or(vec![&env]);
        member_bookings.push_back(id);
        storage.set(&DataKey::MemberBookings(member.clone()), &member_bookings);
        storage.extend_ttl(&DataKey::MemberBookings(member), LEDGER_TTL, LEDGER_TTL);

        env.events().publish((symbol_short!("book"), workspace_id), id);
        Ok(id)
    }

    pub fn confirm_booking(env: Env, booking_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env);
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let storage = env.storage().persistent();
        let mut booking: Booking = storage
            .get(&DataKey::Booking(booking_id))
            .ok_or(ContractError::BookingNotFound)?;

        if booking.status == BookingStatus::Confirmed {
            return Err(ContractError::BookingAlreadyConfirmed);
        }

        booking.status = BookingStatus::Confirmed;
        storage.set(&DataKey::Booking(booking_id), &booking);
        storage.extend_ttl(&DataKey::Booking(booking_id), LEDGER_TTL, LEDGER_TTL);

        env.events().publish((symbol_short!("confirm_b"),), booking_id);
        Ok(())
    }

    pub fn cancel(env: Env, caller: Address, booking_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env);
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut booking: Booking = storage
            .get(&DataKey::Booking(booking_id))
            .ok_or(ContractError::BookingNotFound)?;

        let admin: Address = storage.get(&DataKey::Admin).ok_or(ContractError::AdminNotSet)?;
        if caller != booking.member && caller != admin {
            return Err(ContractError::Unauthorized);
        }

        booking.status = BookingStatus::Cancelled;
        storage.set(&DataKey::Booking(booking_id), &booking);
        storage.extend_ttl(&DataKey::Booking(booking_id), LEDGER_TTL, LEDGER_TTL);

        env.events().publish((symbol_short!("cancel"),), booking_id);
        Ok(())
    }

    pub fn get_workspace(env: Env, id: u32) -> Result<Workspace, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Workspace(id))
            .ok_or(ContractError::WorkspaceNotFound)
    }

    pub fn list_workspaces(env: Env) -> Vec<Workspace> {
        let storage = env.storage().persistent();
        let count: u32 = storage.get(&DataKey::WorkspaceCount).unwrap_or(0);
        let mut result = vec![&env];
        for i in 1..=count {
            if let Some(w) = storage.get::<DataKey, Workspace>(&DataKey::Workspace(i)) {
                if w.availability == WorkspaceAvailability::Available {
                    result.push_back(w);
                }
            }
        }
        result
    }

    pub fn get_booking(env: Env, booking_id: u64) -> Result<Booking, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Booking(booking_id))
            .ok_or(ContractError::BookingNotFound)
    }

    pub fn list_member_bookings(env: Env, member: Address) -> Vec<Booking> {
        let storage = env.storage().persistent();
        let ids: Vec<u64> = storage
            .get(&DataKey::MemberBookings(member))
            .unwrap_or(vec![&env]);
        let mut result = vec![&env];
        for id in ids.iter() {
            if let Some(b) = storage.get(&DataKey::Booking(id)) {
                result.push_back(b);
            }
        }
        result
    }

    pub fn transition_workspace_state(
        env: Env,
        admin: Address,
        workspace_id: u32,
        new_state: WorkspaceState,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin);
        let storage = env.storage().persistent();
        let mut workspace: Workspace = storage
            .get(&DataKey::Workspace(workspace_id))
            .ok_or(ContractError::WorkspaceNotFound)?;

        let old_state = workspace.state.clone();

        // Validate state transitions
        match (&old_state, &new_state) {
            // Available can transition to Unavailable or Maintenance
            (WorkspaceState::Available, WorkspaceState::Unavailable { .. }) => {},
            (WorkspaceState::Available, WorkspaceState::Maintenance { .. }) => {},
            // Unavailable can transition to Available
            (WorkspaceState::Unavailable { .. }, WorkspaceState::Available) => {},
            // Maintenance can only transition to Available if scheduled_return has passed
            (WorkspaceState::Maintenance { scheduled_return }, WorkspaceState::Available) => {
                if env.ledger().timestamp() < *scheduled_return {
                    panic!("MaintenanceNotComplete");
                }
            },
            // Maintenance can transition to Unavailable
            (WorkspaceState::Maintenance { .. }, WorkspaceState::Unavailable { .. }) => {},
            // Same state is a no-op
            _ if old_state == new_state => return Ok(()),
            // All other transitions are invalid
            _ => panic!("InvalidStateTransition"),
        }

        workspace.state = new_state.clone();
        storage.set(&DataKey::Workspace(workspace_id), &workspace);
        storage.extend_ttl(&DataKey::Workspace(workspace_id), LEDGER_TTL, LEDGER_TTL);

        // Emit state change event
        env.events().publish((symbol_short!("state_chg"), workspace_id), (old_state, new_state));
        Ok(())
    }

    // --- helpers ---

    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("contract is paused");
        }
    }

    fn require_admin(env: &Env, caller: &Address) -> Address {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("admin not set");
        caller.require_auth();
        if *caller != admin {
            panic!("unauthorized");
        }
        admin
    }

    fn get_member_token_status(env: &Env, membership_contract: &Address, member: &Address) -> Result<u32, ContractError> {
        use soroban_sdk::IntoVal;
        
        // Cross-contract call to membership_token.get_token_status(member)
        // Returns MembershipStatus enum as u32: Active=0, Expired=1, Revoked=2, GracePeriod=3
        let result: Result<u32, _> = env.invoke_contract(
            membership_contract,
            &symbol_short!("get_tier"),
            soroban_sdk::vec![env, member.clone().into_val(env)],
        );
        
        result.map_err(|_| ContractError::PaymentTokenNotSet)
    }

    pub fn get_tier_discounts(env: Env) -> TierDiscounts {
        env.storage()
            .persistent()
            .get(&DataKey::TierDiscounts)
            .unwrap_or(TierDiscounts {
                guest: 0,
                member: 500,
                gold: 1000,
                platinum: 1500,
            })
    }

    pub fn update_tier_discounts(
        env: Env,
        caller: Address,
        guest: u32,
        member: u32,
        gold: u32,
        platinum: u32,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &caller);
        let tier_discounts = TierDiscounts {
            guest,
            member,
            gold,
            platinum,
        };
        env.storage()
            .persistent()
            .set(&DataKey::TierDiscounts, &tier_discounts);
        Ok(())
    }
}
