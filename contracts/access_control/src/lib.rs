#![no_std]

mod access_control;
pub mod errors;
pub mod types;

#[cfg(test)]
mod access_control_tests;

use soroban_sdk::{contract, contractimpl, Address, Env};

use errors::AccessControlError;
use types::{AccessControlConfig, MembershipInfo, MultiSigConfig, ProposalAction, UserRole};

#[contract]
pub struct AccessControlContract;

#[contractimpl]
impl AccessControlContract {
    pub fn initialize(env: Env, admin: Address, multisig_config: MultiSigConfig) {
        access_control::initialize(&env, admin, multisig_config);
    }

    pub fn set_role(
        env: Env,
        admin: Address,
        user: Address,
        role: UserRole,
    ) -> Result<(), AccessControlError> {
        access_control::set_role(&env, admin, user, role)
    }

    pub fn get_role(env: Env, user: Address) -> Result<MembershipInfo, AccessControlError> {
        access_control::get_role(&env, user)
    }

    pub fn check_access(env: Env, user: Address, required_role: UserRole) -> bool {
        access_control::check_access(&env, user, required_role)
    }

    pub fn require_access(
        env: Env,
        user: Address,
        required_role: UserRole,
    ) -> Result<(), AccessControlError> {
        access_control::require_access(&env, user, required_role)
    }

    pub fn is_admin(env: Env, user: Address) -> bool {
        access_control::is_admin(&env, user)
    }

    pub fn remove_role(
        env: Env,
        admin: Address,
        user: Address,
    ) -> Result<(), AccessControlError> {
        access_control::remove_role(&env, admin, user)
    }

    pub fn update_config(
        env: Env,
        admin: Address,
        config: AccessControlConfig,
    ) -> Result<(), AccessControlError> {
        access_control::update_config(&env, admin, config)
    }

    pub fn pause(env: Env, admin: Address) -> Result<(), AccessControlError> {
        access_control::pause(&env, admin)
    }

    pub fn unpause(env: Env, admin: Address) -> Result<(), AccessControlError> {
        access_control::unpause(&env, admin)
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        action: ProposalAction,
    ) -> Result<u64, AccessControlError> {
        access_control::create_proposal(&env, proposer, action)
    }

    pub fn approve_proposal(
        env: Env,
        approver: Address,
        proposal_id: u64,
    ) -> Result<(), AccessControlError> {
        access_control::approve_proposal(&env, approver, proposal_id)
    }

    pub fn execute_proposal(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<(), AccessControlError> {
        access_control::execute_proposal(&env, executor, proposal_id)
    }
}
