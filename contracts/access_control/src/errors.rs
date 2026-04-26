use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u32)]
pub enum AccessControlError {
    Unauthorized     = 1,
    AdminNotSet      = 2,
    UserNotFound     = 3,
    ProposalNotFound = 4,
    AlreadyApproved  = 5,
    ThresholdNotMet  = 6,
    TimeLockActive   = 7,
    ContractPaused   = 8,
}
