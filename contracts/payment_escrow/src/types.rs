use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum EscrowStatus {
    Active,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    pub id: u64,
    pub depositor: Address,
    pub beneficiary: Address,
    pub payment_token: Address,
    pub amount: i128,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub release_time: u64,
    pub dispute_window: u64,
}
