#![no_std]

mod errors;
mod types;
#[cfg(test)]
mod test;

pub(crate) use errors::ContractError;
pub(crate) use types::{
    Booking, BookingStatus, TierDiscounts, Workspace, WorkspaceAvailability, WorkspaceState,
    WorkspaceTypeInfo, WaitlistEntry,
};

use common_types::publish_event;
use soroban_sdk::{
    contract, contractimpl, contracttype, map, symbol_short, vec, Address, BytesN, Env, Map,
    String, Vec,
};

const LEDGER_TTL: u32 = 535_680; // ~1 year
const MAX_BATCH_SIZE: u32 = 20;

#[contracttype]
enum DataKey {
    Admin,
    PaymentToken,
    EscrowContract,
    MembershipContract,
    TierDiscounts,
    WorkspaceTypeRegistry,
    WorkspaceCount,
    Workspace(u32),
    BookingCount,
    Booking(u64),
    MemberBookings(Address),
    WorkspaceBookings(u32),
    Waitlist(u32),
    Paused,
}

#[contract]
pub struct WorkspaceBooking;

#[contractimpl]
impl WorkspaceBooking {
    /// Initialize the contract. Seeds the workspace type registry with 4 canonical types.
    /// type_id 0 is reserved; valid IDs start at 1.
    pub fn initialize(env: Env, admin: Address, payment_token: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::PaymentToken, &payment_token);

