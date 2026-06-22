#![no_std]

mod errors;
pub mod migration;
mod types;

pub use errors::ContractError;
pub use migration::{get_schema_version, run_migrations, set_schema_version, MigrationStep};
pub use types::{
    AggregatePeakHourData, AttendanceFrequency, DateRange, DayPattern, EntitlementResult,
    FeatureFlag, MembershipStatus, MetadataValue, PeakHourData, PendingWithdrawal, Subscription,
    SubscriptionStatus, SubscriptionTier, TierChangeRequest, TierChangeStatus, TierChangeType,
    TierFeature, TierLevel, TierPromotion, TimePeriod, UserAttendanceStats,
};

use soroban_sdk::{contracttype, Env};

#[contracttype]
pub enum PauseKey {
    Paused,
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
