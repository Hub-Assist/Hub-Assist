use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};

use common_types::MembershipStatus;

// ── Storage TTL constants (in ledgers; ~5s/ledger on Stellar) ──────────────
const DAY_IN_LEDGERS: u32 = 17_280;
const TOKEN_TTL: u32 = 365 * DAY_IN_LEDGERS;

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token(BytesN<32>),
    UsdcContract,
}

// ── Domain types ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct MembershipToken {
    pub id: BytesN<32>,
    pub user: Address,
    pub expiry_date: u64,
    pub status: MembershipStatus,
}

/// Parameters for batch operations.
#[contracttype]
#[derive(Clone)]
pub struct IssueParams {
    pub id: BytesN<32>,
    pub user: Address,
    pub expiry_date: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct TransferParams {
    pub id: BytesN<32>,
    pub new_user: Address,
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct MembershipTokenContract;

#[contractimpl]
impl MembershipTokenContract {
    // ── Admin ──────────────────────────────────────────────────────────

    pub fn set_admin(env: Env, admin: Address) {
        // First call sets admin; subsequent calls require existing admin auth.
        if let Some(current) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Admin)
        {
            current.require_auth();
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.events()
            .publish((symbol_short!("set_admin"),), (admin,));
    }

    // ── Issue ──────────────────────────────────────────────────────────

    pub fn issue_token(env: Env, id: BytesN<32>, user: Address, expiry_date: u64) {
        Self::require_admin(&env);
        Self::assert_no_duplicate(&env, &id);
        Self::assert_future_expiry(&env, expiry_date);

        let token = MembershipToken {
            id: id.clone(),
            user: user.clone(),
            expiry_date,
            status: MembershipStatus::Active,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Token(id.clone()), &token);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Token(id.clone()), TOKEN_TTL, TOKEN_TTL);

        env.events()
            .publish((symbol_short!("issued"),), (id, user, expiry_date));
    }

    // ── Read ───────────────────────────────────────────────────────────

    pub fn get_token(env: Env, id: BytesN<32>) -> MembershipToken {
        env.storage()
            .persistent()
            .get(&DataKey::Token(id))
            .expect("token not found")
    }

    // ── Transfer ───────────────────────────────────────────────────────

    pub fn transfer_token(env: Env, id: BytesN<32>, new_user: Address) {
        let mut token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id.clone()))
            .expect("token not found");

        token.user.require_auth();
        assert!(
            token.status == MembershipStatus::Active,
            "token not transferable"
        );

        let old_user = token.user.clone();
        token.user = new_user.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Token(id.clone()), &token);

        env.events()
            .publish((symbol_short!("transfer"),), (id, old_user, new_user));
    }

    // ── Revoke ─────────────────────────────────────────────────────────

    pub fn revoke_token(env: Env, admin: Address, id: BytesN<32>) {
        Self::require_admin(&env);
        admin.require_auth();

        let mut token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id.clone()))
            .expect("token not found");

        token.status = MembershipStatus::Revoked;
        env.storage()
            .persistent()
            .set(&DataKey::Token(id.clone()), &token);

        env.events().publish((symbol_short!("revoked"),), (id,));
    }

    // ── Renew ──────────────────────────────────────────────────────────

    pub fn renew_token(env: Env, admin: Address, id: BytesN<32>, new_expiry: u64) {
        Self::require_admin(&env);
        admin.require_auth();
        Self::assert_future_expiry(&env, new_expiry);

        let mut token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id.clone()))
            .expect("token not found");

        assert!(
            token.status != MembershipStatus::Revoked,
            "cannot renew revoked token"
        );

        token.expiry_date = new_expiry;
        token.status = MembershipStatus::Active;
        env.storage()
            .persistent()
            .set(&DataKey::Token(id.clone()), &token);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Token(id.clone()), TOKEN_TTL, TOKEN_TTL);

        env.events()
            .publish((symbol_short!("renewed"),), (id, new_expiry));
    }

    // ── Batch ──────────────────────────────────────────────────────────

    pub fn batch_issue_tokens(env: Env, params_vec: Vec<IssueParams>) {
        Self::require_admin(&env);
        for p in params_vec.iter() {
            Self::assert_no_duplicate(&env, &p.id);
            Self::assert_future_expiry(&env, p.expiry_date);
            let token = MembershipToken {
                id: p.id.clone(),
                user: p.user.clone(),
                expiry_date: p.expiry_date,
                status: MembershipStatus::Active,
            };
            env.storage()
                .persistent()
                .set(&DataKey::Token(p.id.clone()), &token);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::Token(p.id.clone()), TOKEN_TTL, TOKEN_TTL);
            env.events()
                .publish((symbol_short!("issued"),), (p.id.clone(), p.user.clone(), p.expiry_date));
        }
    }

    pub fn batch_transfer_tokens(env: Env, params_vec: Vec<TransferParams>) {
        for p in params_vec.iter() {
            let mut token: MembershipToken = env
                .storage()
                .persistent()
                .get(&DataKey::Token(p.id.clone()))
                .expect("token not found");

            token.user.require_auth();
            assert!(
                token.status == MembershipStatus::Active,
                "token not transferable"
            );

            let old_user = token.user.clone();
            token.user = p.new_user.clone();
            env.storage()
                .persistent()
                .set(&DataKey::Token(p.id.clone()), &token);
            env.events()
                .publish((symbol_short!("transfer"),), (p.id.clone(), old_user, p.new_user.clone()));
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }

    fn assert_no_duplicate(env: &Env, id: &BytesN<32>) {
        assert!(
            !env.storage().persistent().has(&DataKey::Token(id.clone())),
            "token id already exists"
        );
    }

    fn assert_future_expiry(env: &Env, expiry_date: u64) {
        assert!(
            expiry_date > env.ledger().timestamp(),
            "expiry must be in the future"
        );
    }
}
