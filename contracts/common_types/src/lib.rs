#![no_std]

mod errors;
pub mod migration;
mod types;

pub use errors::ContractError;
pub use migration::{get_schema_version, run_migrations, set_schema_version, MigrationStep};
pub use types::{
    AttendanceFrequency, DateRange, DayPattern, EntitlementResult, FeatureFlag,
    MembershipStatus, MetadataValue, PeakHourData, PendingWithdrawal, Subscription,
    SubscriptionStatus, SubscriptionTier, TierChangeRequest, TierChangeStatus, TierChangeType,
    TierFeature, TierLevel, TierPromotion, TimePeriod, UserAttendanceStats,
};

use soroban_sdk::{contracttype, Env, IntoVal, symbol_short, String, Symbol};

#[contracttype]
pub enum PauseKey {
    Paused,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractEventSchema {
    pub contract: Symbol,
    pub action: Symbol,
    pub data: String,
}

impl ContractEventSchema {
    pub fn new(contract: Symbol, action: Symbol, data: String) -> Self {
        Self { contract, action, data }
    }
}

pub fn publish_event<T, Topics>(env: &Env, contract: &str, action: Symbol, legacy_topics: Topics, data: T)
where
    T: Clone + IntoVal<Env>,
    Topics: IntoVal<Env>,
{
    let contract_topic = Symbol::new(env, contract);
    env.events().publish((symbol_short!("hubassist"), contract_topic, action), data.clone());
    env.events().publish(legacy_topics, data);
}

pub fn require_not_paused(env: &Env) -> Result<(), &'static str> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&PauseKey::Paused)
        .unwrap_or(false);
    if paused {
        return Err("contract is paused");
    }
    Ok(())
}

#[cfg(any(test, feature = "testutils"))]
pub mod test_contract;

#[cfg(test)]
mod migration_tests;
