//! Gemetra claim-audit — append-only log called by `vat-refund`.
//!
//! Exists so the registry can demonstrate **inter-contract communication**:
//! after each claim status change, `vat-refund` invokes `record`.

#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env};

pub const VERSION: u32 = 1;

#[contracttype]
pub enum DataKey {
    Admin,
    Count,
    LatestClaimId,
    LatestStatus,
}

#[contractevent]
pub struct AuditRecorded {
    #[topic]
    pub claim_id: u64,
    pub status: u32,
}

#[contract]
pub struct ClaimAuditContract;

#[contractimpl]
impl ClaimAuditContract {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Count, &0u64);
        extend_ttl(&env);
    }

    pub fn version(_env: Env) -> u32 {
        VERSION
    }

    /// Called by `vat-refund` after a claim status change. Returns the new count.
    pub fn record(env: Env, claim_id: u64, status: u32) -> u64 {
        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::Count)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::Count, &count);
        env.storage().instance().set(&DataKey::LatestClaimId, &claim_id);
        env.storage().instance().set(&DataKey::LatestStatus, &status);

        AuditRecorded { claim_id, status }.publish(&env);
        extend_ttl(&env);
        count
    }

    pub fn count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::Count)
            .unwrap_or(0)
    }

    pub fn latest(env: Env) -> (u64, u32) {
        let claim_id = env
            .storage()
            .instance()
            .get(&DataKey::LatestClaimId)
            .unwrap_or(0);
        let status = env
            .storage()
            .instance()
            .get(&DataKey::LatestStatus)
            .unwrap_or(0);
        (claim_id, status)
    }
}

fn extend_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(120 * 17280, 180 * 17280);
}

#[cfg(test)]
mod test;
