use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u32)]
pub enum ContractError {
    AdminNotSet = 1,
    NotAdmin = 2,
    Unauthorized = 3,
    WorkspaceNotFound = 4,
    WorkspaceUnavailable = 5,
    BookingNotFound = 6,
    BookingAlreadyConfirmed = 7,
    InvalidTimeRange = 8,
    OverlappingBooking = 9,
    InsufficientPayment = 10,
    TimeConflict = 11,
    CapacityExceeded = 12,
    WaitlistFull = 13,
    NotInWaitlist = 14,
    WaitlistExpired = 15,
    TokenNotFound = 16,
    InvalidExpiryDate = 18,
    InsufficientAllowance = 19,
    Overflow = 30,
    InvalidInput = 31,
    PaymentTokenNotSet = 32,
    AlreadyCancelled = 33,
    BatchTooLarge = 34,
}
