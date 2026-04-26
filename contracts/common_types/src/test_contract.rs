use soroban_sdk::{contract, contractimpl, Env, Vec};

use crate::{MembershipStatus, TierLevel, TimePeriod};

#[contract]
pub struct TypesTestContract;

#[contractimpl]
impl TypesTestContract {
    pub fn check_status(_env: Env) -> MembershipStatus {
        MembershipStatus::Active
    }

    pub fn check_tier(_env: Env) -> TierLevel {
        TierLevel::Basic
    }

    pub fn check_period(_env: Env) -> TimePeriod {
        TimePeriod::Monthly
    }

    pub fn check_peak_hours(env: Env) -> Vec<crate::PeakHourData> {
        Vec::new(&env)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_types_compile() {
        let env = Env::default();
        let client = TypesTestContractClient::new(&env, &env.register(TypesTestContract, ()));
        assert_eq!(client.check_status(), MembershipStatus::Active);
        assert_eq!(client.check_tier(), TierLevel::Basic);
        assert_eq!(client.check_period(), TimePeriod::Monthly);
    }
}
