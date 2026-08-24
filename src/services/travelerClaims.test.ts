import { describe, expect, it } from 'vitest';
import type { Payment } from '../lib/supabase';
import { collapseDuplicateClaims, mergeTravelerPayments } from './travelerClaims';

const WALLET = 'GDHAGXZUWGJR6AQW25IU74J5JSU5HAKUMUY3SY4JNMJXNXEJCZM7WOAW';

const local: Payment = {
  id: 'same',
  employee_id: 'vat-refund',
  user_id: WALLET,
  amount: 10,
  token: 'XLM',
  status: 'pending',
  payment_date: '2026-08-01T00:00:00Z',
  created_at: '2026-08-01T00:00:00Z',
  blockchain_type: 'stellar',
  network: 'mainnet',
};

const remote: Payment = {
  ...local,
  status: 'completed',
  transaction_hash: 'tx-1',
  vat_refund_details: { receiptNo: 'R-9', claimCountryName: 'France' },
};

describe('mergeTravelerPayments', () => {
  it('prefers remote details and payout fields while keeping local rows', () => {
    const extraLocal: Payment = { ...local, id: 'local-only', user_id: WALLET };
    const merged = mergeTravelerPayments([local, extraLocal], [remote]);
    expect(merged).toHaveLength(2);
    const updated = merged.find((p) => p.id === 'same');
    expect(updated?.status).toBe('completed');
    expect(updated?.transaction_hash).toBe('tx-1');
    expect(updated?.vat_refund_details?.receiptNo).toBe('R-9');
  });

  it('drops a pending twin when a completed claim shares receipt and amount', () => {
    const pendingTwin: Payment = {
      ...remote,
      id: 'pending-twin',
      status: 'pending',
      transaction_hash: undefined,
      created_at: '2026-08-01T00:00:08Z',
    };
    const collapsed = collapseDuplicateClaims([remote, pendingTwin]);
    expect(collapsed.map((p) => p.id)).toEqual(['same']);
  });
});
