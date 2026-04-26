use soroban_sdk::{contracttype, Address, BytesN, String};

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
#[derive(Clone, PartialEq)]
pub enum UnavailabilityReason {
    UnderMaintenance,
    FullyBooked,
    Closed,
}

#[contracttype]
#[derive(Clone, PartialEq)]
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
}

#[contracttype]
#[derive(Clone, PartialEq)]
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
}
