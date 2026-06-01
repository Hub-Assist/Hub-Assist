use soroban_sdk::{contracttype, Address, BytesN, Vec, Env};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum EscrowStatus {
    Active,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum Resolution {
    Release,
    Refund,
}

#[contracttype]
#[derive(Clone)]
pub struct ArbitrationVote {
    pub arbitrator: Address,
    pub decision: Resolution,
    pub timestamp: u64,
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
    pub dispute_timestamp: u64,
    pub arbitration_votes: Vec<ArbitrationVote>,
    pub depositor_evidence_hash: BytesN<32>,
    pub beneficiary_evidence_hash: BytesN<32>,
}
