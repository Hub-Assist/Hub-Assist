use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, String, Vec};

// ── TTL constant (~30 days at ~5s/ledger) ─────────────────────────────────
const STAKE_TTL_LEDGERS: u32 = 30 * 17_280;

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum StakeKey {
    Admin,
    Config,
    Tier(BytesN<32>),
    TierList,
    Stake(Address),
    StakingToken,
}

// ── Domain types ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct StakingConfig {
    pub min_stake_amount: i128,
    pub max_stake_amount: i128,
    pub emergency_unstake_penalty_bps: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct StakingTier {
    pub id: BytesN<32>,
    pub name: String,
    pub min_amount: i128,
    pub base_rate_bps: u32,
    pub reward_multiplier_bps: u32,
    pub lock_period_seconds: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct StakeInfo {
    pub staker: Address,
    pub amount: i128,
    pub tier_id: BytesN<32>,
    pub staked_at: u64,
    pub claimed_rewards: i128,
    pub emergency_unstaked: bool,
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct StakingModule;

#[contractimpl]
impl StakingModule {
    // ── Admin setup ────────────────────────────────────────────────────

    pub fn set_staking_config(env: Env, admin: Address, config: StakingConfig) {
        admin.require_auth();
        env.storage().instance().set(&StakeKey::Admin, &admin);
        env.storage().persistent().set(&StakeKey::Config, &config);
        env.events()
            .publish((symbol_short!("cfg_set"),), (admin,));
    }

    pub fn add_staking_tier(env: Env, admin: Address, tier: StakingTier) {
        Self::require_admin(&env, &admin);
        let tier_id = tier.id.clone();
        env.storage()
            .persistent()
            .set(&StakeKey::Tier(tier_id.clone()), &tier);

        let mut list: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&StakeKey::TierList)
            .unwrap_or(Vec::new(&env));
        list.push_back(tier_id.clone());
        env.storage().persistent().set(&StakeKey::TierList, &list);

        env.events()
            .publish((symbol_short!("tier_add"),), (tier_id,));
    }

    // ── Read ───────────────────────────────────────────────────────────

    pub fn get_staking_tier(env: Env, tier_id: BytesN<32>) -> StakingTier {
        env.storage()
            .persistent()
            .get(&StakeKey::Tier(tier_id))
            .expect("tier not found")
    }

    pub fn list_staking_tiers(env: Env) -> Vec<StakingTier> {
        let ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&StakeKey::TierList)
            .unwrap_or(Vec::new(&env));
        let mut tiers: Vec<StakingTier> = Vec::new(&env);
        for id in ids.iter() {
            if let Some(t) = env.storage().persistent().get(&StakeKey::Tier(id)) {
                tiers.push_back(t);
            }
        }
        tiers
    }

    pub fn get_stake(env: Env, staker: Address) -> StakeInfo {
        env.storage()
            .persistent()
            .get(&StakeKey::Stake(staker))
            .expect("no active stake")
    }

    // ── Stake ──────────────────────────────────────────────────────────

    pub fn stake(env: Env, staker: Address, amount: i128, tier_id: BytesN<32>) {
        staker.require_auth();

        let config: StakingConfig = env
            .storage()
            .persistent()
            .get(&StakeKey::Config)
            .expect("staking not configured");
        assert!(amount >= config.min_stake_amount, "below min stake");
        assert!(amount <= config.max_stake_amount, "above max stake");

        let tier: StakingTier = env
            .storage()
            .persistent()
            .get(&StakeKey::Tier(tier_id.clone()))
            .expect("tier not found");
        assert!(amount >= tier.min_amount, "below tier min amount");

        // Must not already have an active stake.
        assert!(
            !env.storage()
                .persistent()
                .has(&StakeKey::Stake(staker.clone())),
            "already staking"
        );

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&StakeKey::StakingToken)
            .expect("staking token not set");
        token::Client::new(&env, &staking_token).transfer(
            &staker,
            &env.current_contract_address(),
            &amount,
        );

        let info = StakeInfo {
            staker: staker.clone(),
            amount,
            tier_id: tier_id.clone(),
            staked_at: env.ledger().timestamp(),
            claimed_rewards: 0,
            emergency_unstaked: false,
        };
        env.storage()
            .persistent()
            .set(&StakeKey::Stake(staker.clone()), &info);
        env.storage()
            .persistent()
            .extend_ttl(&StakeKey::Stake(staker.clone()), STAKE_TTL_LEDGERS, STAKE_TTL_LEDGERS);

        env.events()
            .publish((symbol_short!("staked"),), (staker, amount, tier_id));
    }

    // ── Unstake ────────────────────────────────────────────────────────

    pub fn unstake(env: Env, staker: Address) {
        staker.require_auth();
        let info: StakeInfo = env
            .storage()
            .persistent()
            .get(&StakeKey::Stake(staker.clone()))
            .expect("no active stake");

        let tier: StakingTier = env
            .storage()
            .persistent()
            .get(&StakeKey::Tier(info.tier_id.clone()))
            .expect("tier not found");

        let now = env.ledger().timestamp();
        assert!(
            now >= info.staked_at + tier.lock_period_seconds,
            "lock period not elapsed"
        );

        let rewards = Self::calc_rewards(&info, &tier, now);
        let payout = info.amount + rewards;

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&StakeKey::StakingToken)
            .expect("staking token not set");
        token::Client::new(&env, &staking_token).transfer(
            &env.current_contract_address(),
            &staker,
            &payout,
        );

        env.storage()
            .persistent()
            .remove(&StakeKey::Stake(staker.clone()));
        env.events()
            .publish((symbol_short!("unstaked"),), (staker, payout));
    }

    // ── Emergency unstake ──────────────────────────────────────────────

    pub fn emergency_unstake(env: Env, staker: Address) {
        staker.require_auth();
        let mut info: StakeInfo = env
            .storage()
            .persistent()
            .get(&StakeKey::Stake(staker.clone()))
            .expect("no active stake");

        let config: StakingConfig = env
            .storage()
            .persistent()
            .get(&StakeKey::Config)
            .expect("staking not configured");

        let penalty = info.amount * config.emergency_unstake_penalty_bps as i128 / 10_000;
        let payout = info.amount - penalty;

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&StakeKey::StakingToken)
            .expect("staking token not set");
        token::Client::new(&env, &staking_token).transfer(
            &env.current_contract_address(),
            &staker,
            &payout,
        );

        info.emergency_unstaked = true;
        env.storage()
            .persistent()
            .remove(&StakeKey::Stake(staker.clone()));
        env.events()
            .publish((symbol_short!("emrg_ust"),), (staker, payout, penalty));
    }

    // ── Helpers ────────────────────────────────────────────────────────

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&StakeKey::Admin)
            .expect("admin not set");
        assert!(admin == *caller, "not admin");
        caller.require_auth();
    }

    /// Simple linear reward: principal * base_rate_bps * multiplier * elapsed / year / 10_000^2
    fn calc_rewards(info: &StakeInfo, tier: &StakingTier, now: u64) -> i128 {
        let elapsed = (now - info.staked_at) as i128;
        let year_secs: i128 = 365 * 24 * 3600;
        info.amount
            * tier.base_rate_bps as i128
            * tier.reward_multiplier_bps as i128
            * elapsed
            / year_secs
            / 100_000_000 // 10_000 * 10_000
    }
}