        // Seed registry with the 4 canonical workspace types
        let mut registry: Map<u32, WorkspaceTypeInfo> = map![&env];
        registry.set(
            1u32,
            WorkspaceTypeInfo {
                name: String::from_str(&env, "HotDesk"),
                description: String::from_str(&env, "Open coworking desk available on a first-come, first-served basis"),
                max_capacity_default: 1,
            },
        );
        registry.set(
            2u32,
            WorkspaceTypeInfo {
                name: String::from_str(&env, "DedicatedDesk"),
                description: String::from_str(&env, "Reserved desk assigned exclusively to a member"),
                max_capacity_default: 1,
            },
        );
        registry.set(
            3u32,
            WorkspaceTypeInfo {
                name: String::from_str(&env, "PrivateOffice"),
                description: String::from_str(&env, "Enclosed private office for teams or individuals"),
                max_capacity_default: 10,
            },
        );
        registry.set(
            4u32,
            WorkspaceTypeInfo {
                name: String::from_str(&env, "MeetingRoom"),
                description: String::from_str(&env, "Bookable conference or meeting room"),
                max_capacity_default: 20,
            },
        );
        storage.set(&DataKey::WorkspaceTypeRegistry, &registry);
        storage.extend_ttl(&DataKey::WorkspaceTypeRegistry, LEDGER_TTL, LEDGER_TTL);
    }

    /// Admin registers a new workspace type. type_id 0 is reserved.
    /// Emits ("type_registered", admin) → type_id.
    pub fn register_workspace_type(
        env: Env,
        caller: Address,
        type_id: u32,
        info: WorkspaceTypeInfo,
    ) -> Result<(), ContractError> {
        if type_id == 0 {
            return Err(ContractError::InvalidInput);
        }
        Self::require_admin(&env, &caller);
        let storage = env.storage().persistent();
        let mut registry: Map<u32, WorkspaceTypeInfo> = storage
            .get(&DataKey::WorkspaceTypeRegistry)
            .unwrap_or(map![&env]);

        if registry.contains_key(type_id) {
            return Err(ContractError::WorkspaceTypeAlreadyExists);
        }

        registry.set(type_id, info);
        storage.set(&DataKey::WorkspaceTypeRegistry, &registry);
        storage.extend_ttl(&DataKey::WorkspaceTypeRegistry, LEDGER_TTL, LEDGER_TTL);

        env.events()
            .publish((symbol_short!("type_reg"), caller), type_id);
        Ok(())
    }

    /// Returns all registered workspace types as a Map<type_id, WorkspaceTypeInfo>.
    pub fn get_workspace_types(env: Env) -> Map<u32, WorkspaceTypeInfo> {
        env.storage()
            .persistent()
            .get(&DataKey::WorkspaceTypeRegistry)
            .unwrap_or(map![&env])
    }

    pub fn register_workspace(
        env: Env,
        caller: Address,
        name: String,
        type_id: u32,
        capacity: u32,
        price_per_hour: i128,
    ) -> Result<u32, ContractError> {
        Self::require_not_paused(&env);
        Self::require_admin(&env, &caller);

        // Validate type_id exists in the registry
        let registry: Map<u32, WorkspaceTypeInfo> = env
            .storage()
            .persistent()
            .get(&DataKey::WorkspaceTypeRegistry)
            .unwrap_or(map![&env]);
        if !registry.contains_key(type_id) {
            return Err(ContractError::UnknownWorkspaceType);
        }

        let storage = env.storage().persistent();
        let id: u32 = storage.get(&DataKey::WorkspaceCount).unwrap_or(0u32) + 1;
        let workspace = Workspace {
            id,
            name,
            type_id,
            capacity,
            price_per_hour,
            availability: WorkspaceAvailability::Available,
            state: WorkspaceState::Available,
        };
        storage.set(&DataKey::Workspace(id), &workspace);
        storage.extend_ttl(&DataKey::Workspace(id), LEDGER_TTL, LEDGER_TTL);
        storage.set(&DataKey::WorkspaceCount, &id);
        Ok(id)
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

        match &workspace.state {
            WorkspaceState::Available => {}
            WorkspaceState::Unavailable(_) => return Err(ContractError::WorkspaceUnavailable),
            WorkspaceState::Maintenance(_) => return Err(ContractError::WorkspaceUnavailable),
        }

        if workspace.availability != WorkspaceAvailability::Available {
            return Err(ContractError::WorkspaceUnavailable);
        }

        let hours = (end_time - start_time + 3599) / 3600;
        if amount < workspace.price_per_hour * hours as i128 {
            return Err(ContractError::InsufficientPayment);
        }

        // Overlap check against all active bookings for this workspace
        let workspace_bookings: Vec<u64> = storage
            .get(&DataKey::WorkspaceBookings(workspace_id))
            .unwrap_or(vec![&env]);

        for booking_id in workspace_bookings.iter() {
            if let Some(b) = storage.get::<DataKey, Booking>(&DataKey::Booking(booking_id)) {
                if b.status == BookingStatus::Cancelled {
                    continue;
                }
                if !(end_time <= b.start_time || start_time >= b.end_time) {
                    return Err(ContractError::OverlappingBooking);
                }
            }
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
            escrow_id: 0,
        };

        storage.set(&DataKey::Booking(id), &booking);
        storage.extend_ttl(&DataKey::Booking(id), LEDGER_TTL, LEDGER_TTL);
        storage.set(&DataKey::BookingCount, &id);

        let mut ws_bookings: Vec<u64> = storage
            .get(&DataKey::WorkspaceBookings(workspace_id))
            .unwrap_or(vec![&env]);
        ws_bookings.push_back(id);
        storage.set(&DataKey::WorkspaceBookings(workspace_id), &ws_bookings);
        storage.extend_ttl(&DataKey::WorkspaceBookings(workspace_id), LEDGER_TTL, LEDGER_TTL);

        let mut member_bookings: Vec<u64> = storage
            .get(&DataKey::MemberBookings(member.clone()))
            .unwrap_or(vec![&env]);
        member_bookings.push_back(id);
        storage.set(&DataKey::MemberBookings(member.clone()), &member_bookings);
        storage.extend_ttl(&DataKey::MemberBookings(member), LEDGER_TTL, LEDGER_TTL);

        publish_event(&env, "workspace_booking", symbol_short!("book"), (symbol_short!("book"), workspace_id), id);
        Ok(id)
    }

    pub fn confirm_booking(env: Env, booking_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env);
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::AdminNotSet)?;
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

        publish_event(&env, "workspace_booking", symbol_short!("confirm_b"), (symbol_short!("confirm_b"),), booking_id);
        Ok(())
    }

    pub fn batch_confirm(env: Env, admin: Address, booking_ids: Vec<u64>) -> Result<(), ContractError> {
        Self::require_not_paused(&env);
        Self::require_admin(&env, &admin);

        // Validate batch size - max 20 IDs to prevent ledger timeout
        if booking_ids.len() as u32 > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        let storage = env.storage().persistent();

        // Pre-validate all bookings before making any changes (fail-fast principle)
        for booking_id in booking_ids.iter() {
            let booking: Booking = storage
                .get(&DataKey::Booking(booking_id))
                .ok_or(ContractError::BookingNotFound)?;

            if booking.status == BookingStatus::Confirmed {
                return Err(ContractError::BookingAlreadyConfirmed);
            }

            let workspace: Workspace = storage
                .get(&DataKey::Workspace(booking.workspace_id))
                .ok_or(ContractError::WorkspaceNotFound)?;

            // Verify workspace is not cancelled (Unavailable or Maintenance)
            match &workspace.availability {
                WorkspaceAvailability::Available => {},
                WorkspaceAvailability::Unavailable(_) => return Err(ContractError::WorkspaceUnavailable),
            }
        }

        // All validations passed, now confirm all bookings atomically
        for booking_id in booking_ids.iter() {
            let mut booking: Booking = storage.get(&DataKey::Booking(booking_id)).unwrap();
            booking.status = BookingStatus::Confirmed;
            storage.set(&DataKey::Booking(booking_id), &booking);
            storage.extend_ttl(&DataKey::Booking(booking_id), LEDGER_TTL, LEDGER_TTL);
        }

        // Emit batch confirmation event with admin address and count
        publish_event(&env, "workspace_booking", symbol_short!("batch_ok"), (symbol_short!("batch_ok"),), (admin, booking_ids.len() as u32));

        Ok(())
    }

    pub fn cancel(env: Env, caller: Address, booking_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env);
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut booking: Booking = storage
            .get(&DataKey::Booking(booking_id))
            .ok_or(ContractError::BookingNotFound)?;

        if booking.status == BookingStatus::Cancelled {
            return Err(ContractError::AlreadyCancelled);
        }

        let admin: Address = storage
            .get(&DataKey::Admin)
            .ok_or(ContractError::AdminNotSet)?;
        if caller != booking.member && caller != admin {
            return Err(ContractError::Unauthorized);
        }

        booking.status = BookingStatus::Cancelled;
        storage.set(&DataKey::Booking(booking_id), &booking);
        storage.extend_ttl(&DataKey::Booking(booking_id), LEDGER_TTL, LEDGER_TTL);

        publish_event(&env, "workspace_booking", symbol_short!("cancel"), (symbol_short!("cancel"),), booking_id);
        Ok(())
    }

    pub fn set_booking_escrow(
        env: Env,
        caller: Address,
        booking_id: u64,
        escrow_id: u64,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut booking: Booking = storage
            .get(&DataKey::Booking(booking_id))
            .ok_or(ContractError::BookingNotFound)?;

        let admin: Address = storage
            .get(&DataKey::Admin)
            .ok_or(ContractError::AdminNotSet)?;
        if caller != admin {
            return Err(ContractError::Unauthorized);
        }

        booking.escrow_id = escrow_id;
        storage.set(&DataKey::Booking(booking_id), &booking);
        storage.extend_ttl(&DataKey::Booking(booking_id), LEDGER_TTL, LEDGER_TTL);
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

        match (&old_state, &new_state) {
            (WorkspaceState::Available, WorkspaceState::Unavailable(_)) => {}
            (WorkspaceState::Available, WorkspaceState::Maintenance(_)) => {}
            (WorkspaceState::Unavailable(_), WorkspaceState::Available) => {}
            (WorkspaceState::Maintenance(scheduled_return), WorkspaceState::Available) => {
                if env.ledger().timestamp() < *scheduled_return {
                    panic!("MaintenanceNotComplete");
                }
            }
            (WorkspaceState::Maintenance(_), WorkspaceState::Unavailable(_)) => {}
            _ if old_state == new_state => return Ok(()),
            _ => panic!("InvalidStateTransition"),
        }

        workspace.state = new_state.clone();
        storage.set(&DataKey::Workspace(workspace_id), &workspace);
        storage.extend_ttl(&DataKey::Workspace(workspace_id), LEDGER_TTL, LEDGER_TTL);

        publish_event(&env, "workspace_booking", symbol_short!("state_chg"), (symbol_short!("state_chg"), workspace_id), (old_state, new_state));
        Ok(())
    }

    pub fn get_waitlist(env: Env, workspace_id: u32) -> Vec<WaitlistEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::Waitlist(workspace_id))
            .unwrap_or(vec![&env])
    }

    pub fn leave_waitlist(
        env: Env,
        member: Address,
        workspace_id: u32,
    ) -> Result<(), ContractError> {
        member.require_auth();
        let storage = env.storage().persistent();
        let waitlist: Vec<WaitlistEntry> = storage
            .get(&DataKey::Waitlist(workspace_id))
            .unwrap_or(vec![&env]);

        let mut found = false;
        let mut new_waitlist: Vec<WaitlistEntry> = vec![&env];
        for entry in waitlist.iter() {
            if entry.member == member && !found {
                found = true;
            } else {
                new_waitlist.push_back(entry);
            }
        }

        if !found {
            return Err(ContractError::NotInWaitlist);
        }

        storage.set(&DataKey::Waitlist(workspace_id), &new_waitlist);
        storage.extend_ttl(&DataKey::Waitlist(workspace_id), LEDGER_TTL, LEDGER_TTL);
        Ok(())
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
        env.storage().persistent().set(
            &DataKey::TierDiscounts,
            &TierDiscounts {
                guest,
                member,
                gold,
                platinum,
            },
        );
        Ok(())
    }

    /// WASM-upgrade hook.  Called by the admin immediately after deploying a
    /// new WASM binary.  Runs any pending storage schema migrations so that
    /// old on-chain data remains accessible under the new code.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) {
        Self::require_admin(&env, &admin);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        // Add MigrationStep instances here as the schema evolves.
        common_types::run_migrations(&env, &[]);
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
}
