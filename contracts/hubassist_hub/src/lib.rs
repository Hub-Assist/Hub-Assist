#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, String, Vec};
use common_types;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum HubError {
    MemberAlreadyRegistered = 1,
}

#[contracttype]
#[derive(Clone)]
pub struct Member {
    pub address: Address,
    pub role: String,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Hub {
    pub hub_id: u32,
    pub name: String,
    pub owner: Address,
    pub active: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Members,
    HubCount,
    Hub(u32),
    HubMembers(u32),
}

#[contract]
pub struct HubAssistHub;

#[contractimpl]
impl HubAssistHub {
    /// Initialize the registry with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        let members: Vec<Member> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Members, &members);
    }

    /// Register a new hub. Returns the new hub_id.
    pub fn register_hub(env: Env, caller: Address, name: String) -> u32 {
        caller.require_auth();
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::HubCount)
            .unwrap_or(0u32)
            + 1;
        let hub = Hub {
            hub_id: count,
            name,
            owner: caller,
            active: true,
        };
        env.storage().instance().set(&DataKey::Hub(count), &hub);
        env.storage().instance().set(&DataKey::HubCount, &count);
        count
    }

    /// Get a hub by hub_id.
    pub fn get_hub(env: Env, hub_id: u32) -> Option<Hub> {
        env.storage().instance().get(&DataKey::Hub(hub_id))
    }

    /// Return total hub count.
    pub fn hub_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::HubCount)
            .unwrap_or(0u32)
    }

    /// Register a member to a specific hub.
    pub fn register_member(env: Env, caller: Address, hub_id: u32, role: String) -> Result<(), HubError> {
        caller.require_auth();
        let mut members: Vec<Member> = env
            .storage()
            .instance()
            .get(&DataKey::HubMembers(hub_id))
            .unwrap_or(Vec::new(&env));

        for i in 0..members.len() {
            if members.get(i).unwrap().address == caller {
                return Err(HubError::MemberAlreadyRegistered);
            }
        }

        members.push_back(Member { address: caller, role, active: true });
        env.storage()
            .instance()
            .set(&DataKey::HubMembers(hub_id), &members);
        Ok(())
    }

    /// Return member count for a specific hub.
    pub fn member_count(env: Env, hub_id: u32) -> u32 {
        let members: Vec<Member> = env
            .storage()
            .instance()
            .get(&DataKey::HubMembers(hub_id))
            .unwrap_or(Vec::new(&env));
        members.len()
    }

    /// WASM-upgrade hook.  Called by the admin immediately after deploying a
    /// new WASM binary.  Runs any pending storage schema migrations so that
    /// old on-chain data remains accessible under the new code.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        if admin != stored_admin {
            panic!("unauthorized");
        }
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        // Add MigrationStep instances here as the schema evolves.
        common_types::run_migrations(&env, &[]);
    }
}
