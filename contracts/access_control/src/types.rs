use soroban_sdk::{contracttype, Address, Vec};

#[contracttype]
#[derive(Clone, Copy, PartialEq, PartialOrd)]
pub enum UserRole {
    Guest  = 0,
    Member = 1,
    Staff  = 2,
    Admin  = 3,
}

#[contracttype]
#[derive(Clone)]
pub struct MultiSigConfig {
    /// number of approvals needed for normal proposals
    pub threshold: u32,
    /// number of approvals needed for critical proposals (SetAdmin, ScheduleUpgrade)
    pub critical_threshold: u32,
    /// seconds to wait after approval before execution
    pub time_lock_duration: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum ProposalAction {
    SetRole(Address, UserRole),
    RemoveRole(Address),
    SetAdmin(Address),
    ScheduleUpgrade(Address), // new wasm hash address placeholder
}

#[contracttype]
#[derive(Clone)]
pub struct PendingProposal {
    pub id: u64,
    pub proposer: Address,
    pub action: ProposalAction,
    pub approvals: Vec<Address>,
    pub created_at: u64,
    pub execution_time: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct AccessControlConfig {
    pub multisig: MultiSigConfig,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct MembershipInfo {
    pub user: Address,
    pub role: UserRole,
    pub assigned_at: u64,
}
