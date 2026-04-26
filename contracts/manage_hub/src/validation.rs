use soroban_sdk::{contracterror, Env};

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_BATCH_SIZE: u32 = 50;

// ── Errors ─────────────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum BatchError {
    EmptyBatch = 1,
    BatchTooLarge = 2,
}

// ── Validator ──────────────────────────────────────────────────────────────
pub struct BatchValidator;

impl BatchValidator {
    /// Validate batch size
    /// Returns error if len == 0 or len > MAX_BATCH_SIZE (50)
    pub fn validate_batch_size(_env: &Env, len: u32) -> Result<(), BatchError> {
        if len == 0 {
            return Err(BatchError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(BatchError::BatchTooLarge);
        }
        Ok(())
    }
}
