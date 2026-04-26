#![no_std]

mod errors;
mod types;
#[cfg(test)]
mod test;

pub(crate) use errors::ContractError;
pub(crate) use types::{Escrow, EscrowStatus};

use soroban_sdk::{
    contract, contractimpl, contracttype, token, vec, Address, Env, Vec,
};

const LEDGER_TTL: u32 = 535_680; // ~1 year

#[contracttype]
enum DataKey {
    Admin,
    PaymentToken,
    DisputeWindow,
    EscrowCount,
    Escrow(u64),
    DepositorEscrows(Address),
    BeneficiaryEscrows(Address),
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
    }

    pub fn create_escrow(
        env: Env,
        depositor: Address,
        beneficiary: Address,
        amount: i128,
        release_time: u64,
    ) -> Result<u64, ContractError> {
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
    pub fn dispute(env: Env, depositor: Address, escrow_id: u64) -> Result<(), ContractError> {
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
        s.set(&DataKey::Escrow(escrow_id), &escrow);
        s.extend_ttl(&DataKey::Escrow(escrow_id), LEDGER_TTL, LEDGER_TTL);
        Ok(())
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
