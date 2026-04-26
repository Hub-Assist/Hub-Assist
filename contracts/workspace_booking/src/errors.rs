use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, PartialEq)]
pub enum ContractError {
    AdminNotSet = 1,
    Unauthorized = 2,
    WorkspaceNotFound = 3,
    WorkspaceUnavailable = 4,
    BookingNotFound = 5,
    BookingAlreadyConfirmed = 6,
    InvalidTimeRange = 7,
    OverlappingBooking = 8,
    InsufficientPayment = 9,
    PaymentTokenNotSet = 10,
}
