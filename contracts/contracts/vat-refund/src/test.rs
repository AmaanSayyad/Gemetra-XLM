#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Symbol};

fn setup() -> (Env, Address, Address, VatRefundContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let government = Address::generate(&env);
    let contract_id = env.register(VatRefundContract, (&admin, &treasury, &government));
    let client = VatRefundContractClient::new(&env, &contract_id);

    (env, admin, government, client)
}

fn sample_receipt(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn initializes_and_returns_version() {
    let (_env, _admin, _gov, client) = setup();
    assert_eq!(client.version(), VERSION);
    assert_eq!(client.claim_count(), 0);
}

#[test]
fn submit_and_approve_claim() {
    let (env, admin, _gov, client) = setup();
    let claimant = Address::generate(&env);

    let claim_id = client.submit_claim(
        &claimant,
        &50_000_000i128,
        &sample_receipt(&env, 1),
        &Symbol::new(&env, "AE"),
    );

    assert_eq!(claim_id, 1);
    assert_eq!(client.claim_count(), 1);

    let claim = client.get_claim(&1);
    assert_eq!(claim.claimant, claimant);
    assert_eq!(claim.amount, 50_000_000);
    assert_eq!(claim.status, ClaimStatus::Pending);

    client.approve_claim(&admin, &1);
    let approved = client.get_claim(&1);
    assert_eq!(approved.status, ClaimStatus::Approved);
}

#[test]
fn mark_paid_and_cancel_flow() {
    let (env, admin, _gov, client) = setup();
    let claimant = Address::generate(&env);

    client.submit_claim(
        &claimant,
        &10_000_000i128,
        &sample_receipt(&env, 2),
        &Symbol::new(&env, "FR"),
    );

    let payout_ref = sample_receipt(&env, 99);
    client.mark_paid(&admin, &1, &payout_ref);

    let paid = client.get_claim(&1);
    assert_eq!(paid.status, ClaimStatus::Paid);
    assert_eq!(paid.payout_ref, payout_ref);

    let claimant2 = Address::generate(&env);
    client.submit_claim(
        &claimant2,
        &5_000_000i128,
        &sample_receipt(&env, 3),
        &Symbol::new(&env, "DE"),
    );
    client.cancel_claim(&admin, &2);
    assert_eq!(client.get_claim(&2).status, ClaimStatus::Cancelled);
}

#[test]
fn blacklist_blocks_future_claims() {
    let (env, admin, _gov, client) = setup();
    let claimant = Address::generate(&env);

    client.submit_claim(
        &claimant,
        &1_000_000i128,
        &sample_receipt(&env, 4),
        &Symbol::new(&env, "IT"),
    );

    client.blacklist_claim(&admin, &1);
    assert!(client.is_wallet_blacklisted(&claimant));
    assert_eq!(client.get_claim(&1).status, ClaimStatus::Blacklisted);

    let result = client.try_submit_claim(
        &claimant,
        &2_000_000i128,
        &sample_receipt(&env, 5),
        &Symbol::new(&env, "IT"),
    );
    assert_eq!(result, Err(Ok(Error::WalletBlacklisted)));
}

#[test]
fn rejects_non_positive_amount() {
    let (env, _admin, _gov, client) = setup();
    let claimant = Address::generate(&env);

    let result = client.try_submit_claim(
        &claimant,
        &0i128,
        &sample_receipt(&env, 6),
        &Symbol::new(&env, "ES"),
    );
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn government_submission_approval_and_reimbursement_flow() {
    let (env, admin, gov, client) = setup();
    let claimant = Address::generate(&env);

    // Tourist claim
    client.submit_claim(
        &claimant,
        &50_000_000i128,
        &sample_receipt(&env, 1),
        &Symbol::new(&env, "AE"),
    );

    // Admin approves for payout
    client.approve_claim(&admin, &1);

    // Admin marks as paid (tourist leg fulfilled)
    let payout_ref = sample_receipt(&env, 99);
    client.mark_paid(&admin, &1, &payout_ref);

    // Admin submits verified package to government
    let submission_ref = sample_receipt(&env, 10);
    client.submit_to_government(&admin, &1, &submission_ref);

    let submitted = client.get_claim(&1);
    assert_eq!(submitted.status, ClaimStatus::GovernmentSubmitted);
    assert_eq!(submitted.government_submission_ref, submission_ref);

    // Government approves
    let decision_ref = sample_receipt(&env, 11);
    client.government_approve(&gov, &1, &decision_ref);
    assert_eq!(client.get_claim(&1).status, ClaimStatus::GovernmentApproved);

    // Government marks reimbursement back to treasury
    let reimbursement_ref = sample_receipt(&env, 12);
    client.mark_treasury_reimbursed(&gov, &1, &reimbursement_ref);

    let reimbursed = client.get_claim(&1);
    assert_eq!(reimbursed.status, ClaimStatus::TreasuryReimbursed);
    assert_eq!(reimbursed.treasury_reimbursement_ref, reimbursement_ref);
    assert_eq!(reimbursed.government_decision_ref, decision_ref);
}

#[test]
fn government_reject_flow_sets_rejected_state() {
    let (env, admin, gov, client) = setup();
    let claimant = Address::generate(&env);

    client.submit_claim(
        &claimant,
        &10_000_000i128,
        &sample_receipt(&env, 2),
        &Symbol::new(&env, "FR"),
    );
    client.approve_claim(&admin, &1);
    client.mark_paid(&admin, &1, &sample_receipt(&env, 42));

    client.submit_to_government(&admin, &1, &sample_receipt(&env, 20));
    assert_eq!(client.get_claim(&1).status, ClaimStatus::GovernmentSubmitted);

    client.government_reject(&gov, &1, &sample_receipt(&env, 21));
    assert_eq!(client.get_claim(&1).status, ClaimStatus::GovernmentRejected);
}
