#![no_std]

mod errors;
mod types;

pub use errors::ContractError;
pub use types::{
    AttendanceFrequency, DateRange, DayPattern, MembershipStatus, MetadataValue, PeakHourData,
    Subscription, SubscriptionStatus, SubscriptionTier, TierChangeRequest, TierChangeStatus,
    TierChangeType, TierFeature, TierLevel, TierPromotion, TimePeriod, UserAttendanceStats,
};

#[cfg(any(test, feature = "testutils"))]
pub mod test_contract;
