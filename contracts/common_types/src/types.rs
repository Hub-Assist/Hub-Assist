use soroban_sdk::{contracttype, Address, String, Vec};

/// A pending withdrawal created when a staker calls `unstake()`.
/// The principal (and accrued rewards up to that point) cannot be claimed
/// until `env.ledger().timestamp() >= claimable_at`.
#[contracttype]
#[derive(Clone)]
pub struct PendingWithdrawal {
    /// Token amount (principal + rewards at unstake time) waiting for release.
    pub amount: i128,
    /// Unix timestamp after which `claim_unstaked` is allowed.
    pub claimable_at: u64,
    /// The staker address this withdrawal belongs to.
    pub staker: Address,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum FeatureFlag {
    MeetingRoomAccess,
    PrivateOfficeAccess,
    HotDeskAccess,
    EventAccess,
    NetworkingAccess,
    AnalyticsAccess,
    ApiAccess,
    PrioritySupport,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum MembershipStatus {
    Active,
    Expired,
    Revoked,
    GracePeriod,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
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
    pub id: soroban_sdk::BytesN<32>,
    pub name: String,
    pub level: TierLevel,
    pub price: i128,
    pub duration_days: u32,
    pub features: soroban_sdk::Vec<TierFeature>,
    pub is_active: bool,
    pub max_members: u32,
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
    pub id: soroban_sdk::BytesN<32>,
    pub member: soroban_sdk::Address,
    pub from_tier_id: soroban_sdk::BytesN<32>,
    pub to_tier_id: soroban_sdk::BytesN<32>,
    pub change_type: TierChangeType,
    pub status: TierChangeStatus,
    pub requested_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct TierPromotion {
    pub code: String,
    pub tier_id: soroban_sdk::BytesN<32>,
    pub discount_bps: u32,
    pub valid_from: u64,
    pub valid_until: u64,
    pub is_active: bool,
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

/// Aggregate peak-hour analytics for on-chain consumption.
/// Returned by `AttendanceLogModule::aggregate_peak_hours`.
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub struct AggregatePeakHourData {
    /// UTC hour (0-23) adjusted for the user's timezone offset that had the most clock-ins.
    pub peak_arrival_hour: u32,
    /// UTC hour (0-23) adjusted for the user's timezone offset that had the most clock-outs.
    pub peak_departure_hour: u32,
    /// Average session duration in minutes across the analysis window.
    pub avg_session_duration_minutes: u32,
    /// Sliding window in days that was used (≤ 90).
    pub window_days: u32,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
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

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum SubscriptionStatus {
    Active,
    Cancelled,
    Paused,
    Expired,
}

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub id: soroban_sdk::BytesN<32>,
    pub user: soroban_sdk::Address,
    pub payment_token: soroban_sdk::Address,
    pub amount: i128,
    pub status: SubscriptionStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub tier_id: soroban_sdk::BytesN<32>,
    pub billing_cycle: u64,
    pub pause_count: u32,
    pub paused_at: u64,
    pub pause_reason: String,
}

#[contracttype]
#[derive(Clone)]
pub struct EntitlementResult {
    pub has_access: bool,
    pub tier: TierLevel,
    pub feature: FeatureFlag,
    pub reason: String,
}
