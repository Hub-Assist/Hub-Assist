use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env};

use crate::staking::{StakeInfo, StakeKey, StakingTier};

// ── Constants ──────────────────────────────────────────────────────────────
const YEAR_SECS: i128 = 365 * 24 * 60 * 60;

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum RewardsKey {
    TotalRewardsPaid(Address),
}

// ── Errors ─────────────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum StakingError {
    Overflow = 1,
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct RewardsModule;

#[contractimpl]
impl RewardsModule {
    /// Calculate pending rewards for a stake
    /// Formula: principal * base_rate_bps / 10_000 * elapsed_seconds / YEAR_SECS * reward_multiplier_bps / 10_000 - claimed_rewards
    pub fn calculate_pending_rewards(
        env: Env,
        stake: StakeInfo,
    ) -> Result<i128, StakingError> {
        // Return 0 for emergency-unstaked positions
        if stake.emergency_unstaked {
            return Ok(0);
        }

        let tier: StakingTier = env
            .storage()
            .persistent()
            .get(&StakeKey::Tier(stake.tier_id.clone()))
            .expect("tier not found");

        let now = env.ledger().timestamp();
        let elapsed_seconds = (now - stake.staked_at) as i128;

        // Calculate: principal * base_rate_bps / 10_000
        let step1 = stake
            .amount
            .checked_mul(tier.base_rate_bps as i128)
            .ok_or(StakingError::Overflow)?;
        let step2 = step1.checked_div(10_000).ok_or(StakingError::Overflow)?;

        // Calculate: result * elapsed_seconds / YEAR_SECS
        let step3 = step2
            .checked_mul(elapsed_seconds)
            .ok_or(StakingError::Overflow)?;
        let step4 = step3.checked_div(YEAR_SECS).ok_or(StakingError::Overflow)?;

        // Calculate: result * reward_multiplier_bps / 10_000
        let step5 = step4
            .checked_mul(tier.reward_multiplier_bps as i128)
            .ok_or(StakingError::Overflow)?;
        let total_rewards = step5.checked_div(10_000).ok_or(StakingError::Overflow)?;

        // Subtract claimed rewards
        let pending = total_rewards
            .checked_sub(stake.claimed_rewards)
            .ok_or(StakingError::Overflow)?;

        Ok(pending.max(0))
    }

    /// Claim rewards for a staker
    pub fn claim_rewards(env: Env, staker: Address) -> Result<i128, StakingError> {
        staker.require_auth();

        let mut stake: StakeInfo = env
            .storage()
            .persistent()
            .get(&StakeKey::Stake(staker.clone()))
            .expect("no active stake");

        // Calculate pending rewards
        let pending = Self::calculate_pending_rewards(env.clone(), stake.clone())?;

        if pending > 0 {
            // Transfer rewards from contract to staker
            let staking_token: Address = env
                .storage()
                .instance()
                .get(&StakeKey::StakingToken)
                .expect("staking token not set");

            token::Client::new(&env, &staking_token).transfer(
                &env.current_contract_address(),
                &staker,
                &pending,
            );

            // Update claimed_rewards on stake
            stake.claimed_rewards = stake
                .claimed_rewards
                .checked_add(pending)
                .ok_or(StakingError::Overflow)?;

            env.storage()
                .persistent()
                .set(&StakeKey::Stake(staker.clone()), &stake);

            // Update total rewards paid
            let total_paid: i128 = env
                .storage()
                .persistent()
                .get(&RewardsKey::TotalRewardsPaid(staker.clone()))
                .unwrap_or(0);

            let new_total = total_paid
                .checked_add(pending)
                .ok_or(StakingError::Overflow)?;

            env.storage()
                .persistent()
                .set(&RewardsKey::TotalRewardsPaid(staker.clone()), &new_total);

            // Emit event
            env.events()
                .publish((symbol_short!("rwrd_clm"),), (staker, pending));
        }

        Ok(pending)
    }

    /// Get total lifetime rewards paid to a staker
    pub fn get_total_rewards_paid(env: Env, staker: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&RewardsKey::TotalRewardsPaid(staker))
            .unwrap_or(0)
    }
}
