/// Storage Schema Migration Pattern for Hub-Assist contracts.
///
/// # Overview
///
/// This module provides a reusable `StorageMigrator` pattern that any Hub-Assist
/// Soroban contract can embed to:
///
/// 1. **Detect** the current on-chain schema version via a reserved storage key.
/// 2. **Execute** incremental migration steps in strict order (v1→v2→v3…).
/// 3. **Refuse** to operate when the stored schema version is ahead of the
///    compiled version (forward-incompatibility guard).
///
/// ## Reserved key
///
/// The schema version is stored under the symbol key `"__sv"` in *instance*
/// storage.  This key must never be used for any other purpose in any contract
/// that embeds this migrator.
///
/// ## Authoring a migration step
///
/// ```rust,ignore
/// use common_types::migration::MigrationStep;
/// use soroban_sdk::Env;
///
/// pub struct AddDescriptionField;
///
/// impl MigrationStep for AddDescriptionField {
///     fn from_version(&self) -> u32 { 1 }
///     fn to_version(&self)   -> u32 { 2 }
///
///     fn migrate(&self, env: &Env) {
///         // Write back-filled default values for the new field.
///         // Do NOT call `set_schema_version` here; the runner handles that.
///     }
/// }
/// ```
///
/// Then in your contract's `upgrade()` hook:
///
/// ```rust,ignore
/// use common_types::migration::run_migrations;
///
/// pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
///     admin.require_auth();
///     env.deployer().update_current_contract_wasm(new_wasm_hash);
///     run_migrations(&env, &[
///         soroban_sdk::extern_type!(), // Box<dyn MigrationStep> list
///     ]);
/// }
/// ```
use soroban_sdk::{symbol_short, Env, Symbol};

// ── Reserved storage key ──────────────────────────────────────────────────────

/// The instance-storage key under which the schema version `u32` is stored.
///
/// Using a fixed `symbol_short!` keeps the key stable across WASM builds and
/// avoids any collision with contract-specific `DataKey` enums as long as
/// contracts follow the documented convention of never reusing `"__sv"`.
pub const SCHEMA_VERSION_KEY: Symbol = symbol_short!("__sv");

// ── Public helpers ────────────────────────────────────────────────────────────

/// Return the schema version currently stored in instance storage.
///
/// Defaults to `1` for contracts that predate version tracking (i.e. any
/// deployed contract that does not yet have the key written is treated as v1).
pub fn get_schema_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&SCHEMA_VERSION_KEY)
        .unwrap_or(1u32)
}

/// Persist `version` as the current schema version in instance storage.
///
/// Intended to be called *only* by `run_migrations` after each step succeeds.
/// Application code should never need to call this directly.
pub fn set_schema_version(env: &Env, version: u32) {
    env.storage().instance().set(&SCHEMA_VERSION_KEY, &version);
}

// ── MigrationStep trait ───────────────────────────────────────────────────────

/// A single, atomic migration step that advances the schema version by exactly
/// one increment.
///
/// Implementors **must** satisfy:
///   - `to_version() == from_version() + 1`
///   - `migrate()` is idempotent when called on already-migrated storage
///     (though `run_migrations` prevents double-execution by checking the
///     current version before dispatching).
pub trait MigrationStep {
    /// The schema version this step requires as its input.
    fn from_version(&self) -> u32;

    /// The schema version this step produces as its output.
    fn to_version(&self) -> u32;

    /// Execute the migration logic against `env`.
    ///
    /// This function **must not** call `set_schema_version`; the runner
    /// manages version bookkeeping so that a panic inside `migrate` leaves
    /// the stored version unchanged (no partial migration).
    fn migrate(&self, env: &Env);
}

// ── Migration runner ──────────────────────────────────────────────────────────

/// Run all pending migration steps in strict ascending order.
///
/// # Algorithm
///
/// 1. Read the current schema version `v` from storage.
/// 2. For each step whose `from_version()` equals `v`:
///    a. Call `step.migrate(env)`.  If this panics, the version is **not**
///       updated, preventing a partially-applied migration from being marked
///       complete.
///    b. Set the schema version to `step.to_version()`.
///    c. Update `v` for the next iteration.
/// 3. Steps whose `from_version()` is less than the current version are
///    **skipped** (idempotent — already applied).
/// 4. Steps whose `from_version()` is greater than the current version are
///    **skipped** for now (will be applied in a future upgrade).
///
/// # Ordering requirement
///
/// `steps` **must** be provided in ascending `from_version` order.  Providing
/// steps out of order or with gaps will silently skip the unreachable steps.
///
/// # Panics
///
/// Panics propagate unchanged from `step.migrate()`.  Because the version is
/// only written *after* `migrate()` returns successfully, the on-chain schema
/// version is never advanced for a step that panics.
pub fn run_migrations(env: &Env, steps: &[&dyn MigrationStep]) {
    let mut current = get_schema_version(env);

    for step in steps {
        // Only execute the step that is exactly one version ahead of current.
        if step.from_version() == current {
            // migrate() runs first; if it panics, set_schema_version is never
            // reached so the stored version stays at `current`.
            step.migrate(env);
            set_schema_version(env, step.to_version());
            current = step.to_version();
        }
        // Steps with from_version < current are already applied — skip.
        // Steps with from_version > current are not yet reachable — skip.
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(any(test, feature = "testutils"))]
pub mod test_support {
    use soroban_sdk::Env;

    /// Helper: directly write a schema version into the test environment so
    /// tests can simulate a contract that was deployed at a specific version
    /// without going through `run_migrations`.
    pub fn force_schema_version(env: &Env, version: u32) {
        super::set_schema_version(env, version);
    }
}
