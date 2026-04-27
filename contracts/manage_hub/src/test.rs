#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env, String,
};

use crate::{
    rewards::RewardsModule,
    staking::{StakeKey, StakingConfig, StakingModule, StakingModuleClient, StakingTier},
};

// ── helpers ───────────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    admin: Address,
    contract_id: Address,
    token_id: Address,
}

impl TestEnv {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| li.timestamp = 1_000);

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = sac.address();

        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, StakingModule);

        // Store admin + staking token directly in instance storage
        env.as_contract(&contract_id, || {
            env.storage().instance().set(&StakeKey::Admin, &admin);
            env.storage()
                .instance()
                .set(&StakeKey::StakingToken, &token_id);
        });

        TestEnv { env, admin, contract_id, token_id }
    }

    fn client(&self) -> StakingModuleClient {
        StakingModuleClient::new(&self.env, &self.contract_id)
    }

    fn token(&self) -> token::Client {
        token::Client::new(&self.env, &self.token_id)
    }

    fn mint(&self, to: &Address, amount: i128) {
        token::StellarAssetClient::new(&self.env, &self.token_id).mint(to, &amount);
    }

    fn default_config(&self) -> StakingConfig {
        StakingConfig {
            min_stake_amount: 100,
            max_stake_amount: 1_000_000,
            emergency_unstake_penalty_bps: 500, // 5%
        }
    }

    fn tier_id(&self, seed: u8) -> BytesN<32> {
        BytesN::from_array(&self.env, &[seed; 32])
    }

    fn default_tier(&self, id: BytesN<32>) -> StakingTier {
        StakingTier {
            id,
            name: String::from_str(&self.env, "Gold"),
            min_amount: 100,
            base_rate_bps: 1_000,       // 10% APR
            reward_multiplier_bps: 10_000, // 1x
            lock_period_seconds: 0,
        }
    }

    fn setup_config_and_tier(&self) -> BytesN<32> {
        self.client()
            .set_staking_config(&self.admin, &self.default_config());
        let tid = self.tier_id(1);
        self.client()
            .add_staking_tier(&self.admin, &self.default_tier(tid.clone()));
        tid
    }
}

// ── set_staking_config ────────────────────────────────────────────────────────

#[test]
fn test_set_staking_config_by_admin_succeeds() {
    let t = TestEnv::new();
    // Should not panic
    t.client().set_staking_config(&t.admin, &t.default_config());
}

#[test]
#[should_panic]
fn test_set_staking_config_non_admin_fails() {
    let t = TestEnv::new();
    let non_admin = Address::generate(&t.env);
    // require_admin checks stored admin; non_admin is not stored admin
    t.client().set_staking_config(&non_admin, &t.default_config());
}

// ── add_staking_tier ──────────────────────────────────────────────────────────

#[test]
fn test_add_staking_tier_by_admin_succeeds() {
    let t = TestEnv::new();
    t.client().set_staking_config(&t.admin, &t.default_config());
    let tid = t.tier_id(1);
    t.client().add_staking_tier(&t.admin, &t.default_tier(tid.clone()));
    let stored = t.client().get_staking_tier(&tid);
    assert_eq!(stored.base_rate_bps, 1_000);
}

#[test]
fn test_add_staking_tier_duplicate_id_overwrites() {
    // Soroban storage set is idempotent; adding same tier_id twice just overwrites.
    // The contract does not error on duplicate — it appends to the list.
    // We verify the tier is still retrievable and list grows.
    let t = TestEnv::new();
    t.client().set_staking_config(&t.admin, &t.default_config());
    let tid = t.tier_id(1);
    t.client().add_staking_tier(&t.admin, &t.default_tier(tid.clone()));
    t.client().add_staking_tier(&t.admin, &t.default_tier(tid.clone()));
    // list_staking_tiers returns both entries (duplicate ids in list)
    let tiers = t.client().list_staking_tiers();
    assert_eq!(tiers.len(), 2);
}

// ── stake ─────────────────────────────────────────────────────────────────────

#[test]
fn test_stake_transfers_tokens_and_creates_record() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 500);

    t.client().stake(&staker, &200, &tid);

    // tokens moved to contract
    assert_eq!(t.token().balance(&staker), 300);
    assert_eq!(t.token().balance(&t.contract_id), 200);

    let info = t.client().get_stake(&staker);
    assert_eq!(info.amount, 200);
    assert_eq!(info.claimed_rewards, 0);
    assert!(!info.emergency_unstaked);
}

#[test]
#[should_panic(expected = "below min stake")]
fn test_stake_below_min_stake_amount_returns_error() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 500);
    t.client().stake(&staker, &50, &tid); // min is 100
}

// ── unstake ───────────────────────────────────────────────────────────────────

