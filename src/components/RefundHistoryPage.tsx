import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, ExternalLink, Receipt, Search, Sparkles } from 'lucide-react';
import { usePayments } from '../hooks/usePayments';
import { usePoints } from '../hooks/usePoints';
import { calculateVatClaimPoints, pointsForRefundTx } from '../utils/travelerPoints';
import { filterLegitimateXlmVatRefunds } from '../utils/vatRefundPayments';
import { GemetraButton } from '../gemetra-ui';

interface RefundHistoryPageProps {
  onBack: () => void;
  onSubmitRefund: () => void;
  refreshKey?: number;
}

export const RefundHistoryPage: React.FC<RefundHistoryPageProps> = ({
  onBack,
  onSubmitRefund,
  refreshKey = 0,
}) => {
  const { getAllPayments } = usePayments();
  const { userPoints, transactions, syncVatRefundPoints } = usePoints();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<
    {
      id: string;
      date: string;
      amount: number;
      status: string;
      token: string;
      transaction_hash?: string;
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = filterLegitimateXlmVatRefunds(await getAllPayments());
        const vat = all
          .map((p) => ({
            id: p.id,
            date: p.created_at,
            amount: p.amount,
            status: p.status,
            token: p.token || 'XLM',
            transaction_hash: p.transaction_hash,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (!cancelled) setRefunds(vat);
        await syncVatRefundPoints(all.filter((p) => p.status === 'completed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAllPayments, syncVatRefundPoints, refreshKey]);

  const filtered = useMemo(() => {
    if (!query.trim()) return refunds;
    const q = query.toLowerCase();
    return refunds.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.transaction_hash?.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [refunds, query]);

  const totalEarnedPoints = transactions
    .filter((t) => t.transaction_type === 'earned' && t.source === 'vat_refund')
    .reduce((sum, t) => sum + t.points, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--gem-text)]">My refunds</h1>
        <p className="mt-2 text-[var(--gem-text-muted)]">
          Every completed VAT claim earns Gemetra Points you can redeem for bonus XLM.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--gem-text-muted)]">Claims</p>
          <p className="mt-1 text-2xl font-bold text-[var(--gem-text)]">{refunds.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--gem-text-muted)]">Completed</p>
          <p className="mt-1 text-2xl font-bold text-[var(--gem-text)]">
            {refunds.filter((r) => r.status === 'completed').length}
          </p>
        </div>
        <div className="stat-card border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)]">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--gem-brand)]">
            <Sparkles className="h-3 w-3" />
            Points from claims
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--gem-brand)]">
            {(userPoints?.lifetime_points ?? totalEarnedPoints).toLocaleString()}
          </p>
        </div>
      </div>

      <label className="gem-search-pill mb-6 flex w-full max-w-md">
        <Search className="h-4 w-4 shrink-0 text-[var(--gem-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ID or transaction"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--gem-border)] border-t-[var(--gem-brand)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <Receipt className="mx-auto mb-4 h-12 w-12 text-[var(--gem-text-muted)]/40" />
          <h3 className="text-lg font-semibold text-[var(--gem-text)]">No refunds yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--gem-text-muted)]">
            Submit your first tax-free receipt to receive XLM and earn traveler points.
          </p>
          <GemetraButton className="mt-6" onClick={onSubmitRefund}>
            Submit refund
          </GemetraButton>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((refund) => {
            const earned =
              pointsForRefundTx(transactions, refund.transaction_hash) ??
              (refund.status === 'completed' ? calculateVatClaimPoints(refund.amount) : null);

            return (
              <div
                key={refund.id}
                className="stat-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--gem-surface-muted)]">
                    <Receipt className="h-5 w-5 text-[var(--gem-brand)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--gem-text)]">
                      VAT refund · {refund.amount.toFixed(4)} {refund.token}
                    </p>
                    <p className="text-xs text-[var(--gem-text-muted)]">
                      {new Date(refund.date).toLocaleString()}
                    </p>
                    {earned != null && refund.status === 'completed' && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--gem-brand)]">
                        <Sparkles className="h-3 w-3" />
                        +{earned} points earned
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {refund.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  )}
                  {refund.transaction_hash && (
                    <a
                      href={`https://stellar.expert/explorer/public/tx/${refund.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--gem-border)] px-3 py-1 text-xs font-mono text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
                    >
                      Tx
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
