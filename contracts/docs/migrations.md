# Contract Storage Migrations

Hub-Assist contracts use the reusable migration helpers in `common_types::migration`
to keep stored data compatible across WASM upgrades.

## Reserved Schema Version Key

The current schema version is stored in instance storage under the reserved
`symbol_short!("__sv")` key. Contract-specific storage keys must not reuse this
symbol. Contracts that do not have a stored version are treated as schema
version `1`.

Use:

```rust
use common_types::{get_schema_version, set_schema_version};
```

Application code should normally read the version with `get_schema_version`.
Only the migration runner should advance the version with `set_schema_version`.

## Writing A Migration Step

Each migration step advances storage by exactly one version:

```rust
use common_types::MigrationStep;
use soroban_sdk::Env;

struct AddWorkspaceCapacity;

impl MigrationStep for AddWorkspaceCapacity {
    fn from_version(&self) -> u32 {
        1
    }

    fn to_version(&self) -> u32 {
        2
    }

    fn migrate(&self, env: &Env) {
        // Backfill or rewrite stored values here.
        // Do not call set_schema_version; run_migrations handles that.
    }
}
```

Rules:

- `to_version()` must equal `from_version() + 1`.
- Steps must be passed to `run_migrations` in ascending version order.
- Migrations must not skip versions; use one step per version transition.
- A step should be safe to reason about independently and should avoid changing
  the schema version directly.

## Running Migrations On Upgrade

Call `run_migrations` immediately after `update_current_contract_wasm` in each
contract upgrade hook:

```rust
use common_types::run_migrations;

pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);

    let step_v2 = AddWorkspaceCapacity;
    run_migrations(&env, &[&step_v2]);
}
```

The runner reads the stored version, executes only the next matching step, then
stores the new version after that step succeeds. If a migration panics, the
schema version remains unchanged so the contract does not mark partial work as
complete.

## Compatibility Checks

Contracts that require a specific schema can compare `get_schema_version(env)`
with their supported version before performing sensitive operations. If stored
data is from a newer, incompatible schema, the contract should refuse the
operation rather than reading data with the wrong layout.

## Testing Checklist

For each schema change, add tests that:

- Start at v1, run the v1 to v2 migration, and verify migrated fields are
  accessible.
- Start at v2 and verify the v1 to v2 step is skipped.
- Use a panicking migration and verify the schema version remains unchanged.
