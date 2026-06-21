use soroban_sdk::{contracttype, Address, BytesN, String};

#[contracttype]
#[derive(Clone)]
pub struct TierDiscounts {
    pub guest: u32,
    pub member: u32,
    pub gold: u32,
    pub platinum: u32,
}

/// On-chain descriptor for a workspace type stored in the type registry.
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub struct WorkspaceTypeInfo {
    pub name: String,
    pub description: String,
    pub max_capacity_default: u32,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum WorkspaceState {
    Available,
    Unavailable(String),  // reason
    Maintenance(u64),     // scheduled_return timestamp
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum UnavailabilityReason {
    UnderMaintenance,
    FullyBooked,
    Closed,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum WorkspaceAvailability {
    Available,
    Unavailable(UnavailabilityReason),
}

#[contracttype]
#[derive(Clone)]
pub struct Workspace {
    pub id: u32,
    pub name: String,
    /// References a type_id in the WorkspaceTypeRegistry. Valid IDs start at 1.
    pub type_id: u32,
    pub capacity: u32,
    pub price_per_hour: i128,
    pub availability: WorkspaceAvailability,
    pub state: WorkspaceState,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum BookingStatus {
    Pending,
    Confirmed,
    Cancelled,
    Completed,
    Waitlisted,
}

#[contracttype]
#[derive(Clone)]
pub struct Booking {
    pub id: u64,
    pub member: Address,
    pub workspace_id: u32,
    pub start_time: u64,
    pub end_time: u64,
    pub amount: i128,
    pub status: BookingStatus,
    pub stellar_tx_hash: BytesN<32>,
    pub escrow_id: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct WaitlistEntry {
    pub member: Address,
    pub workspace_id: u32,
    pub amount: i128,
    pub added_at: u64,
}
