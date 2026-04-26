use soroban_sdk::{contracttype, String};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum MembershipStatus {
    Active,
    Expired,
    Revoked,
    GracePeriod,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum TierLevel {
    Basic,
    Standard,
    Premium,
    Enterprise,
}

#[contracttype]
#[derive(Clone)]
pub struct TierFeature {
    pub name: String,
    pub enabled: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionTier {
    pub level: TierLevel,
    pub price: i128,
    pub duration_days: u32,
    pub features: soroban_sdk::Vec<TierFeature>,
}

#[contracttype]
#[derive(Clone)]
pub enum MetadataValue {
    Text(String),
    Number(i128),
    Bool(bool),
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum TierChangeStatus {
    Pending,
    Approved,
    Rejected,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum TierChangeType {
    Upgrade,
    Downgrade,
    Renewal,
}

#[contracttype]
#[derive(Clone)]
pub struct TierChangeRequest {
    pub member: soroban_sdk::Address,
    pub from_tier: TierLevel,
    pub to_tier: TierLevel,
    pub change_type: TierChangeType,
    pub status: TierChangeStatus,
    pub requested_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct TierPromotion {
    pub tier: TierLevel,
    pub discount_bps: u32,
    pub valid_until: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct DateRange {
    pub start: u64,
    pub end: u64,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum DayPattern {
    Weekdays,
    Weekends,
    Daily,
    Custom,
}

#[contracttype]
#[derive(Clone)]
pub struct AttendanceFrequency {
    pub pattern: DayPattern,
    pub times_per_week: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct PeakHourData {
    pub hour: u32,
    pub occupancy_count: u32,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum TimePeriod {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[contracttype]
#[derive(Clone)]
pub struct UserAttendanceStats {
    pub member: soroban_sdk::Address,
    pub total_visits: u32,
    pub period: TimePeriod,
    pub date_range: DateRange,
    pub peak_hours: soroban_sdk::Vec<PeakHourData>,
}
