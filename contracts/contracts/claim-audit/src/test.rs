#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn records_and_reads_latest() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(ClaimAuditContract, (&admin,));
    let client = ClaimAuditContractClient::new(&env, &id);

    assert_eq!(client.version(), VERSION);
    assert_eq!(client.count(), 0);

    assert_eq!(client.record(&1, &2), 1);
    assert_eq!(client.count(), 1);
    assert_eq!(client.latest(), (1, 2));

    assert_eq!(client.record(&7, &6), 2);
    assert_eq!(client.latest(), (7, 6));
}
