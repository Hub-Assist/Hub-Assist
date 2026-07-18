#![cfg(test)]

extern crate std;

use std::panic::AssertUnwindSafe;

use soroban_sdk::{Address, Env};

use crate::migration::{
    get_schema_version, run_migrations, set_schema_version, MigrationStep,
    test_support::force_schema_version,
};
use crate::test_contract::TypesTestContract;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn register_test_contract(env: &Env) -> Address {
    env.register_contract(None, TypesTestContract)
}

/// A step whose `migrate` always panics — used to verify no partial migration.
struct PanickingStep {
    from: u32,
    to: u32,
}

impl MigrationStep for PanickingStep {
    fn from_version(&self) -> u32 { self.from }
    fn to_version(&self)   -> u32 { self.to   }
    fn migrate(&self, _env: &Env) {
        panic!("intentional panic in migration");
    }
}

/// A step that records whether it was called by writing a flag to storage.
struct RecordingStep {
    from: u32,
    to: u32,
    flag_key: soroban_sdk::Symbol,
}

impl MigrationStep for RecordingStep {
    fn from_version(&self) -> u32 { self.from }
    fn to_version(&self)   -> u32 { self.to   }
    fn migrate(&self, env: &Env) {
        env.storage().instance().set(&self.flag_key, &true);
    }
}

// ── get_schema_version / set_schema_version ───────────────────────────────────

/// A freshly-created environment has no stored version; must default to 1.
#[test]
fn test_get_schema_version_defaults_to_1() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        assert_eq!(get_schema_version(&env), 1);
    });
}

#[test]
fn test_set_and_get_schema_version_round_trips() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        set_schema_version(&env, 5);
        assert_eq!(get_schema_version(&env), 5);
    });
}

// ── run_migrations – happy path ───────────────────────────────────────────────

/// Contract at v1 with a v1→v2 step: version advances to 2 and the step runs.
#[test]
fn test_v1_to_v2_migration_runs_and_advances_version() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        // v1 is the implicit default; no explicit set needed.
        let flag_key = soroban_sdk::symbol_short!("ran_v2");
        let step = RecordingStep { from: 1, to: 2, flag_key: flag_key.clone() };

        run_migrations(&env, &[&step]);

        assert_eq!(get_schema_version(&env), 2, "version must advance to 2");
        let ran: bool = env.storage().instance().get(&flag_key).unwrap_or(false);
        assert!(ran, "migration step must have executed");
    });
}

/// Multiple chained steps all execute in order.
#[test]
fn test_chained_v1_v2_v3_steps_all_run() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        let flag_v2 = soroban_sdk::symbol_short!("ran_v2");
        let flag_v3 = soroban_sdk::symbol_short!("ran_v3");

        let step_v2 = RecordingStep { from: 1, to: 2, flag_key: flag_v2.clone() };
        let step_v3 = RecordingStep { from: 2, to: 3, flag_key: flag_v3.clone() };

        run_migrations(&env, &[&step_v2, &step_v3]);

        assert_eq!(get_schema_version(&env), 3);
        assert!(env.storage().instance().get::<_, bool>(&flag_v2).unwrap_or(false));
        assert!(env.storage().instance().get::<_, bool>(&flag_v3).unwrap_or(false));
    });
}

// ── run_migrations – idempotency ──────────────────────────────────────────────

/// Contract already at v2: the v1→v2 step must be skipped (idempotent).
#[test]
fn test_already_at_v2_skips_v1_to_v2_step() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        force_schema_version(&env, 2); // simulate already-migrated contract

        let flag_key = soroban_sdk::symbol_short!("ran_v2");
        let step = RecordingStep { from: 1, to: 2, flag_key: flag_key.clone() };

        run_migrations(&env, &[&step]);

        assert_eq!(get_schema_version(&env), 2);
        let ran: bool = env.storage().instance().get(&flag_key).unwrap_or(false);
        assert!(!ran, "step must be skipped when version already at target");
    });
}

/// Calling run_migrations twice is safe; second call is a no-op.
#[test]
fn test_run_migrations_twice_is_idempotent() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        let flag_key = soroban_sdk::symbol_short!("ran_v2");
        let step = RecordingStep { from: 1, to: 2, flag_key: flag_key.clone() };

        run_migrations(&env, &[&step]);
        env.storage().instance().set(&flag_key, &false);
        run_migrations(&env, &[&step]);

        assert_eq!(get_schema_version(&env), 2);
        let ran: bool = env.storage().instance().get(&flag_key).unwrap_or(false);
        assert!(!ran, "second run must be a no-op");
    });
}

// ── run_migrations – panic safety ─────────────────────────────────────────────

/// A step that panics must leave the schema version unchanged.
#[test]
fn test_panicking_step_leaves_version_unchanged() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);

    let step = PanickingStep { from: 1, to: 2 };
    let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
        env.as_contract(&contract_id, || {
            run_migrations(&env, &[&step]);
        });
    }));

    assert!(result.is_err(), "expected a panic from PanickingStep");
    env.as_contract(&contract_id, || {
        assert_eq!(
            get_schema_version(&env),
            1,
            "schema version must not advance when migration panics"
        );
    });
}

// ── run_migrations – skip future steps ───────────────────────────────────────

/// A step whose `from_version` is ahead of the current version is skipped.
#[test]
fn test_future_step_is_skipped() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        // current version = 1, step requires v3; should be skipped entirely.
        let flag_key = soroban_sdk::symbol_short!("ran_v4");
        let step = RecordingStep { from: 3, to: 4, flag_key: flag_key.clone() };

        run_migrations(&env, &[&step]);

        assert_eq!(get_schema_version(&env), 1, "version must stay at 1");
        let ran: bool = env.storage().instance().get(&flag_key).unwrap_or(false);
        assert!(!ran, "future step must not execute");
    });
}

// ── run_migrations – empty step list ─────────────────────────────────────────

#[test]
fn test_empty_step_list_is_a_no_op() {
    let env = Env::default();
    let contract_id = register_test_contract(&env);
    env.as_contract(&contract_id, || {
        run_migrations(&env, &[]);
        assert_eq!(get_schema_version(&env), 1);
    });
}
