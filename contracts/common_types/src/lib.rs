#![no_std]

mod types;

pub use types::{
    AttendanceFrequency, DateRange, DayPattern, MembershipStatus, MetadataValue, PeakHourData,
    Subscription, SubscriptionStatus, SubscriptionTier, TierChangeRequest, TierChangeStatus,
    TierChangeType, TierFeature, TierLevel, TierPromotion, TimePeriod, UserAttendanceStats,
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
