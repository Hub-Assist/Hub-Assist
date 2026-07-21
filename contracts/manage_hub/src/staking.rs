use soroban_sdk::{contract, contractimpl, contracterror, contracttype, symbol_short, token, Address, BytesN, Env, String, Vec};

use common_types::PendingWithdrawal;

// ── TTL constant (~30 days at ~5s/ledger) ─────────────────────────────────
const STAKE_TTL_LEDGERS: u32 = 30 * 17_280;

// Precision factor to reduce reward truncation from sequential integer division
const REWARD_PRECISION: i128 = 1_000_000;

/// Default cooldown: 7 days in seconds.
const DEFAULT_COOLDOWN_SECS: u64 = 7 * 24 * 3600;

// ── Errors ─────────────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum StakingModuleError {
    NoActiveStake = 1,
    TierNotFound = 2,
    StakingTokenNotSet = 3,
    InvalidUnstakeAmount = 4,
    NoPendingWithdrawals = 5,
    CooldownNotElapsed = 6,
}

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
    /// Ordered list of pending withdrawals for a staker.
    PendingWithdrawals(Address),
    /// Admin-configurable cooldown duration in seconds.
    CooldownSecs,
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
    pub stake_timestamp: u64,
    pub accumulated_rewards: i128,
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

    /// Set the cooldown duration. Only callable by admin.
    /// `days` must be > 0.
    pub fn set_cooldown_days(env: Env, admin: Address, days: u64) {
        Self::require_admin(&env, &admin);
        assert!(days > 0, "cooldown days must be greater than zero");
        let secs = days * 24 * 3600;
        env.storage()
            .instance()
            .set(&StakeKey::CooldownSecs, &secs);
        env.events()
            .publish((symbol_short!("cd_set"),), (admin, days));
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

    /// Return all pending withdrawals for a staker.
    pub fn get_pending_withdrawals(env: Env, staker: Address) -> Vec<PendingWithdrawal> {
        env.storage()
            .persistent()
            .get(&StakeKey::PendingWithdrawals(staker))
            .unwrap_or(Vec::new(&env))
    }

    /// Return the configured cooldown in seconds (defaults to 7 days).
    pub fn get_cooldown_secs(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&StakeKey::CooldownSecs)
            .unwrap_or(DEFAULT_COOLDOWN_SECS)
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

        let now = env.ledger().timestamp();
        let info = StakeInfo {
            staker: staker.clone(),
            amount,
            tier_id: tier_id.clone(),
            staked_at: now,
            stake_timestamp: now,
            accumulated_rewards: 0,
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

    // ── Unstake (initiates cooldown) ───────────────────────────────────

    /// Initiate an unstake. Rewards stop accruing from this point.
    /// The full `principal + rewards_so_far` is locked in a `PendingWithdrawal`
    /// and can only be claimed after the cooldown period via `claim_unstaked`.
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

        // Calculate rewards accrued up to this moment; rewards stop accruing now.
        let rewards = Self::calc_rewards(&info, &tier, now);
        let locked_amount = info.amount + rewards;

        // Append a new PendingWithdrawal — each partial or full unstake gets its own entry.
        let cooldown_secs: u64 = env
            .storage()
            .instance()
            .get(&StakeKey::CooldownSecs)
            .unwrap_or(DEFAULT_COOLDOWN_SECS);
        let claimable_at = now + cooldown_secs;

        let withdrawal = PendingWithdrawal {
            amount: locked_amount,
            claimable_at,
            staker: staker.clone(),
        };

        let mut pending: Vec<PendingWithdrawal> = env
            .storage()
            .persistent()
            .get(&StakeKey::PendingWithdrawals(staker.clone()))
            .unwrap_or(Vec::new(&env));
        pending.push_back(withdrawal);
        env.storage()
            .persistent()
            .set(&StakeKey::PendingWithdrawals(staker.clone()), &pending);
        env.storage()
            .persistent()
            .extend_ttl(&StakeKey::PendingWithdrawals(staker.clone()), STAKE_TTL_LEDGERS, STAKE_TTL_LEDGERS);

        // Remove the active stake record — rewards no longer accrue.
        env.storage()
            .persistent()
            .remove(&StakeKey::Stake(staker.clone()));

        env.events()
            .publish((symbol_short!("ust_pend"),), (staker, claimable_at));
    }

    // ── Claim unstaked (after cooldown) ───────────────────────────────

    /// Claim all matured pending withdrawals for `staker`.
    /// Panics if no withdrawals are claimable yet.
    /// Multiple pending withdrawals are processed in order; only those whose
    /// cooldown has elapsed are transferred. Immature withdrawals remain.
    pub fn claim_unstaked(env: Env, staker: Address) {
        staker.require_auth();

        let pending: Vec<PendingWithdrawal> = env
            .storage()
            .persistent()
            .get(&StakeKey::PendingWithdrawals(staker.clone()))
            .expect("no pending withdrawals");

        assert!(!pending.is_empty(), "no pending withdrawals");

        let now = env.ledger().timestamp();
        let mut claimable_total: i128 = 0;
        let mut remaining: Vec<PendingWithdrawal> = Vec::new(&env);

        for w in pending.iter() {
            if now >= w.claimable_at {
                claimable_total += w.amount;
            } else {
                remaining.push_back(w);
            }
        }

        assert!(claimable_total > 0, "cooldown not elapsed");

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&StakeKey::StakingToken)
            .expect("staking token not set");
        token::Client::new(&env, &staking_token).transfer(
            &env.current_contract_address(),
            &staker,
            &claimable_total,
        );

        // Persist (or remove) the remaining list.
        if remaining.is_empty() {
            env.storage()
                .persistent()
                .remove(&StakeKey::PendingWithdrawals(staker.clone()));
        } else {
            env.storage()
                .persistent()
                .set(&StakeKey::PendingWithdrawals(staker.clone()), &remaining);
            env.storage()
                .persistent()
                .extend_ttl(&StakeKey::PendingWithdrawals(staker.clone()), STAKE_TTL_LEDGERS, STAKE_TTL_LEDGERS);
        }

        env.events()
            .publish((symbol_short!("ust_clmd"),), (staker, claimable_total));
    }

    // ── Emergency unstake ──────────────────────────────────────────────
    // Emergency unstake bypasses the cooldown (penalty is the tradeoff).

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

    // ── Partial unstake (initiates cooldown for partial amount) ────────

    pub fn partial_unstake(env: Env, staker: Address, unstake_amount: i128) -> Result<(), StakingModuleError> {
        staker.require_auth();
        let mut info: StakeInfo = env
            .storage()
            .persistent()
            .get(&StakeKey::Stake(staker.clone()))
            .ok_or(StakingModuleError::NoActiveStake)?;

        if unstake_amount <= 0 || unstake_amount > info.amount {
            return Err(StakingModuleError::InvalidUnstakeAmount);
        }

        let tier: StakingTier = env
            .storage()
            .persistent()
            .get(&StakeKey::Tier(info.tier_id.clone()))
            .ok_or(StakingModuleError::TierNotFound)?;

        let now = env.ledger().timestamp();

        // Pro-rate rewards for the removed portion; rewards stop accruing on that amount now.
        let removed_portion_ratio = unstake_amount * REWARD_PRECISION / info.amount;
        let total_rewards = Self::calculate_rewards(info.amount, info.stake_timestamp, now, tier.base_rate_bps);
        let removed_rewards = total_rewards * removed_portion_ratio / REWARD_PRECISION;
        let locked_amount = unstake_amount + removed_rewards;

        // Create a PendingWithdrawal for the partial amount.
        let cooldown_secs: u64 = env
            .storage()
            .instance()
            .get(&StakeKey::CooldownSecs)
            .unwrap_or(DEFAULT_COOLDOWN_SECS);
        let claimable_at = now + cooldown_secs;

        let withdrawal = PendingWithdrawal {
            amount: locked_amount,
            claimable_at,
            staker: staker.clone(),
        };

        let mut pending: Vec<PendingWithdrawal> = env
            .storage()
            .persistent()
            .get(&StakeKey::PendingWithdrawals(staker.clone()))
            .unwrap_or(Vec::new(&env));
        pending.push_back(withdrawal);
        env.storage()
            .persistent()
            .set(&StakeKey::PendingWithdrawals(staker.clone()), &pending);
        env.storage()
            .persistent()
            .extend_ttl(&StakeKey::PendingWithdrawals(staker.clone()), STAKE_TTL_LEDGERS, STAKE_TTL_LEDGERS);

        // Update the active stake — remove the unstaked portion; rewards reset checkpoint.
        info.amount -= unstake_amount;
        info.accumulated_rewards = total_rewards - removed_rewards;
        info.stake_timestamp = now;

        if info.amount == 0 {
            env.storage()
                .persistent()
                .remove(&StakeKey::Stake(staker.clone()));
        } else {
            env.storage()
                .persistent()
                .set(&StakeKey::Stake(staker.clone()), &info);
            env.storage()
                .persistent()
                .extend_ttl(&StakeKey::Stake(staker.clone()), STAKE_TTL_LEDGERS, STAKE_TTL_LEDGERS);
        }

        env.events()
            .publish((symbol_short!("pust_pend"),), (staker, unstake_amount, claimable_at));
        Ok(())
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

    /// Calculate rewards using fixed-point arithmetic (i128 with 7 decimal places)
    /// Formula: stake_amount * apy_bps * elapsed_seconds / (365 * 24 * 3600 * 10000)
    fn calculate_rewards(stake_amount: i128, start_time: u64, end_time: u64, apy_bps: u32) -> i128 {
        if end_time <= start_time {
            return 0;
        }
        let elapsed = (end_time - start_time) as i128;
        let year_secs: i128 = 365 * 24 * 3600;
        let apy_factor: i128 = apy_bps as i128;

        // Fixed-point: multiply by 10^7 to preserve precision
        let reward = stake_amount
            * apy_factor
            * elapsed
            * REWARD_PRECISION
            / (year_secs * 10_000 * REWARD_PRECISION);
        reward
    }

    /// Simple linear reward: principal * base_rate_bps * multiplier * elapsed / year / 10_000^2
    fn calc_rewards(info: &StakeInfo, tier: &StakingTier, now: u64) -> i128 {
        let elapsed = (now - info.staked_at) as i128;
        let year_secs: i128 = 365 * 24 * 3600;
        info.amount
            * tier.base_rate_bps as i128
            * tier.reward_multiplier_bps as i128
            * elapsed
            * REWARD_PRECISION
            / year_secs
            / 100_000_000 // 10_000 * 10_000
            / REWARD_PRECISION
    }

    pub fn claim_staking_rewards(env: Env, staker: Address) -> Result<i128, StakingModuleError> {
        staker.require_auth();
        let mut info: StakeInfo = env
            .storage()
            .persistent()
            .get(&StakeKey::Stake(staker.clone()))
            .ok_or(StakingModuleError::NoActiveStake)?;

        let tier: StakingTier = env
            .storage()
            .persistent()
            .get(&StakeKey::Tier(info.tier_id.clone()))
            .ok_or(StakingModuleError::TierNotFound)?;

        let now = env.ledger().timestamp();
        let rewards = Self::calculate_rewards(info.amount, info.stake_timestamp, now, tier.base_rate_bps);

        if rewards <= 0 {
            return Ok(0);
        }

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&StakeKey::StakingToken)
            .ok_or(StakingModuleError::StakingTokenNotSet)?;

        token::Client::new(&env, &staking_token).transfer(
            &env.current_contract_address(),
            &staker,
            &rewards,
        );

        info.accumulated_rewards = 0;
        info.stake_timestamp = now;
        info.claimed_rewards += rewards;
        env.storage()
            .persistent()
            .set(&StakeKey::Stake(staker.clone()), &info);
        env.storage()
            .persistent()
            .extend_ttl(&StakeKey::Stake(staker.clone()), STAKE_TTL_LEDGERS, STAKE_TTL_LEDGERS);

        env.events()
            .publish((symbol_short!("rwrd_clm"),), (staker, rewards));
        Ok(rewards)
    }
}
