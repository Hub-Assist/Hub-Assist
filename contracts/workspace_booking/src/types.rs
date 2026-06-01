use soroban_sdk::{contracttype, Address, BytesN, String};

#[contracttype]
#[derive(Clone)]
pub struct TierDiscounts {
    pub guest: u32,      // 0% (0 bps)
    pub member: u32,     // 5% (500 bps)
    pub gold: u32,       // 10% (1000 bps)
    pub platinum: u32,   // 15% (1500 bps)
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum WorkspaceType {
    HotDesk,
    DedicatedDesk,
    PrivateOffice,
    MeetingRoom,
    Virtual,
    Hybrid,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum WorkspaceState {
    Available,
    Unavailable { reason: String },
    Maintenance { scheduled_return: u64 },
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
    pub workspace_type: WorkspaceType,
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
