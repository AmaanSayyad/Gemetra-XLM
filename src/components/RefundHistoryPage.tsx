import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  FileSearch,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { usePayments } from '../hooks/usePayments';
import { usePoints } from '../hooks/usePoints';
import { useStellarWallet } from '../utils/stellar-wallet';
import { calculateVatClaimPoints, pointsForRefundTx } from '../utils/travelerPoints';
import { getStellarExpertTxUrl } from '../utils/stellar';
import { formatStellarAddress } from '../config/treasury';
import { getCurrentNetwork } from '../config/stellar';
import { countryFlag, GemetraButton, GemetraTimeline } from '../gemetra-ui';
import { fetchTravelerVatClaims, mergeTravelerPayments } from '../services/travelerClaims';
import { fetchTravelerBlacklistIssues, type ClaimBlacklistEntry } from '../services/claimBlacklist';
import type { Payment } from '../lib/supabase';
import {
  buildClaimTimeline,
  computeTravelerTrust,
  formatVerificationStatus,
  formatVerificationTier,
  type TrustBand,
} from '../utils/travelerTrust';

interface RefundHistoryPageProps {
  onBack: () => void;
  onSubmitRefund: () => void;
  refreshKey?: number;
}

type StatusFilter = 'all' | Payment['status'];

const STATUS_BADGE: Record<
  Payment['status'],
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  completed: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: XCircle,
  },
  blacklisted: {
    label: 'Blocked',
    className: 'bg-red-100 text-red-900 border-red-300',
    icon: Ban,
  },
};

