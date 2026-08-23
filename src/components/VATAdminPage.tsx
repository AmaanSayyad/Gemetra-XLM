import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, Clock, AlertCircle, Search, Download, ExternalLink, FileText, User, Calendar, Ban, XCircle, RefreshCw, Wallet, Filter, Store, CreditCard } from 'lucide-react';
import { useStellarWallet } from '../utils/stellar-wallet';
import type { Payment } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { getStellarExpertTxUrl } from '../utils/stellar';
import { ADMIN_PUBLIC_KEY, TREASURY_PUBLIC_KEY, formatStellarAddress, isAdminAddress } from '../config/treasury';
import { requestTreasuryPayout } from '../services/treasuryPayout';
import { filterLegitimateXlmVatRefunds } from '../utils/vatRefundPayments';
import {
  addToClaimBlacklist,
  fetchClaimBlacklist,
  removeFromClaimBlacklist,
  type ClaimBlacklistEntry,
} from '../services/claimBlacklist';

interface VATRefundAdmin {
  id: string;
  user_id: string;
  amount: number;
  token: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'blacklisted';
  transaction_hash?: string;
  payment_date: string;
  created_at: string;
  vat_refund_details?: {
    claimCountryCode?: string;
    claimCountryName?: string;
    vatRegNo?: string;
    receiptNo?: string;
    billAmount?: string;
    vatAmount?: string;
    passportNo?: string;
    flightNo?: string;
    nationality?: string;
    dob?: string;
    purchaseDate?: string;
    merchantName?: string;
    merchantAddress?: string;
    receiverWalletAddress?: string;
    passportVerification?: {
      status?: string;
      trustScore?: number;
      tier?: string;
      verifiedAt?: string;
      mrzValid?: boolean;
    };
    adminAction?: {
      type: 'cancelled' | 'blacklisted';
      reason?: string;
      by: string;
      at: string;
    };
  };
}

const STATUS_BADGE: Record<
  VATRefundAdmin['status'],
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  completed: {
    label: 'Completed',
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
    icon: AlertCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: XCircle,
  },
  blacklisted: {
    label: 'Blacklisted',
    className: 'bg-red-100 text-red-900 border-red-300',
    icon: Ban,
  },
};

