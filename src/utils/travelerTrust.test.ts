import { describe, expect, it } from 'vitest';
import type { Payment } from '../lib/supabase';
import {
  buildClaimTimeline,
  computeTravelerTrust,
  trustBandForScore,
} from './travelerTrust';

function claim(partial: Partial<Payment> & Pick<Payment, 'id' | 'status'>): Payment {
  return {
    employee_id: 'vat-refund',
    user_id: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV',
    amount: 12.5,
    token: 'XLM',
    payment_date: '2026-08-01T10:00:00Z',
    created_at: '2026-08-01T09:00:00Z',
    blockchain_type: 'stellar',
    network: 'mainnet',
    ...partial,
  };
}

describe('trustBandForScore', () => {
  it('marks blacklisted travelers as blocked regardless of score', () => {
    expect(trustBandForScore(95, true, true)).toBe('blocked');
  });

  it('uses verification bands when passport data exists', () => {
    expect(trustBandForScore(85, false, true)).toBe('excellent');
    expect(trustBandForScore(62, false, true)).toBe('good');
    expect(trustBandForScore(40, false, true)).toBe('fair');
    expect(trustBandForScore(20, false, true)).toBe('at_risk');
  });
});

describe('computeTravelerTrust', () => {
  it('returns unverified for an empty history', () => {
    const profile = computeTravelerTrust({ claims: [] });
    expect(profile.score).toBe(0);
    expect(profile.band).toBe('unverified');
    expect(profile.isBlacklisted).toBe(false);
  });

  it('rewards completed verified claims', () => {
    const profile = computeTravelerTrust({
      claims: [
        claim({
          id: '1',
          status: 'completed',
          transaction_hash: 'abc',
          vat_refund_details: {
            passportVerification: {
              status: 'verified',
              trustScore: 90,
              tier: 'client_gemini',
              mrzValid: true,
            },
          },
        }),
      ],
    });
    expect(profile.score).toBeGreaterThanOrEqual(70);
    expect(profile.verifiedClaimCount).toBe(1);
    expect(profile.band).toBe('excellent');
    expect(profile.isBlacklisted).toBe(false);
  });

  it('caps score when the wallet is blocklisted', () => {
    const profile = computeTravelerTrust({
      claims: [
        claim({
          id: '1',
          status: 'blacklisted',
          vat_refund_details: {
            adminAction: { type: 'blacklisted', reason: 'Duplicate receipt', by: 'admin', at: '2026-08-02T00:00:00Z' },
          },
        }),
      ],
      blacklist: { id: 'bl-1', reason: 'Duplicate receipt', created_at: '2026-08-02T00:00:00Z' },
    });
    expect(profile.isBlacklisted).toBe(true);
    expect(profile.band).toBe('blocked');
    expect(profile.score).toBeLessThanOrEqual(18);
    expect(profile.blacklistReason).toBe('Duplicate receipt');
  });
});

describe('buildClaimTimeline', () => {
  it('marks payout complete when the claim is paid', () => {
    const steps = buildClaimTimeline(
      claim({
        id: 'paid',
        status: 'completed',
        transaction_hash: 'hash',
        vat_refund_details: {
          receiptNo: 'R-1',
          claimCountryName: 'France',
          passportVerification: { status: 'verified', trustScore: 88, mrzValid: true, tier: 'client_mrz' },
        },
      })
    );
    expect(steps[0].status).toBe('completed');
    expect(steps.find((s) => s.id === 'payout')?.status).toBe('completed');
    expect(steps.find((s) => s.id === 'payout')?.title).toMatch(/Paid/i);
  });

  it('includes on-chain registry when a contract claim id exists', () => {
    const steps = buildClaimTimeline(
      claim({
        id: 'onchain',
        status: 'pending',
        vat_refund_details: { contractClaimId: 42 },
      })
    );
    expect(steps.some((s) => s.id === 'onchain' && s.description?.includes('#42'))).toBe(true);
  });
});