const TRUST_TONE: Record<TrustBand, { ring: string; chip: string }> = {
  excellent: { ring: '#059669', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  good: { ring: '#2563eb', chip: 'bg-blue-50 text-blue-800 border-blue-200' },
  fair: { ring: '#d97706', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  at_risk: { ring: '#ea580c', chip: 'bg-orange-50 text-orange-800 border-orange-200' },
  blocked: { ring: '#dc2626', chip: 'bg-red-50 text-red-800 border-red-200' },
  unverified: { ring: '#94a3b8', chip: 'bg-slate-50 text-slate-700 border-slate-200' },
};

function StatusBadge({ status }: { status: Payment['status'] }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function shortHash(hash: string): string {
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

export const RefundHistoryPage: React.FC<RefundHistoryPageProps> = ({
  onBack,
  onSubmitRefund,
  refreshKey = 0,
}) => {
  const { getAllPayments } = usePayments();
  const { userPoints, transactions, syncVatRefundPoints } = usePoints();
  const { walletState } = useStellarWallet();
  const wallet = walletState.publicKey;

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<Payment[]>([]);
  const [blacklistIssues, setBlacklistIssues] = useState<ClaimBlacklistEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [local, remote] = await Promise.all([
          getAllPayments(),
          wallet ? fetchTravelerVatClaims(wallet) : Promise.resolve([]),
        ]);
        const merged = mergeTravelerPayments(local, remote);
        if (cancelled) return;
        setClaims(merged);

        const passports = merged
          .map((c) => c.vat_refund_details?.passportNo)
          .filter((p): p is string => Boolean(p));
        const issues = wallet ? await fetchTravelerBlacklistIssues(wallet, passports) : [];
        if (!cancelled) setBlacklistIssues(issues);

        await syncVatRefundPoints(merged.filter((p) => p.status === 'completed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAllPayments, syncVatRefundPoints, refreshKey, wallet]);

  const trust = useMemo(
    () =>
      computeTravelerTrust({
        claims,
        blacklist: blacklistIssues[0]
          ? {
              id: blacklistIssues[0].id,
              reason: blacklistIssues[0].reason,
              created_at: blacklistIssues[0].created_at,
              wallet_address: blacklistIssues[0].wallet_address,
              passport_no: blacklistIssues[0].passport_no,
            }
          : null,
      }),
    [claims, blacklistIssues]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claims.filter((claim) => {
      if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
      if (!q) return true;
      const d = claim.vat_refund_details;
      return (
        claim.id.toLowerCase().includes(q) ||
        claim.transaction_hash?.toLowerCase().includes(q) ||
        claim.status.toLowerCase().includes(q) ||
        d?.receiptNo?.toLowerCase().includes(q) ||
        d?.claimCountryName?.toLowerCase().includes(q) ||
        d?.merchantName?.toLowerCase().includes(q) ||
        d?.passportNo?.toLowerCase().includes(q)
      );
    });
  }, [claims, query, statusFilter]);

  const stats = useMemo(
    () => ({
      total: claims.length,
      paid: claims.filter((c) => c.status === 'completed').length,
      pending: claims.filter((c) => c.status === 'pending').length,
      paidXlm: claims.filter((c) => c.status === 'completed').reduce((sum, c) => sum + c.amount, 0),
    }),
    [claims]
  );

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  const totalEarnedPoints = transactions
    .filter((t) => t.transaction_type === 'earned' && t.source === 'vat_refund')
    .reduce((sum, t) => sum + t.points, 0);

  const tone = TRUST_TONE[trust.band];

  if (!walletState.isConnected || !wallet) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Overview
        </button>
        <div className="stat-card mx-auto max-w-lg py-16 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[var(--gem-text-muted)]/40" />
          <h1 className="text-2xl font-semibold text-[var(--gem-text)]">Connect to see your claims</h1>
          <p className="mt-2 text-sm text-[var(--gem-text-muted)]">
            Your claim history, payout proofs, and traveler trust profile are tied to your Stellar wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </button>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--gem-text)]">My claims</h1>
          <p className="mt-2 max-w-2xl text-[var(--gem-text-muted)]">
            Track every VAT refund, verify payouts on Stellar, and see how passport quality affects your traveler trust score.
          </p>
        </div>
        <GemetraButton onClick={onSubmitRefund}>New claim</GemetraButton>
      </div>

      {trust.isBlacklisted && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
          <Ban className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">This wallet cannot submit new claims</p>
            <p className="mt-1 text-red-800/80">
              {trust.blacklistReason || 'Your wallet or passport is on the Gemetra blocklist.'} Contact support if this is a mistake.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className="stat-card">
          <div className="flex items-start gap-5">
            <div
              className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${tone.ring} ${trust.score * 3.6}deg, #e5e7eb 0deg)`,
              }}
              aria-label={`Trust score ${trust.score} out of 100`}
            >
              <div className="flex h-[4.6rem] w-[4.6rem] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-xl font-bold text-[var(--gem-text)]">{trust.score}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gem-text-muted)]">trust</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">Traveler trust</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-[var(--gem-text)]">{trust.label}</h2>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.chip}`}>{trust.band.replace('_', ' ')}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--gem-text-muted)]">{trust.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--gem-text-muted)]">Passport quality</dt>
                  <dd className="font-semibold text-[var(--gem-text)]">
                    {trust.avgPassportTrust != null ? `${trust.avgPassportTrust}%` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--gem-text-muted)]">Latest check</dt>
                  <dd className="font-semibold capitalize text-[var(--gem-text)]">
                    {formatVerificationStatus(trust.latestVerificationStatus ?? undefined)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--gem-text-muted)]">Method</dt>
                  <dd className="font-semibold text-[var(--gem-text)]">
                    {formatVerificationTier(trust.latestVerificationTier ?? undefined)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="stat-card !p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">Claims</p>
            <p className="mt-1 text-2xl font-bold text-[var(--gem-text)]">{stats.total}</p>
          </div>
          <div className="stat-card !p-4 border-emerald-200/60 bg-emerald-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Paid</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.paidXlm.toFixed(2)} XLM</p>
            <p className="text-xs text-emerald-700/80">{stats.paid} payouts</p>
          </div>
          <div className="stat-card !p-4 border-amber-200/60 bg-amber-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{stats.pending}</p>
          </div>
          <div className="stat-card !p-4 border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)]">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--gem-brand)]">
              <Sparkles className="h-3 w-3" />
              Points
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--gem-brand)]">
              {(userPoints?.lifetime_points ?? totalEarnedPoints).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {blacklistIssues.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--gem-text)]">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Blocklist issues
          </h3>
          <div className="space-y-2">
            {blacklistIssues.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm">
                <p className="font-semibold text-red-900">{issue.reason}</p>
                <p className="mt-1 text-xs text-[var(--gem-text-muted)]">
                  {new Date(issue.created_at).toLocaleString()}
                  {issue.passport_no ? ` · Passport ${issue.passport_no}` : ''}
                  {issue.wallet_address ? ` · ${formatStellarAddress(issue.wallet_address)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="gem-search-pill flex w-full max-w-md">
          <Search className="h-4 w-4 shrink-0 text-[var(--gem-text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipt, country, merchant, or tx"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All', stats.total],
              ['pending', 'Pending', stats.pending],
              ['completed', 'Paid', stats.paid],
              ['cancelled', 'Cancelled', claims.filter((c) => c.status === 'cancelled').length],
              ['blacklisted', 'Blocked', claims.filter((c) => c.status === 'blacklisted').length],
              ['failed', 'Failed', claims.filter((c) => c.status === 'failed').length],
            ] as Array<[StatusFilter, string, number]>
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === id
                  ? 'border-[var(--gem-ink)] bg-[var(--gem-ink)] text-white'
                  : 'border-[var(--gem-border)] bg-white text-[var(--gem-text-muted)] hover:border-[var(--gem-text)]'
              }`}
            >
              {label} {count}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--gem-border)] border-t-[var(--gem-brand)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="stat-card py-16 text-center">
          <Receipt className="mx-auto mb-4 h-12 w-12 text-[var(--gem-text-muted)]/40" />
          <h3 className="text-lg font-semibold text-[var(--gem-text)]">
            {claims.length === 0 ? 'No claims yet' : 'No matching claims'}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--gem-text-muted)]">
            {claims.length === 0
              ? 'Submit your first tax-free receipt to receive XLM and start a traveler trust profile.'
              : 'Try another filter or search term.'}
          </p>
          {claims.length === 0 && (
            <GemetraButton className="mt-6" onClick={onSubmitRefund}>
              Submit refund
            </GemetraButton>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => {
            const details = claim.vat_refund_details;
            const pv = details?.passportVerification;
            const open = selectedId === claim.id;
            const earned =
              pointsForRefundTx(transactions, claim.transaction_hash) ??
              (claim.status === 'completed' ? calculateVatClaimPoints(claim.amount) : null);
            const explorer =
              claim.transaction_hash &&
              getStellarExpertTxUrl(
                claim.transaction_hash,
                claim.network === 'testnet' ? 'testnet' : getCurrentNetwork() === 'testnet' ? 'testnet' : 'mainnet'
              );

            return (
              <article key={claim.id} className="stat-card overflow-hidden !p-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(open ? null : claim.id)}
                  className="flex w-full flex-col gap-4 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
                  aria-expanded={open}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--gem-surface-muted)]">
                      {details?.claimCountryCode ? (
                        <img src={countryFlag(details.claimCountryCode)} alt="" className="h-11 w-11 object-cover" />
                      ) : (
                        <Receipt className="h-5 w-5 text-[var(--gem-brand)]" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--gem-text)]">
                        {details?.claimCountryName || 'VAT refund'} · {claim.amount.toFixed(4)} {claim.token || 'XLM'}
                      </p>
                      <p className="text-xs text-[var(--gem-text-muted)]">
                        {new Date(claim.created_at).toLocaleString()}
                        {details?.receiptNo ? ` · Receipt ${details.receiptNo}` : ''}
                        {details?.merchantName ? ` · ${details.merchantName}` : ''}
                      </p>
                      {earned != null && claim.status === 'completed' && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--gem-brand)]">
                          <Sparkles className="h-3 w-3" />
                          +{earned} points earned
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <StatusBadge status={claim.status} />
                    {pv?.trustScore != null && (
                      <span className="rounded-full border border-[var(--gem-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--gem-text-muted)]">
                        Trust {pv.trustScore}%
                      </span>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="grid gap-6 border-t border-[var(--gem-border)] bg-[var(--gem-surface-muted)]/40 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div>
                      <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">
                        Status timeline
                      </h4>
                      <GemetraTimeline steps={buildClaimTimeline(claim)} />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[var(--gem-border)] bg-white p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">
                          <FileSearch className="h-3.5 w-3.5" />
                          Payout proof
                        </h4>
                        {claim.transaction_hash ? (
                          <div className="space-y-3 text-sm">
                            <p className="font-semibold text-[var(--gem-text)]">
                              {claim.amount.toFixed(4)} XLM sent to{' '}
                              {formatStellarAddress(details?.receiverWalletAddress || claim.user_id)}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <code className="rounded-lg bg-[var(--gem-surface-muted)] px-2 py-1 text-xs">
                                {shortHash(claim.transaction_hash)}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyValue(claim.transaction_hash!)}
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--gem-border)] px-2.5 py-1 text-xs font-medium text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
                              >
                                <Copy className="h-3 w-3" />
                                {copied === claim.transaction_hash ? 'Copied' : 'Copy'}
                              </button>
                              {explorer && (
                                <a
                                  href={explorer}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--gem-border)] px-2.5 py-1 text-xs font-medium text-[var(--gem-brand)] hover:underline"
                                >
                                  Stellar Expert
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-[var(--gem-text-muted)]">
                              Paid {new Date(claim.payment_date || claim.created_at).toLocaleString()}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--gem-text-muted)]">
                            {claim.status === 'pending'
                              ? 'No on-chain payout yet. Gemetra treasury pays this claim after review.'
                              : 'This claim does not have a Stellar transaction hash.'}
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[var(--gem-border)] bg-white p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verification quality
                        </h4>
                        {pv ? (
                          <dl className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <dt className="text-xs text-[var(--gem-text-muted)]">Status</dt>
                              <dd className="font-medium capitalize">{formatVerificationStatus(pv.status)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-[var(--gem-text-muted)]">Trust</dt>
                              <dd className="font-medium">{pv.trustScore != null ? `${pv.trustScore}%` : '—'}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-[var(--gem-text-muted)]">Method</dt>
                              <dd className="font-medium">{formatVerificationTier(pv.tier)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-[var(--gem-text-muted)]">MRZ</dt>
                              <dd className="font-medium">{pv.mrzValid ? 'Valid' : 'Not validated'}</dd>
                            </div>
                          </dl>
                        ) : (
                          <p className="text-sm text-[var(--gem-text-muted)]">
                            Passport verification was skipped or not stored for this claim.
                          </p>
                        )}
                      </div>

                      {(claim.status === 'blacklisted' || details?.adminAction) && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                          <p className="font-semibold">
                            {details?.adminAction?.type === 'cancelled' ? 'Cancelled by operations' : 'Blocklist / admin action'}
                          </p>
                          <p className="mt-1 text-red-800/80">
                            {details?.adminAction?.reason || 'This claim was flagged by Gemetra operations.'}
                          </p>
                          {details?.adminAction?.at && (
                            <p className="mt-1 text-xs text-red-700/70">
                              {new Date(details.adminAction.at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
