#![no_std]

mod allowance;
mod attendance_log;
mod batch;
mod membership_token;
mod rewards;
mod subscription;
mod staking;
mod tier_management;
mod validation;
mod upgrade;
mod upgrade_errors;
mod migration;
mod pause_errors;
mod guards;
mod fractionalization;
mod royalty;
mod test;

pub use attendance_log::{
    AttendanceAction, AttendanceLog, AttendanceLogModule, AttendanceLogModuleClient,
    AttendanceSummary, PeakHour,
};
pub use batch::{BatchModule, BatchModuleClient, UpdateParams};
pub use membership_token::{
    IssueParams, MembershipToken, MembershipTokenContract, MembershipTokenContractClient,
    TransferParams,
};
pub use rewards::{RewardsModule, RewardsModuleClient, StakingError};
pub use subscription::{SubscriptionModule, SubscriptionModuleClient};
pub use staking::{StakeInfo, StakingConfig, StakingModule, StakingModuleClient, StakingTier};
pub use tier_management::{TierManagementModule, TierManagementModuleClient, TierUpdate};
pub use validation::{BatchError, BatchValidator};
pub use upgrade::{UpgradeModule, UpgradeModuleClient};
pub use upgrade_errors::UpgradeError;
pub use migration::{MigrationModule, MigrationModuleClient};
pub use pause_errors::PauseError;
pub use guards::{require_admin, require_not_paused, require_usdc_set, validate_expiry_date, validate_payment, GuardError};
pub use fractionalization::{FractionalizationModule, FractionalizationError};
pub use royalty::RoyaltyModule;
pub use allowance::{AllowanceModule, AllowanceModuleClient, AllowanceInfo};
