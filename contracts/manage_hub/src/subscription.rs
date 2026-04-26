use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, xdr::ToXdr, Address, BytesN, Env, String};

use common_types::{Subscription, SubscriptionStatus, SubscriptionTier};

// ── Pause policy constants ─────────────────────────────────────────────────
const MAX_PAUSES: u32 = 3;
const MIN_PAUSE_INTERVAL: u64 = 7 * 24 * 3600; // 7 days in seconds

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum SubKey {
    Subscription(Address),
    Tier(BytesN<32>),
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct SubscriptionModule;

#[contractimpl]
impl SubscriptionModule {
    /// Register a tier so subscriptions can validate against it.
    pub fn set_tier(env: Env, tier_id: BytesN<32>, tier: SubscriptionTier) {
        env.storage().persistent().set(&SubKey::Tier(tier_id), &tier);
    }

    // ── Create ─────────────────────────────────────────────────────────

    pub fn create_subscription(
        env: Env,
        user: Address,
        payment_token: Address,
        amount: i128,
        tier_id: BytesN<32>,
        billing_cycle: u64,
    ) -> Subscription {
        user.require_auth();

        // Validate amount against tier price.
        let tier: SubscriptionTier = env
            .storage()
            .persistent()
            .get(&SubKey::Tier(tier_id.clone()))
            .expect("tier not found");
        assert!(amount >= tier.price, "payment amount below tier price");

        // Transfer USDC from user to contract.
        token::Client::new(&env, &payment_token).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );

        let now = env.ledger().timestamp();
        let sub = Subscription {
            id: env.crypto().sha256(&env.ledger().sequence().to_xdr(&env)).into(),
            user: user.clone(),
            payment_token: payment_token.clone(),
            amount,
            status: SubscriptionStatus::Active,
            created_at: now,
            expires_at: now + billing_cycle,
            tier_id: tier_id.clone(),
            billing_cycle,
            pause_count: 0,
            paused_at: 0,
            pause_reason: String::from_str(&env, ""),
        };

        env.storage()
            .persistent()
            .set(&SubKey::Subscription(user.clone()), &sub);

        env.events()
            .publish((symbol_short!("sub_new"),), (user, tier_id, amount));

        sub
    }

    // ── Read ───────────────────────────────────────────────────────────

    pub fn get_subscription(env: Env, user: Address) -> Subscription {
        env.storage()
            .persistent()
            .get(&SubKey::Subscription(user))
            .expect("subscription not found")
    }

    // ── Cancel ─────────────────────────────────────────────────────────

    pub fn cancel_subscription(env: Env, user: Address) {
        user.require_auth();
        let mut sub = Self::load(&env, &user);
        assert!(
            sub.status == SubscriptionStatus::Active
                || sub.status == SubscriptionStatus::Paused,
            "subscription not cancellable"
        );
        sub.status = SubscriptionStatus::Cancelled;
        Self::save(&env, &user, &sub);
        env.events().publish((symbol_short!("sub_cncl"),), (user,));
    }

    // ── Pause ──────────────────────────────────────────────────────────

    pub fn pause_subscription(env: Env, user: Address, reason: String) {
        user.require_auth();
        let mut sub = Self::load(&env, &user);
        assert!(
            sub.status == SubscriptionStatus::Active,
            "only active subscriptions can be paused"
        );
        assert!(sub.pause_count < MAX_PAUSES, "max pauses reached");

        let now = env.ledger().timestamp();
        if sub.paused_at > 0 {
            assert!(
                now >= sub.paused_at + MIN_PAUSE_INTERVAL,
                "min interval between pauses not met"
            );
        }

        sub.status = SubscriptionStatus::Paused;
        sub.paused_at = now;
        sub.pause_reason = reason.clone();
        sub.pause_count += 1;
        Self::save(&env, &user, &sub);
        env.events()
            .publish((symbol_short!("sub_paus"),), (user, reason));
    }

    // ── Resume ─────────────────────────────────────────────────────────

    pub fn resume_subscription(env: Env, user: Address) {
        user.require_auth();
        let mut sub = Self::load(&env, &user);
        assert!(
            sub.status == SubscriptionStatus::Paused,
            "subscription is not paused"
        );
        // Extend expiry by the time spent paused.
        let paused_duration = env.ledger().timestamp() - sub.paused_at;
        sub.expires_at += paused_duration;
        sub.status = SubscriptionStatus::Active;
        sub.paused_at = 0;
        sub.pause_reason = String::from_str(&env, "");
        Self::save(&env, &user, &sub);
        env.events().publish((symbol_short!("sub_res"),), (user,));
    }

    // ── Renew ──────────────────────────────────────────────────────────

    pub fn renew_subscription(env: Env, user: Address) {
        user.require_auth();
        let mut sub = Self::load(&env, &user);
        assert!(
            sub.status != SubscriptionStatus::Cancelled,
            "cannot renew cancelled subscription"
        );

        // Collect payment again.
        token::Client::new(&env, &sub.payment_token).transfer(
            &user,
            &env.current_contract_address(),
            &sub.amount,
        );

        sub.expires_at += sub.billing_cycle;
        sub.status = SubscriptionStatus::Active;
        Self::save(&env, &user, &sub);
        env.events()
            .publish((symbol_short!("sub_renw"),), (user, sub.expires_at));
    }

    // ── Helpers ────────────────────────────────────────────────────────

    fn load(env: &Env, user: &Address) -> Subscription {
        env.storage()
            .persistent()
            .get(&SubKey::Subscription(user.clone()))
            .expect("subscription not found")
    }

    fn save(env: &Env, user: &Address, sub: &Subscription) {
        env.storage()
            .persistent()
            .set(&SubKey::Subscription(user.clone()), sub);
    }
}