function StatusBadge({ status }: { status: VATRefundAdmin['status'] }) {
  const cfg = STATUS_BADGE[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

export const VATAdminPage: React.FC = () => {
  const { walletState } = useStellarWallet();
  const address = walletState.publicKey;
  const isConnected = walletState.isConnected;
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refunds, setRefunds] = useState<VATRefundAdmin[]>([]);
  const [filteredRefunds, setFilteredRefunds] = useState<VATRefundAdmin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed' | 'cancelled' | 'blacklisted'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [stats, setStats] = useState({
    totalRefunds: 0,
    totalAmount: 0,
    completedRefunds: 0,
    pendingRefunds: 0,
    failedRefunds: 0,
    cancelledRefunds: 0,
    blacklistedRefunds: 0,
  });
  const [selectedRefund, setSelectedRefund] = useState<VATRefundAdmin | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [payingRefundId, setPayingRefundId] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [adminActionReason, setAdminActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<'cancel' | 'blacklist' | null>(null);
  const [blacklistEntries, setBlacklistEntries] = useState<ClaimBlacklistEntry[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check authorization
  useEffect(() => {
    if (isConnected && address) {
      setIsAuthorized(isAdminAddress(address));
    } else {
      setIsAuthorized(false);
    }
    setIsLoading(false);
  }, [address, isConnected]);

  // Fetch all VAT refunds from all users
  useEffect(() => {
    const fetchAllVATRefunds = async () => {
      if (!isAuthorized) return;

      try {
        setIsLoading(true);
        console.log('🔍 Fetching VAT refunds from Supabase...');
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('employee_id', 'vat-refund')
          .eq('token', 'XLM')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching VAT refunds:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          return;
        }

        const legitimate = filterLegitimateXlmVatRefunds(data || []);

        console.log(`✅ Found ${legitimate.length} XLM VAT refund records (${(data?.length || 0) - legitimate.length} legacy rows ignored)`);
        if (legitimate.length > 0) {
          console.log('Sample records:', legitimate.slice(0, 3));
        }

        const vatRefunds: VATRefundAdmin[] = legitimate.map((payment: Payment) => ({
          id: payment.id,
          user_id: payment.user_id,
          amount: payment.amount,
          token: payment.token || 'XLM',
          status: payment.status,
          transaction_hash: payment.transaction_hash,
          payment_date: payment.payment_date,
          created_at: payment.created_at,
          vat_refund_details: payment.vat_refund_details,
        }));

        setRefunds(vatRefunds);
        setFilteredRefunds(vatRefunds);

        // Calculate stats
        const totalAmount = vatRefunds.reduce((sum, r) => sum + r.amount, 0);
        const completedRefunds = vatRefunds.filter(r => r.status === 'completed').length;
        const pendingRefunds = vatRefunds.filter(r => r.status === 'pending').length;
        const failedRefunds = vatRefunds.filter(r => r.status === 'failed').length;
        const cancelledRefunds = vatRefunds.filter(r => r.status === 'cancelled').length;
        const blacklistedRefunds = vatRefunds.filter(r => r.status === 'blacklisted').length;

        setStats({
          totalRefunds: vatRefunds.length,
          totalAmount,
          completedRefunds,
          pendingRefunds,
          failedRefunds,
          cancelledRefunds,
          blacklistedRefunds,
        });
      } catch (error) {
        console.error('Failed to fetch VAT refunds:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllVATRefunds();
    
    // Refresh every 5 seconds to catch new refunds
    const interval = setInterval(() => {
      if (isAuthorized) {
        fetchAllVATRefunds();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthorized, refreshKey]);

  useEffect(() => {
    if (!isAuthorized) return;
    setBlacklistLoading(true);
    fetchClaimBlacklist()
      .then(setBlacklistEntries)
      .finally(() => setBlacklistLoading(false));
  }, [isAuthorized]);

  const buildAdminActionDetails = (
    refund: VATRefundAdmin,
    type: 'cancelled' | 'blacklisted',
    reason: string
  ) => ({
    ...refund.vat_refund_details,
    adminAction: {
      type,
      reason: reason.trim() || undefined,
      by: address ?? ADMIN_PUBLIC_KEY,
      at: new Date().toISOString(),
    },
  });

  const patchRefundInState = (id: string, patch: Partial<VATRefundAdmin>) => {
    setRefunds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setFilteredRefunds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSelectedRefund((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const handleCancelClaim = async (refund: VATRefundAdmin) => {
    if (refund.status !== 'pending') return;

    setActionLoading('cancel');
    setPayoutError(null);

    try {
      const details = buildAdminActionDetails(refund, 'cancelled', adminActionReason);
      const { error } = await supabase
        .from('payments')
        .update({ status: 'cancelled', vat_refund_details: details })
        .eq('id', refund.id);

      if (error) throw new Error(error.message);

      patchRefundInState(refund.id, { status: 'cancelled', vat_refund_details: details });
      setAdminActionReason('');
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to cancel claim');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlacklistClaim = async (refund: VATRefundAdmin) => {
    if (refund.status !== 'pending') return;

    const reason = adminActionReason.trim();
    if (!reason) {
      setPayoutError('Enter a reason before blacklisting this claim.');
      return;
    }

    const wallet =
      refund.vat_refund_details?.receiverWalletAddress?.trim() || refund.user_id;
    const passportNo = refund.vat_refund_details?.passportNo;

    setActionLoading('blacklist');
    setPayoutError(null);

    try {
      const blacklistResult = await addToClaimBlacklist({
        walletAddress: wallet,
        passportNo,
        reason,
        blacklistedBy: address ?? ADMIN_PUBLIC_KEY,
        sourcePaymentId: refund.id,
      });

      if (!blacklistResult.ok) {
        throw new Error(blacklistResult.error || 'Failed to blacklist wallet');
      }

      const details = buildAdminActionDetails(refund, 'blacklisted', reason);
      const { error: primaryError } = await supabase
        .from('payments')
        .update({ status: 'blacklisted', vat_refund_details: details })
        .eq('id', refund.id);

      if (primaryError) throw new Error(primaryError.message);

      await supabase
        .from('payments')
        .update({
          status: 'cancelled',
          vat_refund_details: buildAdminActionDetails(refund, 'cancelled', `Auto-cancelled: wallet blacklisted — ${reason}`),
        })
        .eq('employee_id', 'vat-refund')
        .eq('status', 'pending')
        .eq('user_id', wallet)
        .neq('id', refund.id);

      patchRefundInState(refund.id, { status: 'blacklisted', vat_refund_details: details });
      setRefunds((prev) =>
        prev.map((r) =>
          r.user_id === wallet && r.status === 'pending' && r.id !== refund.id
            ? { ...r, status: 'cancelled' }
            : r
        )
      );
      setFilteredRefunds((prev) =>
        prev.map((r) =>
          r.user_id === wallet && r.status === 'pending' && r.id !== refund.id
            ? { ...r, status: 'cancelled' }
            : r
        )
      );

      const entries = await fetchClaimBlacklist();
      setBlacklistEntries(entries);
      setAdminActionReason('');
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to blacklist claim');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveBlacklist = async (entry: ClaimBlacklistEntry) => {
    setBlacklistLoading(true);
    try {
      const result = await removeFromClaimBlacklist(entry.id);
      if (!result.ok) throw new Error(result.error);
      setBlacklistEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to remove blacklist entry');
    } finally {
      setBlacklistLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...refunds];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((refund) => {
        const d = refund.vat_refund_details;
        return (
          refund.user_id.toLowerCase().includes(term) ||
          refund.id.toLowerCase().includes(term) ||
          (refund.transaction_hash && refund.transaction_hash.toLowerCase().includes(term)) ||
          (d?.passportNo && d.passportNo.toLowerCase().includes(term)) ||
          (d?.receiptNo && d.receiptNo.toLowerCase().includes(term)) ||
          (d?.claimCountryName && d.claimCountryName.toLowerCase().includes(term)) ||
          (d?.merchantName && d.merchantName.toLowerCase().includes(term)) ||
          (d?.receiverWalletAddress && d.receiverWalletAddress.toLowerCase().includes(term))
        );
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(refund => refund.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(refund => {
        const refundDate = new Date(refund.created_at);
        switch (dateFilter) {
          case 'today':
            return refundDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return refundDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return refundDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    setFilteredRefunds(filtered);
  }, [searchTerm, statusFilter, dateFilter, refunds]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const hasActiveFilters =
    searchTerm.trim() !== '' || statusFilter !== 'all' || dateFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
  };

  const statusPills: Array<{
    id: typeof statusFilter;
    label: string;
    count: number;
  }> = [
    { id: 'all', label: 'All', count: stats.totalRefunds },
    { id: 'pending', label: 'Pending', count: stats.pendingRefunds },
    { id: 'completed', label: 'Completed', count: stats.completedRefunds },
    { id: 'cancelled', label: 'Cancelled', count: stats.cancelledRefunds },
    { id: 'blacklisted', label: 'Blacklisted', count: stats.blacklistedRefunds },
    { id: 'failed', label: 'Failed', count: stats.failedRefunds },
  ];

  const exportToCSV = () => {
    const headers = [
      'ID', 'User Address', 'Amount', 'Token', 'Status', 'Transaction Hash', 'Payment Date', 'Created At',
      'Claim Country', 'Country Code',
      'VAT Reg No', 'Receipt No', 'Bill Amount', 'VAT Amount', 'Purchase Date',
      'Passport No', 'Flight No', 'Nationality', 'Date of Birth',
      'Merchant Name', 'Merchant Address', 'Receiver Wallet Address',
      'Passport Status', 'Passport Trust Score', 'MRZ Valid',
    ];
    const rows = filteredRefunds.map(refund => {
      const details = refund.vat_refund_details || {};
      const pv = details.passportVerification;
      return [
        refund.id,
        refund.user_id,
        refund.amount.toFixed(2),
        refund.token,
        refund.status,
        refund.transaction_hash || 'N/A',
        refund.payment_date,
        refund.created_at,
        details.claimCountryName || 'N/A',
        details.claimCountryCode || 'N/A',
        details.vatRegNo || 'N/A',
        details.receiptNo || 'N/A',
        details.billAmount || 'N/A',
        details.vatAmount || 'N/A',
        details.purchaseDate || 'N/A',
        details.passportNo || 'N/A',
        details.flightNo || 'N/A',
        details.nationality || 'N/A',
        details.dob || 'N/A',
        details.merchantName || 'N/A',
        details.merchantAddress || 'N/A',
        details.receiverWalletAddress || 'N/A',
        pv?.status || 'N/A',
        pv?.trustScore != null ? String(pv.trustScore) : 'N/A',
        pv?.mrzValid != null ? String(pv.mrzValid) : 'N/A',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-refunds-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePayFromTreasury = async (refund: VATRefundAdmin) => {
    const recipient = refund.vat_refund_details?.receiverWalletAddress;
    if (!recipient) {
      setPayoutError('No receiver wallet on this claim.');
      return;
    }

    setPayingRefundId(refund.id);
    setPayoutError(null);

    try {
      const memoText = `VAT Refund - ${refund.vat_refund_details?.receiptNo || refund.id.slice(0, 8)}`;
      const memo = memoText.length > 28 ? memoText.slice(0, 25) + '...' : memoText;

      const result = await requestTreasuryPayout({
        paymentId: refund.id,
        recipientAddress: recipient,
        amount: refund.amount,
        memo,
        payoutType: 'vat_refund',
        callerWallet: address ?? undefined,
      });

      if (!result.ok || !result.txHash) {
        throw new Error(result.error || 'Treasury payout failed');
      }

      setRefunds((prev) =>
        prev.map((r) =>
          r.id === refund.id
            ? { ...r, status: 'completed', transaction_hash: result.txHash }
            : r
        )
      );
      setSelectedRefund((prev) =>
        prev?.id === refund.id
          ? { ...prev, status: 'completed', transaction_hash: result.txHash }
          : prev
      );
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Treasury payout failed');
    } finally {
      setPayingRefundId(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="stat-card py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <Wallet className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--gem-text)]">Connect admin wallet</h2>
          <p className="mt-2 text-sm text-[var(--gem-text-muted)]">
            Connect your Stellar wallet to access the operations dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="stat-card border-red-200 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <Shield className="h-7 w-7 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-[var(--gem-text)]">Access denied</h2>
          <p className="mt-2 text-sm text-[var(--gem-text-muted)]">
            This dashboard is restricted to the configured admin wallet.
          </p>
          <div className="mt-6 space-y-2 rounded-xl bg-gray-50 p-4 text-left text-sm">
            <p className="text-[var(--gem-text-muted)]">
              Your wallet <span className="font-mono text-[var(--gem-text)]">{formatAddress(address || '')}</span>
            </p>
            <p className="text-[var(--gem-text-muted)]">
              Required <span className="font-mono text-[var(--gem-text)]">{formatStellarAddress(ADMIN_PUBLIC_KEY)}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gem-vat-wizard overflow-hidden rounded-[24px] border border-[var(--gem-border)] bg-gradient-to-br from-[#f8f9fc] via-white to-[#eef3ff]">
      {/* Hero header */}
      <div className="border-b border-[var(--gem-border)] px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--gem-ink)] shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--gem-text)] sm:text-3xl">
                  Operations dashboard
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--gem-text-muted)]">
                XLM VAT claims · Stellar mainnet · Treasury{' '}
                <a
                  href={`https://stellar.expert/explorer/public/account/${TREASURY_PUBLIC_KEY}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[var(--gem-brand)] hover:underline"
                >
                  {formatStellarAddress(TREASURY_PUBLIC_KEY)}
                </a>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--gem-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--gem-text)] shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportToCSV}
              disabled={filteredRefunds.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gem-ink)] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="stat-card !p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">Total claims</p>
            <p className="mt-1 text-2xl font-bold text-[var(--gem-text)]">{stats.totalRefunds}</p>
          </div>
          <div className="stat-card !p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">XLM paid</p>
            <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold text-[var(--gem-text)]">
              <img src="/xlm.png" alt="" className="h-5 w-5" />
              {stats.totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="stat-card !p-4 border-emerald-200/60 bg-emerald-50/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.completedRefunds}</p>
          </div>
          <div className="stat-card !p-4 border-amber-200/60 bg-amber-50/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{stats.pendingRefunds}</p>
          </div>
          <div className="stat-card !p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">Cancelled</p>
            <p className="mt-1 text-2xl font-bold text-gray-700">{stats.cancelledRefunds}</p>
          </div>
          <div className="stat-card !p-4 border-red-200/60 bg-red-50/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Blocked</p>
            <p className="mt-1 text-2xl font-bold text-red-800">{stats.blacklistedRefunds + stats.failedRefunds}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-8">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gem-text-muted)]" />
              <input
                type="text"
                placeholder="Search passport, receipt, country, wallet, tx hash…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[var(--gem-border)] bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-[var(--gem-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--gem-brand)]/20"
              />
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="rounded-xl border border-[var(--gem-border)] bg-white px-4 py-2.5 text-sm shadow-sm focus:border-[var(--gem-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--gem-brand)]/20"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--gem-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
              >
                <Filter className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {statusPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === pill.id
                    ? 'border-[var(--gem-ink)] bg-[var(--gem-ink)] text-white'
                    : 'border-[var(--gem-border)] bg-white text-[var(--gem-text-muted)] hover:border-[var(--gem-brand)]/40 hover:text-[var(--gem-text)]'
                }`}
              >
                {pill.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === pill.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Claims table */}
          <div className="overflow-hidden rounded-2xl border border-[var(--gem-border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--gem-border)] px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--gem-text)]">Claims queue</h2>
                <p className="text-xs text-[var(--gem-text-muted)]">
                  {filteredRefunds.length} of {refunds.length} shown
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--gem-border)] border-t-[var(--gem-brand)]" />
                <p className="text-sm text-[var(--gem-text-muted)]">Loading claims…</p>
              </div>
            ) : filteredRefunds.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)]/50">
                  <FileText className="h-7 w-7 text-[var(--gem-brand)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--gem-text)]">No claims found</h3>
                <p className="mt-1 text-sm text-[var(--gem-text-muted)]">
                  {hasActiveFilters
                    ? 'Try adjusting your search or filters.'
                    : 'XLM VAT claims will appear here once submitted.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 text-sm font-semibold text-[var(--gem-brand)] hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[var(--gem-border)] bg-gray-50/80">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] sm:px-5">
                        Claim
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] sm:px-5">
                        Country
                      </th>
                      <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] md:table-cell sm:px-5">
                        Wallet
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] sm:px-5">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] sm:px-5">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] lg:table-cell sm:px-5">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)] sm:px-5">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gem-border)]">
                    {filteredRefunds.map((refund) => (
                      <tr
                        key={refund.id}
                        className="transition-colors hover:bg-[var(--gem-brand-soft)]/20"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <p className="font-mono text-xs font-medium text-[var(--gem-text)]">
                            {refund.id.slice(0, 8)}…
                          </p>
                          {refund.vat_refund_details?.receiptNo && (
                            <p className="mt-0.5 text-[10px] text-[var(--gem-text-muted)]">
                              #{refund.vat_refund_details.receiptNo}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <span className="text-sm text-[var(--gem-text)]">
                            {refund.vat_refund_details?.claimCountryName || '—'}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3.5 md:table-cell sm:px-5">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-[var(--gem-text-muted)]" />
                            <span className="font-mono text-xs text-[var(--gem-text)]">
                              {formatAddress(refund.user_id)}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <img src="/xlm.png" alt="" className="h-4 w-4" />
                            <span className="text-sm font-semibold tabular-nums text-[var(--gem-text)]">
                              {refund.amount.toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-center sm:px-5">
                          <StatusBadge status={refund.status} />
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3.5 lg:table-cell sm:px-5">
                          <div className="flex items-center gap-1.5 text-xs text-[var(--gem-text-muted)]">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(refund.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-center sm:px-5">
                          <div className="flex items-center justify-center gap-1.5">
                            {refund.transaction_hash && (
                              <a
                                href={getStellarExpertTxUrl(refund.transaction_hash, 'mainnet')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--gem-border)] text-[var(--gem-brand)] transition hover:bg-[var(--gem-brand-soft)]/40"
                                title="View transaction"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRefund(refund);
                                setAdminActionReason('');
                                setPayoutError(null);
                                setShowDetailsModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--gem-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--gem-text)] transition hover:border-[var(--gem-brand)]/40 hover:bg-[var(--gem-brand-soft)]/30"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="stat-card !p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[var(--gem-brand)]" />
                <h3 className="text-sm font-semibold text-[var(--gem-text)]">Treasury</h3>
              </div>
              <p className="font-mono text-xs text-[var(--gem-text)] break-all">
                {formatStellarAddress(TREASURY_PUBLIC_KEY)}
              </p>
              <a
                href={`https://stellar.expert/explorer/public/account/${TREASURY_PUBLIC_KEY}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gem-brand)] hover:underline"
              >
                View on Stellar Expert
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-3 text-xs leading-relaxed text-[var(--gem-text-muted)]">
                Pay pending claims from treasury. Set{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">TREASURY_SECRET_KEY</code>{' '}
                in Supabase Edge Function secrets for production payouts.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-sm">
              <div className="border-b border-red-100 bg-red-50/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-red-700" />
                  <h3 className="text-sm font-semibold text-[var(--gem-text)]">Blacklist</h3>
                </div>
                <p className="mt-0.5 text-xs text-red-800/70">
                  {blacklistEntries.length} blocked wallet{blacklistEntries.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-3 sidebar-scroll">
                {blacklistLoading ? (
                  <p className="py-4 text-center text-xs text-[var(--gem-text-muted)]">Loading…</p>
                ) : blacklistEntries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--gem-text-muted)]">
                    No wallets blacklisted
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blacklistEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[var(--gem-border)] bg-gray-50/80 p-3"
                      >
                        <p className="font-mono text-[10px] text-[var(--gem-text)] break-all">
                          {entry.wallet_address}
                        </p>
                        {entry.passport_no && (
                          <p className="mt-1 text-[10px] text-[var(--gem-text-muted)]">
                            Passport {entry.passport_no}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-[var(--gem-text)] line-clamp-2">{entry.reason}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-[var(--gem-text-muted)]">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlacklist(entry)}
                            className="text-[10px] font-semibold text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedRefund && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--gem-border)] bg-white shadow-2xl sm:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--gem-border)] bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--gem-text)] sm:text-xl">Claim review</h2>
                  <StatusBadge status={selectedRefund.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--gem-text-muted)]">{selectedRefund.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="rounded-lg p-2 text-[var(--gem-text-muted)] transition hover:bg-gray-100 hover:text-[var(--gem-text)]"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              {/* Claim country */}
              {(selectedRefund.vat_refund_details?.claimCountryName || selectedRefund.vat_refund_details?.claimCountryCode) && (
                <div className="rounded-lg border border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)]/40 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Tax claim country</h3>
                  <p className="text-base font-bold text-gray-900">
                    {selectedRefund.vat_refund_details.claimCountryName}
                    {selectedRefund.vat_refund_details.claimCountryCode && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({selectedRefund.vat_refund_details.claimCountryCode})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Claimant wallet */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Claimant wallet</h3>
                <p className="font-mono text-xs text-gray-800 break-all">{selectedRefund.user_id}</p>
              </div>

              {/* Summary Card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--gem-border)] bg-gray-50/80 p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">
                    Submitted
                  </h3>
                  <p className="text-sm font-medium text-[var(--gem-text)]">
                    {new Date(selectedRefund.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--gem-border)] bg-gray-50/80 p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">
                    Refund amount
                  </h3>
                  <div className="flex items-center gap-2">
                    <img src="/xlm.png" alt="" className="h-5 w-5" />
                    <span className="text-lg font-bold text-[var(--gem-text)]">
                      {selectedRefund.amount.toFixed(7)} XLM
                    </span>
                  </div>
                  {selectedRefund.transaction_hash && (
                    <a
                      href={getStellarExpertTxUrl(selectedRefund.transaction_hash, 'mainnet')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--gem-brand)] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View transaction
                    </a>
                  )}
                </div>
              </div>

              {selectedRefund.vat_refund_details?.adminAction && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Admin action</h3>
                  <p className="text-sm text-gray-800 capitalize">
                    {selectedRefund.vat_refund_details.adminAction.type.replace('_', ' ')}
                    {selectedRefund.vat_refund_details.adminAction.reason
                      ? ` — ${selectedRefund.vat_refund_details.adminAction.reason}`
                      : ''}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    By {formatAddress(selectedRefund.vat_refund_details.adminAction.by)} ·{' '}
                    {new Date(selectedRefund.vat_refund_details.adminAction.at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Claim details */}
              {selectedRefund.vat_refund_details ? (
              <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  Receipt Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">VAT Registration No.</label>
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {selectedRefund.vat_refund_details.vatRegNo || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Receipt/Invoice No.</label>
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {selectedRefund.vat_refund_details.receiptNo || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Total Bill Amount</label>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedRefund.vat_refund_details.billAmount || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">VAT Amount</label>
                    <p className="text-sm font-bold text-green-600">
                      {selectedRefund.vat_refund_details.vatAmount || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200 sm:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Purchase Date</label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRefund.vat_refund_details.purchaseDate || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Passport Number</label>
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {selectedRefund.vat_refund_details.passportNo || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Flight Number</label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRefund.vat_refund_details.flightNo || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Country of Nationality</label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRefund.vat_refund_details.nationality || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Date of Birth</label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRefund.vat_refund_details.dob || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Passport verification */}
              {selectedRefund.vat_refund_details.passportVerification && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    Passport Verification
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <label className="text-xs text-gray-600 mb-1 block">Status</label>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {selectedRefund.vat_refund_details.passportVerification.status?.replace('_', ' ') || '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <label className="text-xs text-gray-600 mb-1 block">Trust score</label>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedRefund.vat_refund_details.passportVerification.trustScore != null
                          ? `${selectedRefund.vat_refund_details.passportVerification.trustScore}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <label className="text-xs text-gray-600 mb-1 block">Tier</label>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {selectedRefund.vat_refund_details.passportVerification.tier || '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <label className="text-xs text-gray-600 mb-1 block">MRZ valid</label>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedRefund.vat_refund_details.passportVerification.mrzValid ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Merchant Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Store className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  Merchant Information
                </h3>
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Merchant Name</label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRefund.vat_refund_details.merchantName || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <label className="text-xs text-gray-600 mb-1 block">Merchant Address</label>
                    <p className="text-sm text-gray-900 leading-relaxed">
                      {selectedRefund.vat_refund_details.merchantAddress || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  Payment Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200 sm:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Receiver Wallet Address</label>
                    {selectedRefund.vat_refund_details.receiverWalletAddress ? (
                      <div className="flex items-start gap-2">
                        <p className="text-gray-900 font-mono text-xs break-all flex-1">{selectedRefund.vat_refund_details.receiverWalletAddress}</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedRefund.vat_refund_details.receiverWalletAddress || '');
                          }}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                          title="Copy address"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-sm">Not provided</p>
                    )}
                  </div>
                  {selectedRefund.transaction_hash && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <label className="text-xs text-gray-600 mb-1 block">Transaction Hash</label>
                      <a
                        href={getStellarExpertTxUrl(selectedRefund.transaction_hash, 'mainnet')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-mono text-xs"
                      >
                        <span>{selectedRefund.transaction_hash.slice(0, 10)}...{selectedRefund.transaction_hash.slice(-8)}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
              </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No extended claim details were saved for this record (amount and payout status only).
                </div>
              )}

              {selectedRefund.status === 'pending' && (
                <div className="space-y-3 border-t border-gray-200 pt-4">
                  {payoutError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {payoutError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="admin-action-reason" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Admin note (required for blacklist)
                    </label>
                    <textarea
                      id="admin-action-reason"
                      value={adminActionReason}
                      onChange={(e) => setAdminActionReason(e.target.value)}
                      rows={2}
                      placeholder="e.g. Duplicate claim, forged receipt, suspicious passport…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handlePayFromTreasury(selectedRefund)}
                      disabled={payingRefundId === selectedRefund.id || actionLoading !== null}
                      className="rounded-xl bg-[var(--gem-ink)] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {payingRefundId === selectedRefund.id ? 'Paying…' : 'Pay from Treasury'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelClaim(selectedRefund)}
                      disabled={actionLoading !== null || payingRefundId === selectedRefund.id}
                      className="rounded-xl border border-[var(--gem-border)] bg-white py-3 text-sm font-semibold text-[var(--gem-text)] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel Claim'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBlacklistClaim(selectedRefund)}
                      disabled={actionLoading !== null || payingRefundId === selectedRefund.id}
                      className="rounded-xl border border-red-300 bg-red-50 py-3 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading === 'blacklist' ? 'Blacklisting…' : 'Blacklist Wallet'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Blacklist blocks this wallet (and passport if provided) from future claims and cancels other pending claims from the same wallet.
                  </p>
                </div>
              )}
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
