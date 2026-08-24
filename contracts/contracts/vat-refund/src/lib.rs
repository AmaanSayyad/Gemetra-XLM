//! Gemetra VAT Refund Registry — Soroban smart contract
//!
//! Stores tourist VAT refund claims on-chain: submit, review, approve, pay,
//! submit to government, record government approval/rejection, record treasury
//! reimbursement, cancel, or blacklist.
//!
//! Does not move XLM itself (treasury payouts and government settlement stay
//! off-chain today). This contract is an auditable claim ledger that can be
//! wired into the dApp later.

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    Symbol,
};

/// Contract version for clients and upgrades.
pub const VERSION: u32 = 2;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ClaimStatus {
    Pending = 0,
    Approved = 1,
    Paid = 2,
    GovernmentSubmitted = 3,
    GovernmentApproved = 4,
    GovernmentRejected = 5,
    TreasuryReimbursed = 6,
    Cancelled = 7,
    Blacklisted = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claim {
    pub claimant: Address,
    /// Refund amount in stroops (1 XLM = 10_000_000 stroops).
    pub amount: i128,
    /// Hash of receipt / invoice identifier (keccak256 or app-defined digest).
    pub receipt_hash: BytesN<32>,
    /// ISO-style country code, e.g. `AE`, `FR`.
    pub country_code: Symbol,
    pub status: ClaimStatus,
    /// Ledger timestamp when the claim was submitted.
    pub submitted_at: u64,
    /// Optional payout tx hash once marked paid (32 zero bytes until set).
    pub payout_ref: BytesN<32>,
    /// Hash of the verified submission package sent to the government/tax authority.
    pub government_submission_ref: BytesN<32>,
    /// Hash of the government decision (approved/rejected).
    pub government_decision_ref: BytesN<32>,
    /// Hash reference to the reimbursement settlement back to Gemetra treasury.
    pub treasury_reimbursement_ref: BytesN<32>,
    pub government_submitted_at: u64,
    pub government_decision_at: u64,
    pub treasury_reimbursed_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Treasury,
    Government,
    ClaimCount,
    Claim(u64),
    WalletBlacklisted(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    Unauthorized = 2,
    ClaimNotFound = 3,
    InvalidStatus = 4,
    WalletBlacklisted = 5,
    InvalidAmount = 6,
    AlreadyExists = 7,
}

#[contractevent]
pub struct ClaimSubmitted {
    #[topic]
    pub claim_id: u64,
    #[topic]
    pub claimant: Address,
    pub amount: i128,
    pub country_code: Symbol,
}

#[contractevent]
pub struct ClaimStatusChanged {
    #[topic]
    pub claim_id: u64,
    pub status: ClaimStatus,
    #[topic]
    pub actor: Address,
}

#[contractevent]
pub struct WalletBlacklisted {
    #[topic]
    pub wallet: Address,
    #[topic]
    pub actor: Address,
}

#[contract]
pub struct VatRefundContract;

#[contractimpl]
impl VatRefundContract {
    /// Runs once at deploy. Sets admin and treasury reference addresses.
    pub fn __constructor(env: Env, admin: Address, treasury: Address, government: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::Government, &government);
        env.storage().instance().set(&DataKey::ClaimCount, &0u64);
        extend_instance_ttl(&env);
    }

    /// Returns contract version.
    pub fn version(_env: Env) -> u32 {
        VERSION
    }

    pub fn admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    pub fn treasury(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .ok_or(Error::NotInitialized)
    }

    pub fn government(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Government)
            .ok_or(Error::NotInitialized)
    }

    pub fn claim_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ClaimCount)
            .unwrap_or(0)
    }

    /// Tourist submits a new claim. Claimant must sign the transaction.
    pub fn submit_claim(
        env: Env,
        claimant: Address,
        amount: i128,
        receipt_hash: BytesN<32>,
        country_code: Symbol,
    ) -> Result<u64, Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        claimant.require_auth();

        if env
            .storage()
            .instance()
            .get(&DataKey::WalletBlacklisted(claimant.clone()))
            .unwrap_or(false)
        {
            return Err(Error::WalletBlacklisted);
        }

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ClaimCount)
            .unwrap_or(0);
        let claim_id = count + 1;
        count = claim_id;
        env.storage().instance().set(&DataKey::ClaimCount, &count);

        let claim = Claim {
            claimant: claimant.clone(),
            amount,
            receipt_hash,
            country_code: country_code.clone(),
            status: ClaimStatus::Pending,
            submitted_at: env.ledger().timestamp(),
            payout_ref: zero_bytes(&env),
            government_submission_ref: zero_bytes(&env),
            government_decision_ref: zero_bytes(&env),
            treasury_reimbursement_ref: zero_bytes(&env),
            government_submitted_at: 0,
            government_decision_at: 0,
            treasury_reimbursed_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id), &claim);

        ClaimSubmitted {
            claim_id,
            claimant,
            amount,
            country_code,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(claim_id)
    }

    /// Admin approves a pending claim for payout.
    pub fn approve_claim(env: Env, admin: Address, claim_id: u64) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        admin.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::Pending {
            return Err(Error::InvalidStatus);
        }
        claim.status = ClaimStatus::Approved;
        save_claim(&env, claim_id, &claim);

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::Approved,
            actor: admin,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Admin records that treasury paid this claim (stores payout reference hash).
    pub fn mark_paid(
        env: Env,
        admin: Address,
        claim_id: u64,
        payout_ref: BytesN<32>,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        admin.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::Approved && claim.status != ClaimStatus::Pending {
            return Err(Error::InvalidStatus);
        }
        claim.status = ClaimStatus::Paid;
        claim.payout_ref = payout_ref;
        save_claim(&env, claim_id, &claim);

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::Paid,
            actor: admin,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Gemetra/admin submits the verified claim package to the government/tax authority.
    pub fn submit_to_government(
        env: Env,
        admin: Address,
        claim_id: u64,
        government_submission_ref: BytesN<32>,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        admin.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::Paid {
            return Err(Error::InvalidStatus);
        }

        claim.status = ClaimStatus::GovernmentSubmitted;
        claim.government_submission_ref = government_submission_ref;
        claim.government_submitted_at = env.ledger().timestamp();

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::GovernmentSubmitted,
            actor: admin,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Government approves the claim after verification and authorizes reimbursement.
    pub fn government_approve(
        env: Env,
        gov: Address,
        claim_id: u64,
        government_decision_ref: BytesN<32>,
    ) -> Result<(), Error> {
        require_government(&env, &gov)?;
        gov.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::GovernmentSubmitted {
            return Err(Error::InvalidStatus);
        }

        claim.status = ClaimStatus::GovernmentApproved;
        claim.government_decision_ref = government_decision_ref;
        claim.government_decision_at = env.ledger().timestamp();

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::GovernmentApproved,
            actor: gov,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Government rejects the claim after verification.
    pub fn government_reject(
        env: Env,
        gov: Address,
        claim_id: u64,
        government_decision_ref: BytesN<32>,
    ) -> Result<(), Error> {
        require_government(&env, &gov)?;
        gov.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::GovernmentSubmitted {
            return Err(Error::InvalidStatus);
        }

        claim.status = ClaimStatus::GovernmentRejected;
        claim.government_decision_ref = government_decision_ref;
        claim.government_decision_at = env.ledger().timestamp();

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::GovernmentRejected,
            actor: gov,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Government settles reimbursement back to Gemetra treasury.
    /// (We store the reimbursement reference hash; actual XLM settlement remains external today.)
    pub fn mark_treasury_reimbursed(
        env: Env,
        gov: Address,
        claim_id: u64,
        treasury_reimbursement_ref: BytesN<32>,
    ) -> Result<(), Error> {
        require_government(&env, &gov)?;
        gov.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::GovernmentApproved {
            return Err(Error::InvalidStatus);
        }

        claim.status = ClaimStatus::TreasuryReimbursed;
        claim.treasury_reimbursement_ref = treasury_reimbursement_ref;
        claim.treasury_reimbursed_at = env.ledger().timestamp();

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::TreasuryReimbursed,
            actor: gov,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Admin cancels a pending or approved claim.
    pub fn cancel_claim(env: Env, admin: Address, claim_id: u64) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        admin.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status != ClaimStatus::Pending && claim.status != ClaimStatus::Approved {
            return Err(Error::InvalidStatus);
        }
        claim.status = ClaimStatus::Cancelled;
        save_claim(&env, claim_id, &claim);

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::Cancelled,
            actor: admin,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Admin blacklists a claim and blocks the claimant wallet from future submissions.
    pub fn blacklist_claim(env: Env, admin: Address, claim_id: u64) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        admin.require_auth();

        let mut claim = load_claim(&env, claim_id)?;
        if claim.status == ClaimStatus::Paid
            || claim.status == ClaimStatus::TreasuryReimbursed
            || claim.status == ClaimStatus::Blacklisted
        {
            return Err(Error::InvalidStatus);
        }

        let wallet = claim.claimant.clone();
        claim.status = ClaimStatus::Blacklisted;
        save_claim(&env, claim_id, &claim);

        env.storage()
            .instance()
            .set(&DataKey::WalletBlacklisted(wallet.clone()), &true);

        ClaimStatusChanged {
            claim_id,
            status: ClaimStatus::Blacklisted,
            actor: admin.clone(),
        }
        .publish(&env);

        WalletBlacklisted {
            wallet,
            actor: admin,
        }
        .publish(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    pub fn get_claim(env: Env, claim_id: u64) -> Result<Claim, Error> {
        load_claim(&env, claim_id)
    }

    pub fn is_wallet_blacklisted(env: Env, wallet: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::WalletBlacklisted(wallet))
            .unwrap_or(false)
    }
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    if admin != *caller {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

fn require_government(env: &Env, caller: &Address) -> Result<(), Error> {
    let gov: Address = env
        .storage()
        .instance()
        .get(&DataKey::Government)
        .ok_or(Error::NotInitialized)?;
    if gov != *caller {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

fn load_claim(env: &Env, claim_id: u64) -> Result<Claim, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Claim(claim_id))
        .ok_or(Error::ClaimNotFound)
}

fn save_claim(env: &Env, claim_id: u64, claim: &Claim) {
    env.storage()
        .persistent()
        .set(&DataKey::Claim(claim_id), claim);
}

fn zero_bytes(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn extend_instance_ttl(env: &Env) {
    // ~120 ledgers threshold, extend to ~180 ledgers (~15 days on mainnet).
    env.storage()
        .instance()
        .extend_ttl(120 * 17280, 180 * 17280);
}

#[cfg(test)]
mod test;
