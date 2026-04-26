#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Vec};

const TOKEN_TTL: u32 = 17_280 * 365; // ~1 year in ledgers

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

    pub fn issue_token(env: Env, admin: Address, owner: Address, tier: u32, expiry_date: u64) -> u64 {
        Self::require_admin(&env, &admin);
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
        id
    }

    pub fn transfer_token(env: Env, id: u64, new_owner: Address) {
        let mut token = Self::load_token(&env, id);
        token.owner.require_auth();
        let status = Self::compute_status(&env, &token);
        assert!(status != MembershipStatus::GracePeriod, "transfer blocked during grace period");
        assert!(status != MembershipStatus::Revoked, "token is revoked");
        let old_owner = token.owner.clone();
        token.owner = new_owner.clone();
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("transfer"), old_owner), (id, new_owner));
    }

    pub fn renew_token(env: Env, admin: Address, id: u64, new_expiry_date: u64) {
        Self::require_admin(&env, &admin);
        let mut token = Self::load_token(&env, id);
        assert!(token.status != MembershipStatus::Revoked, "token is revoked");
        token.expiry_date = new_expiry_date;
        token.status = MembershipStatus::Active;
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("renew"), token.owner), (id, new_expiry_date));
    }

    pub fn revoke_token(env: Env, admin: Address, id: u64) {
        Self::require_admin(&env, &admin);
        let mut token = Self::load_token(&env, id);
        token.status = MembershipStatus::Revoked;
        Self::save_token(&env, &token);
        env.events().publish((symbol_short!("revoke"), token.owner), id);
    }

    pub fn get_token_status(env: Env, id: u64) -> MembershipStatus {
        let token = Self::load_token(&env, id);
        Self::compute_status(&env, &token)
    }

    pub fn get_token(env: Env, id: u64) -> MembershipToken {
        Self::load_token(&env, id)
    }

    // ── batch ops ────────────────────────────────────────────────────────────

    pub fn batch_issue_tokens(env: Env, admin: Address, params: Vec<IssueParams>) -> Vec<u64> {
        Self::require_admin(&env, &admin);
        let mut ids = Vec::new(&env);
        for p in params.iter() {
            let id = Self::next_id(&env);
            let token = MembershipToken {
                id,
                owner: p.owner.clone(),
                tier: p.tier,
                issued_at: env.ledger().timestamp(),
                expiry_date: p.expiry_date,
                status: MembershipStatus::Active,
            };
            Self::save_token(&env, &token);
            env.events().publish((symbol_short!("issue"), p.owner), id);
            ids.push_back(id);
        }
        ids
    }

    pub fn batch_transfer_tokens(env: Env, params: Vec<TransferParams>) {
        for p in params.iter() {
            let mut token = Self::load_token(&env, p.id);
            token.owner.require_auth();
            let status = Self::compute_status(&env, &token);
            assert!(status != MembershipStatus::GracePeriod, "transfer blocked during grace period");
            assert!(status != MembershipStatus::Revoked, "token is revoked");
            let old_owner = token.owner.clone();
            token.owner = p.new_owner.clone();
            Self::save_token(&env, &token);
            env.events().publish((symbol_short!("transfer"), old_owner), (p.id, p.new_owner));
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        assert!(caller == &admin, "not admin");
    }

    fn next_id(env: &Env) -> u64 {
        let id: u64 = env.storage().instance().get(&DataKey::TokenCount).unwrap_or(0u64) + 1;
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

    fn load_token(env: &Env, id: u64) -> MembershipToken {
        env.storage()
            .persistent()
            .get(&DataKey::Token(id))
            .expect("token not found")
    }

    fn compute_status(env: &Env, token: &MembershipToken) -> MembershipStatus {
        if token.status == MembershipStatus::Revoked {
            return MembershipStatus::Revoked;
        }
        let now = env.ledger().timestamp();
        if now > token.expiry_date {
            MembershipStatus::Expired
        } else {
            token.status.clone()
        }
    }
}
