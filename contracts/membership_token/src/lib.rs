#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, symbol_short, Address, Env, Vec};

const TOKEN_TTL: u32 = 17_280 * 365; // ~1 year in ledgers

#[contracterror]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u32)]
pub enum ContractError {
    AdminNotSet        = 1,
    NotAdmin           = 2,
    TokenNotFound      = 3,
    TokenAlreadyIssued = 4,
    InvalidExpiryDate  = 5,
    TokenRevoked       = 6,
    GracePeriodBlock   = 7,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum MembershipStatus {
    Active,
    Expired,
    Revoked,
    GracePeriod,
}

#[contracttype]
#[derive(Clone)]
pub struct MembershipToken {
    pub id: u64,
    pub owner: Address,
    pub tier: u32,
    pub issued_at: u64,
    pub expiry_date: u64,
    pub status: MembershipStatus,
}

#[contracttype]
pub enum DataKey {
    TokenCount,
    Token(u64),
    Admin,
}

#[contracttype]
#[derive(Clone)]
pub struct IssueParams {
    pub owner: Address,
    pub tier: u32,
    pub expiry_date: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct TransferParams {
    pub id: u64,
    pub new_owner: Address,
}

#[contract]
pub struct MembershipTokenContract;

#[contractimpl]
impl MembershipTokenContract {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // ── single ops ──────────────────────────────────────────────────────────

    pub fn issue_token(
        env: Env,
        admin: Address,
        owner: Address,
        tier: u32,
        expiry_date: u64,
    ) -> Result<u64, ContractError> {
        Self::require_admin(&env, &admin)?;
        if expiry_date <= env.ledger().timestamp() {
            return Err(ContractError::InvalidExpiryDate);
        }
        let id = Self::next_id(&env);
        let token = MembershipToken {
            id,
            owner: owner.clone(),
            tier,
            issued_at: env.ledger().timestamp(),
            expiry_date,
            status: MembershipStatus::Active,
        };
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("issue"), owner), id);
        Ok(id)
    }

    pub fn transfer_token(env: Env, id: u64, new_owner: Address) -> Result<(), ContractError> {
        let mut token = Self::load_token(&env, id)?;
        token.owner.require_auth();
        match Self::compute_status(&env, &token) {
            MembershipStatus::GracePeriod => return Err(ContractError::GracePeriodBlock),
            MembershipStatus::Revoked     => return Err(ContractError::TokenRevoked),
            MembershipStatus::Expired     => return Err(ContractError::InvalidExpiryDate),
            MembershipStatus::Active      => {}
        }
        let old_owner = token.owner.clone();
        token.owner = new_owner.clone();
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("transfer"), old_owner), (id, new_owner));
        Ok(())
    }

    pub fn renew_token(
        env: Env,
        admin: Address,
        id: u64,
        new_expiry_date: u64,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        let mut token = Self::load_token(&env, id)?;
        if token.status == MembershipStatus::Revoked {
            return Err(ContractError::TokenRevoked);
        }
        token.expiry_date = new_expiry_date;
        token.status = MembershipStatus::Active;
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("renew"), token.owner), (id, new_expiry_date));
        Ok(())
    }

    pub fn revoke_token(env: Env, admin: Address, id: u64) -> Result<(), ContractError> {
        Self::require_admin(&env, &admin)?;
        let mut token = Self::load_token(&env, id)?;
        token.status = MembershipStatus::Revoked;
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("revoke"), token.owner), id);
        Ok(())
    }

    pub fn get_token_status(env: Env, id: u64) -> Result<MembershipStatus, ContractError> {
        let token = Self::load_token(&env, id)?;
        Ok(Self::compute_status(&env, &token))
    }

    pub fn get_token(env: Env, id: u64) -> Result<MembershipToken, ContractError> {
        Self::load_token(&env, id)
    }

    // ── batch ops ────────────────────────────────────────────────────────────

    pub fn batch_issue_tokens(
        env: Env,
        admin: Address,
        params: Vec<IssueParams>,
    ) -> Result<Vec<u64>, ContractError> {
        Self::require_admin(&env, &admin)?;
        // validate all first so a bad entry rolls back the whole tx
        let now = env.ledger().timestamp();
        for p in params.iter() {
            if p.expiry_date <= now {
                return Err(ContractError::InvalidExpiryDate);
            }
        }
        let mut ids = Vec::new(&env);
        for p in params.iter() {
            let id = Self::next_id(&env);
            let token = MembershipToken {
                id,
                owner: p.owner.clone(),
                tier: p.tier,
                issued_at: now,
                expiry_date: p.expiry_date,
                status: MembershipStatus::Active,
            };
            Self::save_token(&env, &token);
            env.events().publish((symbol_short!("issue"), p.owner), id);
            ids.push_back(id);
        }
        Ok(ids)
    }

    pub fn batch_transfer_tokens(
        env: Env,
        params: Vec<TransferParams>,
    ) -> Result<(), ContractError> {
        for p in params.iter() {
            let mut token = Self::load_token(&env, p.id)?;
            token.owner.require_auth();
            match Self::compute_status(&env, &token) {
                MembershipStatus::GracePeriod => return Err(ContractError::GracePeriodBlock),
                MembershipStatus::Revoked     => return Err(ContractError::TokenRevoked),
                MembershipStatus::Expired     => return Err(ContractError::InvalidExpiryDate),
                MembershipStatus::Active      => {}
            }
            let old_owner = token.owner.clone();
            token.owner = p.new_owner.clone();
            Self::save_token(&env, &token);
            env.events().publish((symbol_short!("transfer"), old_owner), (p.id, p.new_owner));
        }
        Ok(())
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    fn require_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::AdminNotSet)?;
        if caller != &admin {
            return Err(ContractError::NotAdmin);
        }
        Ok(())
    }

    fn next_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TokenCount)
            .unwrap_or(0u64)
            + 1;
        env.storage().instance().set(&DataKey::TokenCount, &id);
        id
    }

    fn save_token(env: &Env, token: &MembershipToken) {
        env.storage()
            .persistent()
            .set(&DataKey::Token(token.id), token);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Token(token.id), TOKEN_TTL, TOKEN_TTL);
    }

    fn load_token(env: &Env, id: u64) -> Result<MembershipToken, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Token(id))
            .ok_or(ContractError::TokenNotFound)
    }

    fn compute_status(env: &Env, token: &MembershipToken) -> MembershipStatus {
        if token.status == MembershipStatus::Revoked {
            return MembershipStatus::Revoked;
        }
        if token.status == MembershipStatus::GracePeriod {
            return MembershipStatus::GracePeriod;
        }
        let now = env.ledger().timestamp();
        if now > token.expiry_date {
            MembershipStatus::Expired
        } else {
            MembershipStatus::Active
        }
    }
}

#[cfg(test)]
mod test;
