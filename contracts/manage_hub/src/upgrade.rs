use soroban_sdk::{contract, contractimpl, Env, BytesN};
use crate::upgrade_errors::UpgradeError;
use common_types::run_migrations;

#[contract]
pub struct UpgradeModule;

#[contractimpl]
impl UpgradeModule {
    pub fn upgrade(env: Env, admin: soroban_sdk::Address, new_wasm_hash: BytesN<32>) -> Result<(), UpgradeError> {
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);

        // Run any pending schema migrations post-WASM-update.
        // Add new MigrationStep instances here as the schema evolves.
        run_migrations(&env, &[]);

        Ok(())
    }

    pub fn schedule_upgrade(
        env: Env,
        admin: soroban_sdk::Address,
        new_wasm_hash: BytesN<32>,
        execution_time: u64,
    ) -> Result<(), UpgradeError> {
        admin.require_auth();

        let current_time = env.ledger().timestamp();
        if execution_time <= current_time {
            return Err(UpgradeError::TimeLockActive);
        }

        let key = soroban_sdk::symbol_short!("upgrade");
        env.storage().persistent().set(&key, &(new_wasm_hash, execution_time));

        Ok(())
    }

    pub fn execute_scheduled_upgrade(env: Env) -> Result<(), UpgradeError> {
        let key = soroban_sdk::symbol_short!("upgrade");
        let scheduled: (BytesN<32>, u64) = env.storage()
            .persistent()
            .get(&key)
            .ok_or(UpgradeError::UpgradeNotScheduled)?;

        let current_time = env.ledger().timestamp();
        if current_time < scheduled.1 {
            return Err(UpgradeError::TimeLockActive);
        }

        env.deployer().update_current_contract_wasm(scheduled.0);
        env.storage().persistent().remove(&key);

        // Run any pending schema migrations post-WASM-update.
        run_migrations(&env, &[]);

        Ok(())
    }
}
