use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, PartialEq)]
pub enum ContractError {
    AdminNotSet = 1,
    Unauthorized = 2,
    EscrowNotFound = 3,
    EscrowAlreadyReleased = 4,
    EscrowInDispute = 5,
    DisputeWindowActive = 6,
    InsufficientBalance = 7,
    PaymentTokenNotSet = 8,
    InvalidAmount = 9,
}
