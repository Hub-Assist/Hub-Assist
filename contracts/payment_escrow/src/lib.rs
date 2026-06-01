#![no_std]

mod errors;
mod types;
#[cfg(test)]
mod test;

pub(crate) use errors::ContractError;
pub(crate) use types::{Escrow, EscrowStatus, Resolution, ArbitrationVote};

use soroban_sdk::{
    contract, contractimpl, contracttype, token, vec, Address, BytesN, Env, Vec, symbol_short,
};

const LEDGER_TTL: u32 = 535_680; // ~1 year
const DISPUTE_TIMEOUT_SECONDS: u64 = 30 * 24 * 3600; // 30 days

#[contracttype]
enum DataKey {
    Admin,
    PaymentToken,
    DisputeWindow,
    EscrowCount,
    Escrow(u64),
    DepositorEscrows(Address),
    BeneficiaryEscrows(Address),
    Paused,
    Arbitrators,
}

#[contract]
pub struct PaymentEscrow;

#[contractimpl]
impl PaymentEscrow {
    pub fn initialize(env: Env, admin: Address, payment_token: Address, default_dispute_window: u64) {
        admin.require_auth();
        let s = env.storage().persistent();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::PaymentToken, &payment_token);
        s.set(&DataKey::DisputeWindow, &default_dispute_window);
        env.storage().instance().set(&DataKey::Paused, &false);
        s.set(&DataKey::Arbitrators, &Vec::<Address>::new(&env));
    }

    pub fn set_arbitrators(env: Env, admin: Address, arbitrators: Vec<Address>) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        env.storage().persistent().set(&DataKey::Arbitrators, &arbitrators);
        Ok(())
    }

    pub fn get_arbitrators(env: Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Arbitrators)
            .unwrap_or(Vec::new(&env))
    }

    pub fn pause(env: Env, admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("paused"),), admin);
        Ok(())
    }

    pub fn unpause(env: Env, admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((symbol_short!("unpaused"),), admin);
        Ok(())
    }

    pub fn create_escrow(
        env: Env,
        depositor: Address,
        beneficiary: Address,
        amount: i128,
        release_time: u64,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
        depositor.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let s = env.storage().persistent();
        let payment_token: Address = s.get(&DataKey::PaymentToken).ok_or(ContractError::PaymentTokenNotSet)?;
        let dispute_window: u64 = s.get(&DataKey::DisputeWindow).unwrap_or(86_400);

        // Transfer tokens from depositor to this contract
        token::Client::new(&env, &payment_token).transfer(
            &depositor,
            &env.current_contract_address(),
            &amount,
        );

        let id: u64 = s.get(&DataKey::EscrowCount).unwrap_or(0u64) + 1;
        let zero_hash = BytesN::<32>::from_array(&env, &[0u8; 32]);
        let escrow = Escrow {
            id,
            depositor: depositor.clone(),
            beneficiary: beneficiary.clone(),
            payment_token,
            amount,
            status: EscrowStatus::Active,
            created_at: env.ledger().timestamp(),
            release_time,
            dispute_window,
            dispute_timestamp: 0,
            arbitration_votes: Vec::new(&env),
            depositor_evidence_hash: zero_hash.clone(),
            beneficiary_evidence_hash: zero_hash,
        };

        s.set(&DataKey::Escrow(id), &escrow);
        s.extend_ttl(&DataKey::Escrow(id), LEDGER_TTL, LEDGER_TTL);
        s.set(&DataKey::EscrowCount, &id);

        Self::push_to_list(&env, DataKey::DepositorEscrows(depositor), id);
        Self::push_to_list(&env, DataKey::BeneficiaryEscrows(beneficiary), id);

        Ok(id)
    }

    /// Release funds to beneficiary. Callable by admin or beneficiary after release_time + dispute_window.
    pub fn release(env: Env, caller: Address, escrow_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        let admin: Address = s.get(&DataKey::Admin).ok_or(ContractError::AdminNotSet)?;
        if caller != escrow.beneficiary && caller != admin {
            return Err(ContractError::Unauthorized);
        }
        if escrow.status == EscrowStatus::Released || escrow.status == EscrowStatus::Refunded {
            return Err(ContractError::EscrowAlreadyReleased);
        }
        if escrow.status == EscrowStatus::Disputed {
            return Err(ContractError::EscrowInDispute);
        }

        let now = env.ledger().timestamp();
        if now < escrow.release_time + escrow.dispute_window {
            return Err(ContractError::DisputeWindowActive);
        }

        token::Client::new(&env, &escrow.payment_token).transfer(
            &env.current_contract_address(),
            &escrow.beneficiary,
            &escrow.amount,
        );

        escrow.status = EscrowStatus::Released;
        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        Ok(())
    }

    /// Refund depositor. Admin only.
    pub fn refund(env: Env, admin: Address, escrow_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        Self::require_admin(&env, &admin)?;
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        if escrow.status == EscrowStatus::Released || escrow.status == EscrowStatus::Refunded {
            return Err(ContractError::EscrowAlreadyReleased);
        }

        token::Client::new(&env, &escrow.payment_token).transfer(
            &env.current_contract_address(),
            &escrow.depositor,
            &escrow.amount,
        );

        escrow.status = EscrowStatus::Refunded;
        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        Ok(())
    }

    /// Mark escrow as disputed. Depositor only, while still Active.
    pub fn dispute(env: Env, depositor: Address, escrow_id: u64, evidence_hash: BytesN<32>) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        depositor.require_auth();
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        if escrow.depositor != depositor {
            return Err(ContractError::Unauthorized);
        }
        if escrow.status != EscrowStatus::Active {
            return Err(ContractError::EscrowAlreadyReleased);
        }

        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_timestamp = env.ledger().timestamp();
        escrow.depositor_evidence_hash = evidence_hash;
        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        env.events().publish((symbol_short!("dispute"),), (escrow_id, evidence_hash));
        Ok(())
    }

    pub fn submit_evidence(
        env: Env,
        caller: Address,
        escrow_id: u64,
        evidence_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        caller.require_auth();
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Disputed {
            return Err(ContractError::EscrowInDispute);
        }

        if caller == escrow.depositor {
            escrow.depositor_evidence_hash = evidence_hash;
        } else if caller == escrow.beneficiary {
            escrow.beneficiary_evidence_hash = evidence_hash;
        } else {
            return Err(ContractError::Unauthorized);
        }

        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        env.events().publish((symbol_short!("evidence"),), (escrow_id, caller, evidence_hash));
        Ok(())
    }

    pub fn vote_resolution(
        env: Env,
        arbitrator: Address,
        escrow_id: u64,
        decision: Resolution,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        arbitrator.require_auth();
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Disputed {
            return Err(ContractError::EscrowInDispute);
        }

        // Verify arbitrator is registered
        let arbitrators = s.get::<DataKey, Vec<Address>>(&DataKey::Arbitrators).unwrap_or(Vec::new(&env));
        let mut is_arbitrator = false;
        for arb in arbitrators.iter() {
            if arb == arbitrator {
                is_arbitrator = true;
                break;
            }
        }
        if !is_arbitrator {
            return Err(ContractError::Unauthorized);
        }

        // Check if arbitrator already voted
        for vote in escrow.arbitration_votes.iter() {
            if vote.arbitrator == arbitrator {
                return Err(ContractError::Unauthorized); // Already voted
            }
        }

        // Add vote
        let vote = ArbitrationVote {
            arbitrator: arbitrator.clone(),
            decision: decision.clone(),
            timestamp: env.ledger().timestamp(),
        };
        escrow.arbitration_votes.push_back(vote);

        // Check if majority reached
        let total_arbitrators = arbitrators.len() as u32;
        let majority_threshold = (total_arbitrators / 2) + 1;
        let mut release_votes = 0u32;
        let mut refund_votes = 0u32;

        for vote in escrow.arbitration_votes.iter() {
            match vote.decision {
                Resolution::Release => release_votes += 1,
                Resolution::Refund => refund_votes += 1,
            }
        }

        // Auto-execute if majority reached
        if release_votes >= majority_threshold {
            token::Client::new(&env, &escrow.payment_token).transfer(
                &env.current_contract_address(),
                &escrow.beneficiary,
                &escrow.amount,
            );
            escrow.status = EscrowStatus::Released;
            env.events().publish((symbol_short!("arb_release"),), escrow_id);
        } else if refund_votes >= majority_threshold {
            token::Client::new(&env, &escrow.payment_token).transfer(
                &env.current_contract_address(),
                &escrow.depositor,
                &escrow.amount,
            );
            escrow.status = EscrowStatus::Refunded;
            env.events().publish((symbol_short!("arb_refund"),), escrow_id);
        }

        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        env.events().publish((symbol_short!("vote"),), (escrow_id, arbitrator, decision));
        Ok(())
    }

    pub fn expire_dispute(env: Env, escrow_id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Disputed {
            return Err(ContractError::EscrowInDispute);
        }

        let now = env.ledger().timestamp();
        if now < escrow.dispute_timestamp + DISPUTE_TIMEOUT_SECONDS {
            return Err(ContractError::DisputeWindowActive);
        }

        // Default to refund after 30 days
        token::Client::new(&env, &escrow.payment_token).transfer(
            &env.current_contract_address(),
            &escrow.depositor,
            &escrow.amount,
        );

        escrow.status = EscrowStatus::Refunded;
        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        env.events().publish((symbol_short!("dispute_exp"),), escrow_id);
        Ok(())
    }

    /// Auto-release funds to beneficiary after release_time. Permissionless.
    /// Caller receives no funds; only beneficiary receives the escrowed amount.
    pub fn try_auto_release(env: Env, caller: Address, escrow_id: u64) -> Result<(), ContractError> {
        caller.require_auth();
        let s = env.storage().persistent();
        let mut escrow: Escrow = s.get(&DataKey::Escrow(escrow_id)).ok_or(ContractError::EscrowNotFound)?;

        // Validate escrow is Active (not Disputed/Released/Refunded)
        if escrow.status != EscrowStatus::Active {
            return Err(ContractError::AlreadyProcessed);
        }

        // Validate release_time has passed
        let now = env.ledger().timestamp();
        if now < escrow.release_time {
            return Err(ContractError::NotYetReleasable);
        }

        // Transfer funds to beneficiary
        token::Client::new(&env, &escrow.payment_token).transfer(
            &env.current_contract_address(),
            &escrow.beneficiary,
            &escrow.amount,
        );

        escrow.status = EscrowStatus::Released;
        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);

        env.events().publish((symbol_short!("auto_rel"), caller), escrow_id);
        Ok(())
    }
    }

    pub fn get_escrow(env: Env, id: u64) -> Result<Escrow, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(ContractError::EscrowNotFound)
    }

    pub fn list_depositor_escrows(env: Env, depositor: Address) -> Vec<Escrow> {
        Self::load_escrows(&env, DataKey::DepositorEscrows(depositor))
    }

    pub fn list_beneficiary_escrows(env: Env, beneficiary: Address) -> Vec<Escrow> {
        Self::load_escrows(&env, DataKey::BeneficiaryEscrows(beneficiary))
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(ContractError::Unauthorized); // Use Unauthorized as proxy for paused
        }
        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::AdminNotSet)?;
        caller.require_auth();
        if *caller != admin {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    fn push_to_list(env: &Env, key: DataKey, id: u64) {
        let s = env.storage().persistent();
        let mut list: Vec<u64> = s.get(&key).unwrap_or(vec![env]);
        list.push_back(id);
        s.set(&key, &list);
        s.extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
    }

    fn load_escrows(env: &Env, key: DataKey) -> Vec<Escrow> {
        let s = env.storage().persistent();
        let ids: Vec<u64> = s.get(&key).unwrap_or(vec![env]);
        let mut result = vec![env];
        for id in ids.iter() {
            if let Some(e) = s.get(&DataKey::Escrow(id)) {
                result.push_back(e);
            }
        }
        result
    }
}
