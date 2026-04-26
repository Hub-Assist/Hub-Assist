#![no_std]

mod errors;
mod types;
#[cfg(test)]
mod test;

pub(crate) use errors::ContractError;
pub(crate) use types::{
    Booking, BookingStatus, UnavailabilityReason, Workspace, WorkspaceAvailability, WorkspaceType,
};

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, String, Vec};

const LEDGER_TTL: u32 = 535_680; // ~1 year

#[contracttype]
enum DataKey {
    Admin,
    PaymentToken,
    WorkspaceCount,
    Workspace(u32),
    BookingCount,
    Booking(u64),
    MemberBookings(Address),
}

#[contract]
pub struct WorkspaceBooking;

#[contractimpl]
impl WorkspaceBooking {
    pub fn initialize(env: Env, admin: Address, payment_token: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::PaymentToken, &payment_token);
    }

    pub fn register_workspace(
        env: Env,
        caller: Address,
        name: String,
        workspace_type: WorkspaceType,
        capacity: u32,
        price_per_hour: i128,
    ) -> u32 {
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
        member.require_auth();

        if start_time >= end_time {
            return Err(ContractError::InvalidTimeRange);
        }

        let storage = env.storage().persistent();

        let workspace: Workspace = storage
            .get(&DataKey::Workspace(workspace_id))
            .ok_or(ContractError::WorkspaceNotFound)?;

        if workspace.availability != WorkspaceAvailability::Available {
            return Err(ContractError::WorkspaceUnavailable);
        }

        let hours = (end_time - start_time + 3599) / 3600;
        if amount < workspace.price_per_hour * hours as i128 {
            return Err(ContractError::InsufficientPayment);
        }

        // Check overlapping bookings
        let booking_count: u64 = storage.get(&DataKey::BookingCount).unwrap_or(0);
        for i in 1..=booking_count {
            if let Some(b) = storage.get::<DataKey, Booking>(&DataKey::Booking(i)) {
                if b.workspace_id == workspace_id
                    && b.status != BookingStatus::Cancelled
                    && b.start_time < end_time
                    && start_time < b.end_time
                {
                    return Err(ContractError::OverlappingBooking);
                }
            }
        }

        let id = booking_count + 1;
        let booking = Booking {
            id,
            member: member.clone(),
            workspace_id,
            start_time,
            end_time,
            amount,
            status: BookingStatus::Pending,
            stellar_tx_hash,
        };

        storage.set(&DataKey::Booking(id), &booking);
        storage.extend_ttl(&DataKey::Booking(id), LEDGER_TTL, LEDGER_TTL);
        storage.set(&DataKey::BookingCount, &id);

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

    pub fn confirm(env: Env, admin: Address, booking_id: u64) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin);
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

        env.events().publish((symbol_short!("confirm"),), booking_id);
        Ok(())
    }

    pub fn cancel(env: Env, caller: Address, booking_id: u64) -> Result<(), ContractError> {
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
            if let Some(w) = storage.get(&DataKey::Workspace(i)) {
                result.push_back(w);
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

    // --- helpers ---

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
}
