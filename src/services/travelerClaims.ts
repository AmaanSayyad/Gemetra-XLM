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

  return filterLegitimateXlmVatRefunds([...byId.values()]).sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
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