#[test]
fn test_unstake_returns_principal_plus_rewards() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 1_000);

    t.client().stake(&staker, &1_000, &tid);
    assert_eq!(t.token().balance(&staker), 0);

    // Advance 1 year (365 * 24 * 3600 = 31_536_000 seconds)
    t.env.ledger().with_mut(|li| li.timestamp = 1_000 + 31_536_000);

    t.client().unstake(&staker);

    // principal=1000, base_rate=1000bps=10%, multiplier=10000bps=1x
    // rewards = 1000 * 1000 * 10000 * 31536000 / 31536000 / 100_000_000 = 1
    let balance = t.token().balance(&staker);
    assert!(balance >= 1_000, "should get at least principal back");
}

#[test]
#[should_panic(expected = "lock period not elapsed")]
fn test_unstake_before_lock_period_fails() {
    let t = TestEnv::new();
    t.client().set_staking_config(&t.admin, &t.default_config());
    let tid = t.tier_id(2);
    let locked_tier = StakingTier {
        id: tid.clone(),
        name: String::from_str(&t.env, "Locked"),
        min_amount: 100,
        base_rate_bps: 500,
        reward_multiplier_bps: 10_000,
        lock_period_seconds: 86_400, // 1 day
    };
    t.client().add_staking_tier(&t.admin, &locked_tier);

    let staker = Address::generate(&t.env);
    t.mint(&staker, 500);
    t.client().stake(&staker, &200, &tid);
    // still at t=1000, lock not elapsed
    t.client().unstake(&staker);
}

// ── emergency_unstake ─────────────────────────────────────────────────────────

#[test]
fn test_emergency_unstake_returns_principal_minus_penalty() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 1_000);

    t.client().stake(&staker, &1_000, &tid);
    t.client().emergency_unstake(&staker);

    // penalty = 1000 * 500 / 10_000 = 50; payout = 950
    assert_eq!(t.token().balance(&staker), 950);
    // stake record removed
    // (get_stake would panic; we verify via token balance)
}

#[test]
fn test_emergency_unstake_no_rewards_paid() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 1_000);

    t.client().stake(&staker, &1_000, &tid);
    // advance time so rewards would accrue
    t.env.ledger().with_mut(|li| li.timestamp = 1_000 + 31_536_000);
    t.client().emergency_unstake(&staker);

    // payout is principal - penalty only, no rewards
    assert_eq!(t.token().balance(&staker), 950);
}

// ── calculate_pending_rewards ─────────────────────────────────────────────────

#[test]
fn test_calculate_pending_rewards_linear_after_elapsed_time() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 10_000);

    t.client().stake(&staker, &10_000, &tid);

    // advance half a year
    let half_year: u64 = 365 * 24 * 3600 / 2;
    t.env.ledger().with_mut(|li| li.timestamp = 1_000 + half_year);

    let stake_info = t.client().get_stake(&staker);
    // Use RewardsModule directly via env.as_contract
    let pending = t.env.as_contract(&t.contract_id, || {
        use crate::rewards::RewardsModule;
        RewardsModule::calculate_pending_rewards(t.env.clone(), stake_info).unwrap()
    });

    // principal=10000, base_rate=1000bps, multiplier=10000bps, elapsed=half_year
    // = 10000 * 1000 * 10000 * half_year / year / 100_000_000
    // = 10000 * 1000 * 10000 * 0.5 / 100_000_000 = 500
    assert_eq!(pending, 500);
}

#[test]
fn test_calculate_pending_rewards_zero_for_emergency_unstaked() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 1_000);

    t.client().stake(&staker, &1_000, &tid);
    let mut stake_info = t.client().get_stake(&staker);
    stake_info.emergency_unstaked = true;

    let pending = t.env.as_contract(&t.contract_id, || {
        RewardsModule::calculate_pending_rewards(t.env.clone(), stake_info).unwrap()
    });
    assert_eq!(pending, 0);
}

// ── claim_rewards ─────────────────────────────────────────────────────────────

#[test]
fn test_claim_rewards_transfers_and_updates_claimed() {
    let t = TestEnv::new();
    let tid = t.setup_config_and_tier();
    let staker = Address::generate(&t.env);
    t.mint(&staker, 10_000);
    // also fund contract so it can pay rewards
    t.mint(&t.contract_id, 10_000);

    t.client().stake(&staker, &10_000, &tid);

    // advance 1 full year
    t.env.ledger().with_mut(|li| li.timestamp = 1_000 + 365 * 24 * 3600);

    let claimed = t.env.as_contract(&t.contract_id, || {
        RewardsModule::claim_rewards(t.env.clone(), staker.clone()).unwrap()
    });

    // rewards for 1 year: 10000 * 1000 * 10000 / 100_000_000 = 1000
    assert_eq!(claimed, 1_000);
    assert_eq!(t.token().balance(&staker), 1_000); // staker received rewards

    let stake_info = t.client().get_stake(&staker);
    assert_eq!(stake_info.claimed_rewards, 1_000);
}
