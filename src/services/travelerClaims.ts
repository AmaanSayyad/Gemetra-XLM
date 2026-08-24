import { supabase } from '../lib/supabase';
import type { Payment } from '../lib/supabase';
import { filterLegitimateXlmVatRefunds } from '../utils/vatRefundPayments';

function asPayment(row: Record<string, unknown>): Payment {
  const network = row.network === 'testnet' ? 'testnet' : 'mainnet';
  return {
    id: String(row.id),
    employee_id: String(row.employee_id ?? 'vat-refund'),
    user_id: String(row.user_id ?? ''),
    amount: Number(row.amount) || 0,
    token: String(row.token || 'XLM'),
    transaction_hash: (row.transaction_hash as string | null) ?? undefined,
    status: (row.status as Payment['status']) || 'pending',
    payment_date: String(row.payment_date ?? row.created_at ?? ''),
    created_at: String(row.created_at ?? ''),
    vat_refund_details: (row.vat_refund_details as Payment['vat_refund_details']) ?? undefined,
    blockchain_type: 'stellar',
    network,
    memo: (row.stellar_memo as string | null) ?? (row.memo as string | undefined),
    ledger: typeof row.ledger === 'number' ? row.ledger : undefined,
  };
}

export function mergeTravelerPayments(local: Payment[], remote: Payment[]): Payment[] {
  const byId = new Map<string, Payment>();
  for (const payment of local) byId.set(payment.id, payment);
  for (const payment of remote) {
    const existing = byId.get(payment.id);
    if (!existing) {
      byId.set(payment.id, payment);
      continue;
    }
    byId.set(payment.id, {
      ...existing,
      ...payment,
      vat_refund_details: payment.vat_refund_details ?? existing.vat_refund_details,
      transaction_hash: payment.transaction_hash ?? existing.transaction_hash,
    });
  }

  return collapseDuplicateClaims(
    filterLegitimateXlmVatRefunds([...byId.values()]).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
  );
}

function claimFingerprint(payment: Payment): string {
  const receipt = (payment.vat_refund_details?.receiptNo ?? '').trim().toUpperCase();
  const amount = Number(payment.amount).toFixed(4);
  return `${payment.user_id}|${amount}|${receipt}`;
}

/**
 * Drop pending leftovers created by the stale-state double insert
 * (pending row + a second completed row a few seconds later).
 */
export function collapseDuplicateClaims(payments: Payment[]): Payment[] {
  const groups = new Map<string, Payment[]>();
  for (const payment of payments) {
    const key = claimFingerprint(payment);
    const list = groups.get(key) ?? [];
    list.push(payment);
    groups.set(key, list);
  }

  const drop = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const completed = group.filter((p) => p.status === 'completed');
    if (completed.length > 0) {
      for (const payment of group) {
        if (payment.status === 'pending' || payment.status === 'failed' || payment.status === 'cancelled') {
          drop.add(payment.id);
        }
      }
    } else {
      const pending = group
        .filter((p) => p.status === 'pending')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      for (const extra of pending.slice(1)) drop.add(extra.id);
    }
  }

  return payments.filter((payment) => !drop.has(payment.id));
}

export async function fetchTravelerVatClaims(wallet: string): Promise<Payment[]> {
  if (!wallet) return [];

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('employee_id', 'vat-refund')
    .eq('user_id', wallet)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch traveler VAT claims:', error);
    return [];
  }

  return filterLegitimateXlmVatRefunds((data || []).map((row) => asPayment(row as Record<string, unknown>)));
}
