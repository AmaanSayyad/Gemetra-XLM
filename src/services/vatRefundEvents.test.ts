import { describe, expect, it } from 'vitest';
import { CLAIM_STATUS_LABELS, parseVatRefundEvent } from './vatRefundEvents';

describe('vatRefundEvents', () => {
  it('maps claim status codes to labels', () => {
    expect(CLAIM_STATUS_LABELS[0]).toBe('Pending');
    expect(CLAIM_STATUS_LABELS[2]).toBe('Paid');
    expect(CLAIM_STATUS_LABELS[8]).toBe('Blacklisted');
  });

  it('parses a ClaimSubmitted-style event', () => {
    const ev = parseVatRefundEvent({
      id: '0001',
      ledger: 12,
      txHash: 'abc',
      contractId: 'CABC',
      topic: ['claim_submitted', 3],
      value: { amount: 100 },
    });
    expect(ev?.name).toBe('claim_submitted');
    expect(ev?.claimId).toBe(3);
    expect(ev?.txHash).toBe('abc');
  });

  it('parses status from the event value', () => {
    const ev = parseVatRefundEvent({
      id: '0002',
      ledger: 13,
      topic: ['claim_status_changed'],
      value: { claim_id: 4, status: 2 },
    });
    expect(ev?.claimId).toBe(4);
    expect(ev?.statusLabel).toBe('Paid');
  });

  it('returns null when the payload has no id or ledger', () => {
    expect(parseVatRefundEvent({ topic: ['claim_submitted'] })).toBeNull();
  });
});
