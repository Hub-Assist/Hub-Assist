use soroban_sdk::{contracttype, Symbol, Vec, String};

// Standardized Event Schema for Hub-Assist
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractEventSchema {
    pub contract: Symbol,   // e.g., "device_registry"
    pub action: Symbol,     // e.g., "device_registered"
    pub data: Vec<String>,  // JSON-serializable data
}

impl ContractEventSchema {
    pub fn new(contract: Symbol, action: Symbol, data: Vec<String>) -> Self {
        Self { contract, action, data }
    }
}

// Helper to publish standardized events
pub fn publish_event(env: &soroban_sdk::Env, contract: Symbol, action: Symbol, data: Vec<String>) {
    let topics = Vec::from_array(env, [
        Symbol::new(env, "hubassist"),
        contract,
        action,
    ]);
    
    env.events().publish(topics, data);
}