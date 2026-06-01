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
    BatchTooLarge      = 8,
    ContractPaused     = 9,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum MembershipStatus {
    Active,
    Expired,
    Revoked,
    GracePeriod,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
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
    Paused,
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
        env.storage().instance().set(&DataKey::Paused, &false);
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

    // ── single ops ──────────────────────────────────────────────────────────

    pub fn issue_token(
        env: Env,
        admin: Address,
        owner: Address,
        tier: u32,
        expiry_date: u64,
    ) -> Result<u64, ContractError> {
        Self::require_not_paused(&env)?;
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
        
        // Add to expiry index
        let expiry_day = expiry_date / 86400; // Convert to days since epoch
        let mut tokens_on_day: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ExpiryIndex(expiry_day))
            .unwrap_or(Vec::new(&env));
        tokens_on_day.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::ExpiryIndex(expiry_day), &tokens_on_day);
        
        env.events().publish((symbol_short!("issue"), owner), id);
        Ok(id)
    }

    pub fn transfer_token(env: Env, id: u64, new_owner: Address) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
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
        Self::require_not_paused(&env)?;
        Self::require_admin(&env, &admin)?;
        let mut token = Self::load_token(&env, id)?;
        if token.status == MembershipStatus::Revoked {
            return Err(ContractError::TokenRevoked);
        }
        
        // Remove from old expiry bucket
        let old_expiry_day = token.expiry_date / 86400;
        if let Some(mut tokens_on_day) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u64>>(&DataKey::ExpiryIndex(old_expiry_day))
        {
            tokens_on_day.retain(|&token_id| token_id != id);
            if tokens_on_day.len() > 0 {
                env.storage()
                    .persistent()
                    .set(&DataKey::ExpiryIndex(old_expiry_day), &tokens_on_day);
            } else {
                env.storage()
                    .persistent()
                    .remove(&DataKey::ExpiryIndex(old_expiry_day));
            }
        }
        
        // Add to new expiry bucket
        let new_expiry_day = new_expiry_date / 86400;
        let mut tokens_on_day: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ExpiryIndex(new_expiry_day))
            .unwrap_or(Vec::new(&env));
        tokens_on_day.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::ExpiryIndex(new_expiry_day), &tokens_on_day);
        
        token.expiry_date = new_expiry_date;
        token.status = MembershipStatus::Active;
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("renew"), token.owner), (id, new_expiry_date));
        Ok(())
    }

    pub fn revoke_token(env: Env, admin: Address, id: u64) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
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

    pub fn get_expiring_tokens(env: Env, days_ahead: u64) -> Vec<u64> {
        // Cap days_ahead at 365 to prevent excessive iteration
        let days_ahead = if days_ahead > 365 { 365 } else { days_ahead };
        
        let now = env.ledger().timestamp();
        let today = now / 86400;
        let end_day = today + days_ahead;
        
        let mut expiring_ids = Vec::new(&env);
        
        // Iterate through expiry index for each day in the window
        for day in today..=end_day {
            if let Some(tokens_on_day) = env
                .storage()
                .persistent()
                .get::<DataKey, Vec<u64>>(&DataKey::ExpiryIndex(day))
            {
                for token_id in tokens_on_day.iter() {
                    expiring_ids.push_back(token_id);
                }
            }
        }
        
        expiring_ids
    }

    // ── batch ops ────────────────────────────────────────────────────────────

    pub fn batch_issue_tokens(
        env: Env,
        admin: Address,
        params: Vec<IssueParams>,
    ) -> Result<Vec<u64>, ContractError> {
        Self::require_not_paused(&env)?;
        Self::require_admin(&env, &admin)?;
        
        // Validate batch size (max 50 to prevent timeout)
        if params.len() > 50 {
            return Err(ContractError::BatchTooLarge);
        }
        
        // Validate all params first (fail fast before any tokens are issued)
        let now = env.ledger().timestamp();
        for p in params.iter() {
            if p.expiry_date <= now {
                return Err(ContractError::InvalidExpiryDate);
            }
        }
        
        // Increment counter once by batch size
        let batch_len = params.len() as u64;
        let start_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TokenCount)
            .unwrap_or(0u64);
        let next_id = start_id + batch_len;
        env.storage().instance().set(&DataKey::TokenCount, &next_id);
        
        // Issue tokens with sequential IDs
        let mut ids = Vec::new(&env);
        for (idx, p) in params.iter().enumerate() {
            let id = start_id + (idx as u64) + 1;
            let token = MembershipToken {
                id,
                owner: p.owner.clone(),
                tier: p.tier,
                issued_at: now,
                expiry_date: p.expiry_date,
                status: MembershipStatus::Active,
            };
            Self::save_token(&env, &token);
            env.events().publish((symbol_short!("issue"), p.owner.clone()), id);
            ids.push_back(id);
        }
        Ok(ids)
    }

    pub fn batch_transfer_tokens(
        env: Env,
        params: Vec<TransferParams>,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
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

    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(ContractError::ContractPaused);
        }
        Ok(())
    }

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
        
        let now = env.ledger().timestamp();
        let grace_period_days: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GracePeriodDays)
            .unwrap_or(30u64);
        let grace_period_secs = grace_period_days * 86_400;
        
        // Active if not yet expired
        if now <= token.expiry_date {
            return MembershipStatus::Active;
        }
        
        // GracePeriod if within grace window
        if now <= token.expiry_date + grace_period_secs {
            return MembershipStatus::GracePeriod;
        }
        
        // Expired if beyond grace period
        MembershipStatus::Expired
    }
}

#[cfg(test)]
mod test;
