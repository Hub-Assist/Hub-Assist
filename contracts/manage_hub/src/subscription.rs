use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, vec, xdr::ToXdr, Address, Bytes, BytesN, Env, String, Vec};

use common_types::{EntitlementResult, FeatureFlag, Subscription, SubscriptionStatus, SubscriptionTier, TierLevel};

// ── Pause policy constants ─────────────────────────────────────────────────
const MAX_PAUSES: u32 = 3;
const MIN_PAUSE_INTERVAL: u64 = 7 * 24 * 3600; // 7 days in seconds

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum SubKey {
    Subscription(Address),
    Tier(BytesN<32>),
    TierFeatures(TierLevel),
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct SubscriptionModule;

pub struct SubscriptionFeatureService;

impl SubscriptionFeatureService {
    /// Check if subscriber has access to a feature based on their tier
    pub fn has_feature(
        env: Env,
        subscriber: Address,
        feature: FeatureFlag,
    ) -> EntitlementResult {
        let sub_result = env
            .storage()
            .persistent()
            .get::<_, Subscription>(&SubKey::Subscription(subscriber.clone()));

        if let Some(sub) = sub_result {
            if sub.status != SubscriptionStatus::Active {
                return EntitlementResult {
                    has_access: false,
                    tier: TierLevel::Basic,
                    feature: feature.clone(),
                    reason: String::from_str(&env, "subscription not active"),
                };
            }

            let tier: SubscriptionTier = env
                .storage()
                .persistent()
                .get(&SubKey::Tier(sub.tier_id.clone()))
                .expect("tier not found");

            let features: Vec<FeatureFlag> = env
                .storage()
                .persistent()
                .get(&SubKey::TierFeatures(tier.level.clone()))
                .unwrap_or(Vec::new(&env));

            let has_access = features.iter().any(|f| f == feature);
            let tier_level = tier.level;

            EntitlementResult {
                has_access,
                tier: tier_level,
                feature,
                reason: if has_access {
                    String::from_str(&env, "feature enabled for tier")
                } else {
                    String::from_str(&env, "feature not available for tier")
                },
            }
        } else {
            EntitlementResult {
                has_access: false,
                tier: TierLevel::Basic,
                feature,
                reason: String::from_str(&env, "no active subscription"),
            }
        }
    }

    /// Set feature flags for a tier (admin only)
    pub fn set_tier_features(
        env: Env,
        admin: Address,
        tier: TierLevel,
        features: Vec<FeatureFlag>,
    ) {
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&SubKey::TierFeatures(tier.clone()), &features);
        env.events()
            .publish((symbol_short!("tier_feat"),), (tier, features.len()));
    }
}

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
            id: {
                let seq = env.ledger().sequence();
                let seq_bytes = seq.to_le_bytes();
                let mut b = Bytes::new(&env);
                for byte in seq_bytes.iter() {
                    b.push_back(*byte);
                }
                env.crypto().sha256(&b).into()
            },
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
