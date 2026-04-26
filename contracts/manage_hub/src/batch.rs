use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, BytesN, Env, String, Vec};

use crate::membership_token::{IssueParams, MembershipTokenContract, TransferParams};
use crate::validation::{BatchError, BatchValidator};
use common_types::{MembershipStatus, MetadataValue};

// ── Domain types ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct UpdateParams {
    pub id: BytesN<32>,
    pub metadata_key: String,
    pub metadata_value: MetadataValue,
}

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum BatchKey {
    TokenMetadata(BytesN<32>, String),
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct BatchModule;

#[contractimpl]
impl BatchModule {
    /// Batch mint tokens
    /// Validates batch size, calls MembershipTokenContract::batch_issue_tokens, emits bat_mint event
    pub fn batch_mint(env: Env, params_vec: Vec<IssueParams>) -> Result<(), BatchError> {
        let batch_size = params_vec.len();
        BatchValidator::validate_batch_size(&env, batch_size)?;

        // Call MembershipTokenContract::batch_issue_tokens
        MembershipTokenContract::batch_issue_tokens(env.clone(), params_vec);

        let timestamp = env.ledger().timestamp();
        env.events()
            .publish((symbol_short!("bat_mint"),), (batch_size, timestamp));

        Ok(())
    }

    /// Batch transfer tokens
    /// Validates batch size, calls MembershipTokenContract::batch_transfer_tokens, emits bat_xfr event
    pub fn batch_transfer(env: Env, params_vec: Vec<TransferParams>) -> Result<(), BatchError> {
        let batch_size = params_vec.len();
        BatchValidator::validate_batch_size(&env, batch_size)?;

        // Call MembershipTokenContract::batch_transfer_tokens
        MembershipTokenContract::batch_transfer_tokens(env.clone(), params_vec);

        let timestamp = env.ledger().timestamp();
        env.events()
            .publish((symbol_short!("bat_xfr"),), (batch_size, timestamp));

        Ok(())
    }

    /// Batch update token metadata
    /// Validates batch size, updates metadata for each token, emits bat_upd event
    pub fn batch_update(env: Env, params_vec: Vec<UpdateParams>) -> Result<(), BatchError> {
        let batch_size = params_vec.len();
        BatchValidator::validate_batch_size(&env, batch_size)?;

        // Update metadata for each token
        for param in params_vec.iter() {
            // Verify token exists by checking if we can get it
            let token = MembershipTokenContract::get_token(env.clone(), param.id.clone());
            
            // Only update metadata for active tokens
            assert!(
                token.status == MembershipStatus::Active,
                "token not active"
            );

            // Store metadata
            env.storage().persistent().set(
                &BatchKey::TokenMetadata(param.id.clone(), param.metadata_key.clone()),
                &param.metadata_value,
            );
        }

        let timestamp = env.ledger().timestamp();
        env.events()
            .publish((symbol_short!("bat_upd"),), (batch_size, timestamp));

        Ok(())
    }

    /// Get token metadata
    pub fn get_token_metadata(
        env: Env,
        token_id: BytesN<32>,
        metadata_key: String,
    ) -> Option<MetadataValue> {
        env.storage()
            .persistent()
            .get(&BatchKey::TokenMetadata(token_id, metadata_key))
    }
}
