use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, xdr::ToXdr, Address, BytesN, Env, String, Vec};

use common_types::{SubscriptionTier, TierChangeRequest, TierChangeStatus, TierChangeType, TierLevel, TierPromotion};

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum TierKey {
    Admin,
    Tier(BytesN<32>),
    TierList,
    TierChangeRequest(BytesN<32>),
    TierChangeRequestList,
    Promotion(String), // Promo code -> TierPromotion
    PromotionList,
    UserTier(Address), // User -> current tier_id
}

// ── Domain types ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct TierUpdate {
    pub name: Option<String>,
    pub price: Option<i128>,
    pub duration_days: Option<u32>,
    pub is_active: Option<bool>,
    pub max_members: Option<u32>,
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct TierManagementModule;

#[contractimpl]
impl TierManagementModule {
    // ── Admin setup ────────────────────────────────────────────────────

    pub fn set_tier_admin(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&TierKey::Admin, &admin);
    }

    // ── Tier CRUD ──────────────────────────────────────────────────────

    /// Create a new subscription tier
    pub fn create_tier(env: Env, admin: Address, tier: SubscriptionTier) {
        Self::require_admin(&env, &admin);

        let tier_id = tier.id.clone();

        // Ensure tier doesn't already exist
        assert!(
            !env.storage().persistent().has(&TierKey::Tier(tier_id.clone())),
            "tier already exists"
        );

        // Store tier
        env.storage()
            .persistent()
            .set(&TierKey::Tier(tier_id.clone()), &tier);

        // Add to tier list
        let mut list: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&TierKey::TierList)
            .unwrap_or(Vec::new(&env));
        list.push_back(tier_id.clone());
        env.storage().persistent().set(&TierKey::TierList, &list);

        env.events()
            .publish((symbol_short!("tier_crt"),), (tier_id, tier.name));
    }

    /// Update an existing tier
    pub fn update_tier(env: Env, admin: Address, tier_id: BytesN<32>, updates: TierUpdate) {
        Self::require_admin(&env, &admin);

        let mut tier: SubscriptionTier = env
            .storage()
            .persistent()
            .get(&TierKey::Tier(tier_id.clone()))
            .expect("tier not found");

        // Apply updates
        if let Some(name) = updates.name {
            tier.name = name;
        }
        if let Some(price) = updates.price {
            tier.price = price;
        }
        if let Some(duration_days) = updates.duration_days {
            tier.duration_days = duration_days;
        }
        if let Some(is_active) = updates.is_active {
            tier.is_active = is_active;
        }
        if let Some(max_members) = updates.max_members {
            tier.max_members = max_members;
        }

        env.storage()
            .persistent()
            .set(&TierKey::Tier(tier_id.clone()), &tier);

        env.events()
            .publish((symbol_short!("tier_upd"),), (tier_id,));
    }

    /// Deactivate a tier
    pub fn deactivate_tier(env: Env, admin: Address, tier_id: BytesN<32>) {
        Self::require_admin(&env, &admin);

        let mut tier: SubscriptionTier = env
            .storage()
            .persistent()
            .get(&TierKey::Tier(tier_id.clone()))
            .expect("tier not found");

        tier.is_active = false;

        env.storage()
            .persistent()
            .set(&TierKey::Tier(tier_id.clone()), &tier);

        env.events()
            .publish((symbol_short!("tier_dea"),), (tier_id,));
    }

    /// Get a tier by ID
    pub fn get_tier(env: Env, tier_id: BytesN<32>) -> SubscriptionTier {
        env.storage()
            .persistent()
            .get(&TierKey::Tier(tier_id))
            .expect("tier not found")
    }

    /// List all tiers
    pub fn list_tiers(env: Env) -> Vec<SubscriptionTier> {
        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&TierKey::TierList)
            .unwrap_or(Vec::new(&env));

        let mut tiers: Vec<SubscriptionTier> = Vec::new(&env);
        for id in ids.iter() {
            if let Some(tier) = env.storage().persistent().get(&TierKey::Tier(id)) {
                tiers.push_back(tier);
            }
        }
        tiers
    }

    // ── Tier Change Requests ───────────────────────────────────────────

    /// Request a tier change
    pub fn request_tier_change(
        env: Env,
        user: Address,
        new_tier_id: BytesN<32>,
    ) -> BytesN<32> {
        user.require_auth();

        // Get user's current tier
        let current_tier_id: BytesN<32> = env
            .storage()
            .persistent()
            .get(&TierKey::UserTier(user.clone()))
            .expect("user has no tier");

        // Validate new tier exists and is active
        let new_tier: SubscriptionTier = env
            .storage()
            .persistent()
            .get(&TierKey::Tier(new_tier_id.clone()))
            .expect("new tier not found");
        assert!(new_tier.is_active, "new tier is not active");

        let current_tier: SubscriptionTier = env
            .storage()
            .persistent()
            .get(&TierKey::Tier(current_tier_id.clone()))
            .expect("current tier not found");

        // Determine change type
        let change_type = Self::determine_change_type(&current_tier.level, &new_tier.level);

        // Create request
        let request_id: BytesN<32> = env.crypto().sha256(&env.ledger().sequence().to_xdr(&env)).into();
        let request = TierChangeRequest {
            id: request_id.clone(),
            member: user.clone(),
            from_tier_id: current_tier_id,
            to_tier_id: new_tier_id.clone(),
            change_type,
            status: TierChangeStatus::Pending,
            requested_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&TierKey::TierChangeRequest(request_id.clone()), &request);

        // Add to request list
        let mut list: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&TierKey::TierChangeRequestList)
            .unwrap_or(Vec::new(&env));
        list.push_back(request_id.clone());
        env.storage()
            .persistent()
            .set(&TierKey::TierChangeRequestList, &list);

        env.events()
            .publish((symbol_short!("tier_req"),), (user, new_tier_id));

        request_id
    }

    /// Approve a tier change request
    pub fn approve_tier_change(env: Env, admin: Address, request_id: BytesN<32>) {
        Self::require_admin(&env, &admin);

        let mut request: TierChangeRequest = env
            .storage()
            .persistent()
            .get(&TierKey::TierChangeRequest(request_id.clone()))
            .expect("request not found");

        assert!(
            request.status == TierChangeStatus::Pending,
            "request not pending"
        );

        // Update request status
        request.status = TierChangeStatus::Approved;
        env.storage()
            .persistent()
            .set(&TierKey::TierChangeRequest(request_id.clone()), &request);

        // Apply the tier change
        env.storage()
            .persistent()
            .set(&TierKey::UserTier(request.member.clone()), &request.to_tier_id);

        env.events()
            .publish((symbol_short!("tier_apr"),), (request.member, request.to_tier_id));
    }

    /// Reject a tier change request
    pub fn reject_tier_change(env: Env, admin: Address, request_id: BytesN<32>) {
        Self::require_admin(&env, &admin);

        let mut request: TierChangeRequest = env
            .storage()
            .persistent()
            .get(&TierKey::TierChangeRequest(request_id.clone()))
            .expect("request not found");

        assert!(
            request.status == TierChangeStatus::Pending,
            "request not pending"
        );

        request.status = TierChangeStatus::Rejected;
        env.storage()
            .persistent()
            .set(&TierKey::TierChangeRequest(request_id.clone()), &request);

        env.events()
            .publish((symbol_short!("tier_rej"),), (request.member,));
    }

    // ── Promotions ─────────────────────────────────────────────────────

    /// Create a promotion
    pub fn create_promotion(env: Env, admin: Address, promo: TierPromotion) {
        Self::require_admin(&env, &admin);

        // Validate date range
        let now = env.ledger().timestamp();
        assert!(promo.valid_from < promo.valid_until, "invalid date range");
        assert!(promo.valid_until > now, "promotion already expired");

        // Validate discount (max 100% = 10000 bps)
        assert!(promo.discount_bps <= 10_000, "discount exceeds 100%");

        // Validate tier exists
        assert!(
            env.storage().persistent().has(&TierKey::Tier(promo.tier_id.clone())),
            "tier not found"
        );

        let code = promo.code.clone();

        // Store promotion
        env.storage()
            .persistent()
            .set(&TierKey::Promotion(code.clone()), &promo);

        // Add to promotion list
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&TierKey::PromotionList)
            .unwrap_or(Vec::new(&env));
        list.push_back(code.clone());
        env.storage().persistent().set(&TierKey::PromotionList, &list);

        env.events()
            .publish((symbol_short!("promo_cr"),), (code, promo.discount_bps));
    }

    /// Apply a promo code
    pub fn apply_promo_code(env: Env, user: Address, code: String) -> i128 {
        user.require_auth();

        let promo: TierPromotion = env
            .storage()
            .persistent()
            .get(&TierKey::Promotion(code.clone()))
            .expect("promo code not found");

        // Validate promotion is active
        assert!(promo.is_active, "promotion is not active");

        // Validate date range
        let now = env.ledger().timestamp();
        assert!(now >= promo.valid_from, "promotion not yet valid");
        assert!(now <= promo.valid_until, "promotion expired");

        // Get tier price
        let tier: SubscriptionTier = env
            .storage()
            .persistent()
            .get(&TierKey::Tier(promo.tier_id.clone()))
            .expect("tier not found");

        // Calculate discounted price
        let discount_amount = tier.price * promo.discount_bps as i128 / 10_000;
        let discounted_price = tier.price - discount_amount;

        env.events()
            .publish((symbol_short!("promo_ap"),), (user, code, discounted_price));

        discounted_price
    }

    // ── Helpers ────────────────────────────────────────────────────────

    fn require_admin(env: &Env, admin: &Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&TierKey::Admin)
            .expect("admin not set");
        assert!(*admin == stored_admin, "not admin");
        admin.require_auth();
    }

    fn determine_change_type(from: &TierLevel, to: &TierLevel) -> TierChangeType {
        let from_rank = Self::tier_rank(from);
        let to_rank = Self::tier_rank(to);

        if to_rank > from_rank {
            TierChangeType::Upgrade
        } else if to_rank < from_rank {
            TierChangeType::Downgrade
        } else {
            TierChangeType::Renewal
        }
    }

    fn tier_rank(level: &TierLevel) -> u32 {
        match level {
            TierLevel::Basic => 1,
            TierLevel::Standard => 2,
            TierLevel::Premium => 3,
            TierLevel::Enterprise => 4,
        }
    }
}
