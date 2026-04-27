use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env};

use common_types::MembershipStatus;

const ALLOWANCE_TTL: u32 = 365 * 17_280;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Allowance(Address, Address, BytesN<32>), // (owner, spender, token_id)
    Token(BytesN<32>),
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceInfo {
    pub approved: bool,
    pub expiry: u64,
}

// Minimal token shape — only fields needed for transfer_from.
#[contracttype]
#[derive(Clone)]
struct Token {
    pub user: Address,
    pub status: MembershipStatus,
}

#[contract]
pub struct AllowanceModule;

#[contractimpl]
impl AllowanceModule {
    /// Owner approves spender to transfer token_id until expiry (Unix timestamp).
    pub fn approve(
        env: Env,
        owner: Address,
        spender: Address,
        token_id: BytesN<32>,
        expiry: u64,
    ) {
        owner.require_auth();
        assert!(expiry > env.ledger().timestamp(), "expiry must be in the future");

        let key = DataKey::Allowance(owner.clone(), spender.clone(), token_id.clone());
        let info = AllowanceInfo { approved: true, expiry };
        env.storage().persistent().set(&key, &info);
        env.storage().persistent().extend_ttl(&key, ALLOWANCE_TTL, ALLOWANCE_TTL);

        env.events()
            .publish((symbol_short!("approve"),), (owner, spender, token_id, expiry));
    }

    /// Returns the allowance info for (owner, spender, token_id).
    pub fn get_allowance(
        env: Env,
        owner: Address,
        spender: Address,
        token_id: BytesN<32>,
    ) -> AllowanceInfo {
        let key = DataKey::Allowance(owner, spender, token_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(AllowanceInfo { approved: false, expiry: 0 })
    }

    /// Spender transfers token_id from `from` to `to` using an existing allowance.
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        token_id: BytesN<32>,
    ) {
        spender.require_auth();

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone(), token_id.clone());
        let info: AllowanceInfo = env
            .storage()
            .persistent()
            .get(&allowance_key)
            .expect("no allowance");

        assert!(info.approved, "not approved");
        assert!(
            info.expiry > env.ledger().timestamp(),
            "allowance expired"
        );

        let token_key = DataKey::Token(token_id.clone());
        let mut token: Token = env
            .storage()
            .persistent()
            .get(&token_key)
            .expect("token not found");

        assert!(token.user == from, "from mismatch");
        assert!(token.status == MembershipStatus::Active, "token not transferable");

        token.user = to.clone();
        env.storage().persistent().set(&token_key, &token);

        // Consume the allowance.
        env.storage().persistent().remove(&allowance_key);

        env.events()
            .publish((symbol_short!("xfer_from"),), (spender, from, to, token_id));
    }

    /// Owner revokes spender's approval for token_id.
    pub fn revoke_allowance(
        env: Env,
        owner: Address,
        spender: Address,
        token_id: BytesN<32>,
    ) {
        owner.require_auth();

        let key = DataKey::Allowance(owner.clone(), spender.clone(), token_id.clone());
        env.storage().persistent().remove(&key);

        env.events()
            .publish((symbol_short!("revoke_al"),), (owner, spender, token_id));
    }
}
