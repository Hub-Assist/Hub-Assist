use soroban_sdk::contracterror;

/// Unified error enum for all cross-contract operations
#[contracterror]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u32)]
pub enum ContractError {
    // Admin & Auth
    AdminNotSet = 1,
    NotAdmin = 2,
    Unauthorized = 3,

    // Workspace & Booking
    WorkspaceNotFound = 4,
    WorkspaceUnavailable = 5,
    BookingNotFound = 6,
    BookingAlreadyConfirmed = 7,
    InvalidTimeRange = 8,
    OverlappingBooking = 9,
    InsufficientPayment = 10,
    TimeConflict = 11,
    CapacityExceeded = 12,

    // Waitlist
    WaitlistFull = 13,
    NotInWaitlist = 14,
    WaitlistExpired = 15,

    // Membership Token
    TokenNotFound = 16,
    TokenAlreadyIssued = 17,
    InvalidExpiryDate = 18,
    TokenRevoked = 19,
    GracePeriodBlock = 20,
    InvalidTransition = 21,
    CannotRenewExpired = 22,

    // Rewards & Merkle
    InvalidProof = 23,
    AlreadyClaimed = 24,
    InvalidMerkleRoot = 25,
    RewardNotFound = 26,

    // Payment & Escrow
    InsufficientBalance = 27,
    TransferFailed = 28,
    EscrowNotFound = 29,

    // General
    Overflow = 30,
    InvalidInput = 31,

    // Booking lifecycle
    AlreadyCancelled = 32,
    PaymentTokenNotSet = 33,
    InsufficientAllowance = 34,

    // Workspace type registry
    UnknownWorkspaceType = 35,
    WorkspaceTypeAlreadyExists = 36,

    // Batch & lifecycle
    BatchTooLarge = 37,
    ContractPaused = 38,
}
