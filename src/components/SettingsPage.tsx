import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Download,
  Wallet,
  Copy,
  Bell,
  Globe,
  Shield,
  ExternalLink,
  Check,
  Sparkles,
  Receipt,
  Loader2,
  CheckCircle2,
  Settings2,
} from 'lucide-react';
import { GEMETRA_LINKS } from '../config/links';
import { motion, AnimatePresence } from 'framer-motion';
import { useStellarWallet } from '../utils/stellar-wallet';
import { formatStellarAddress } from '../utils/stellar';
import { usePayments } from '../hooks/usePayments';
import { usePoints } from '../hooks/usePoints';
import { getCurrentNetwork } from '../config/stellar';
import { GemetraButton } from '../gemetra-ui/GemetraButton';

interface SettingsPageProps {
  onBack: () => void;
}

function SettingsCard({
  icon,
  title,
  subtitle,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--gem-radius-md)] border border-[var(--gem-border)] bg-white p-5 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)] text-[var(--gem-brand)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--gem-text)] sm:text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--gem-text-muted)] sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  icon,
  children,
  border = true,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3.5 ${
        border ? 'border-b border-[var(--gem-border)] last:border-b-0 last:pb-0 first:pt-0' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-[var(--gem-text-muted)]">{icon}</span>}
        <span className="text-sm text-[var(--gem-text-muted)]">{label}</span>
      </div>
      <div className="shrink-0 text-right text-sm font-medium text-[var(--gem-text)]">{children}</div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-[var(--gem-brand)]' : 'bg-[var(--gem-border)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { walletState } = useStellarWallet();
  const address = walletState.publicKey;
  const isConnected = walletState.isConnected;
  const network = getCurrentNetwork();
  const { getAllPayments } = usePayments();
  const { userPoints } = usePoints();

  const [exporting, setExporting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [refundStats, setRefundStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('gemetra_notifications_enabled') !== 'false';
  });

  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      try {
        const all = await getAllPayments();
        const vat = all.filter((p) => p.employee_id === 'vat-refund');
        if (!cancelled) {
          setRefundStats({
            total: vat.length,
            completed: vat.filter((p) => p.status === 'completed').length,
            pending: vat.filter((p) => p.status === 'pending').length,
          });
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, getAllPayments]);

  const avatarUrl = useMemo(
    () => `https://api.dicebear.com/7.x/shapes/svg?seed=${address || 'gemetra'}`,
    [address],
  );

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleToggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem('gemetra_notifications_enabled', String(newValue));
    setSuccess(newValue ? 'Notifications enabled' : 'Notifications disabled');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleExportData = async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    setExporting(true);
    setError('');

    try {
      const allPayments = await getAllPayments();
      const vatRefunds = allPayments.filter((p) => p.employee_id === 'vat-refund');

      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          exportedBy: address,
          walletAddress: address,
          dataVersion: '2.0',
          network: network === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet',
        },
        companyInfo: {
          walletAddress: address,
          product: 'VAT Refunds',
        },
        vatRefunds: vatRefunds.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          token: payment.token,
          transaction_hash: payment.transaction_hash,
          status: payment.status,
          payment_date: payment.payment_date,
          created_at: payment.created_at,
          vat_refund_details: payment.vat_refund_details,
        })),
        summary: {
          totalRefunds: vatRefunds.length,
          completedRefunds: vatRefunds.filter((p) => p.status === 'completed').length,
          pendingRefunds: vatRefunds.filter((p) => p.status === 'pending').length,
          totalRefunded: vatRefunds
            .filter((p) => p.status === 'completed')
            .reduce((sum, p) => sum + p.amount, 0),
        },
      };

      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `gemetra-data-export-${address.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);

      setSuccess('Data exported — check your downloads folder.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Failed to export data:', err);
      setError('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)]">
          <Wallet className="h-7 w-7 text-[var(--gem-brand)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--gem-text)]">Wallet not connected</h2>
        <p className="mt-2 text-sm text-[var(--gem-text-muted)]">
          Connect Freighter or Albedo to manage your account settings.
        </p>
        <GemetraButton variant="secondary" size="sm" className="mt-6" onClick={onBack}>
          Back to Overview
        </GemetraButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--gem-text-muted)] transition hover:text-[var(--gem-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </button>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[var(--gem-brand)]" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gem-text-muted)]">
              Account
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--gem-text)] sm:text-3xl">Settings</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--gem-text-muted)] sm:text-base">
            Manage your Stellar wallet, preferences, and exported refund data.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gem-success)]/25 bg-[var(--gem-success)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--gem-success)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Connected
        </div>
      </div>

      {/* Toasts */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-[var(--gem-success)]/25 bg-[var(--gem-success)]/10 text-[var(--gem-success)]'
            }`}
          >
            <div className="flex items-center gap-2">
              {!error && <Check className="h-4 w-4 shrink-0" />}
              {error || success}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--gem-text-muted)]">Network</p>
          <p className="mt-1 text-lg font-bold text-[var(--gem-text)] sm:text-xl">
            {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
          </p>
          {network === 'mainnet' && (
            <span className="mt-2 inline-block rounded-full bg-[var(--gem-success)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gem-success)]">
              Production
            </span>
          )}
        </div>
        <div className="stat-card">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--gem-text-muted)]">
            <Receipt className="h-3 w-3" />
            VAT claims
          </p>
          <p className="mt-1 text-lg font-bold text-[var(--gem-text)] sm:text-xl">
            {loadingStats ? '—' : refundStats.total}
          </p>
          {!loadingStats && refundStats.total > 0 && (
            <p className="mt-1 text-xs text-[var(--gem-text-muted)]">
              {refundStats.completed} completed · {refundStats.pending} pending
            </p>
          )}
        </div>
        <div className="stat-card border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)]">
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--gem-brand)]">
            <Sparkles className="h-3 w-3" />
            Gemetra points
          </p>
          <p className="mt-1 text-lg font-bold text-[var(--gem-brand)] sm:text-xl">
            {(userPoints?.available_points ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Main grid — balanced columns */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left column */}
        <div className="space-y-6">
          <SettingsCard icon={<Wallet className="h-5 w-5" />} title="Wallet & account" subtitle="Your connected Stellar identity">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--gem-text-muted)]">
                  Wallet address
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] px-3 py-3 sm:px-4">
                  <Wallet className="h-4 w-4 shrink-0 text-[var(--gem-text-muted)]" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--gem-text)] sm:text-sm">
                    {address}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--gem-border)] bg-white text-[var(--gem-text-muted)] transition hover:border-[var(--gem-brand)]/30 hover:text-[var(--gem-brand)]"
                    title="Copy address"
                  >
                    {copiedAddress ? (
                      <Check className="h-4 w-4 text-[var(--gem-success)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--gem-text-muted)]">
                  Network
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--gem-border)] bg-[var(--gem-surface-muted)] px-4 py-3">
                  <Globe className="h-4 w-4 text-[var(--gem-text-muted)]" />
                  <span className="flex-1 text-sm font-medium text-[var(--gem-text)]">
                    {network === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet'}
                  </span>
                  {network === 'mainnet' && (
                    <span className="rounded-full bg-[var(--gem-success)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gem-success)]">
                      Production
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SettingsCard>

          <div className="rounded-[var(--gem-radius-md)] border border-[var(--gem-brand)]/20 bg-[var(--gem-brand-soft)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[var(--gem-brand)]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--gem-text)]">Security & privacy</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--gem-text-muted)]">
                  Your wallet keys never leave your browser extension. Refund data is stored locally and all payouts
                  are recorded on-chain on Stellar — fully transparent and non-custodial.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <SettingsCard icon={<User className="h-5 w-5" />} title="Profile" subtitle="Your account overview">
            <div className="flex flex-col items-center border-b border-[var(--gem-border)] pb-5 sm:flex-row sm:items-center sm:gap-5 sm:pb-6">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[var(--gem-border)] bg-[var(--gem-surface-muted)] sm:h-20 sm:w-20">
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="mt-4 text-center sm:mt-0 sm:text-left">
                <h3 className="font-mono text-base font-semibold text-[var(--gem-text)] sm:text-lg">
                  {formatStellarAddress(address)}
                </h3>
                <p className="mt-1 text-sm text-[var(--gem-text-muted)]">VAT traveler · Stellar {network === 'mainnet' ? 'mainnet' : 'testnet'}</p>
              </div>
            </div>

            <div className="pt-1">
              <SettingsRow label="Status" icon={<CheckCircle2 className="h-4 w-4" />}>
                <span className="text-[var(--gem-success)]">Connected</span>
              </SettingsRow>
              <SettingsRow label="Product" icon={<Receipt className="h-4 w-4" />}>
                VAT Refunds
              </SettingsRow>
              <SettingsRow label="Notifications" icon={<Bell className="h-4 w-4" />}>
                <Toggle enabled={notificationsEnabled} onChange={handleToggleNotifications} />
              </SettingsRow>
            </div>
          </SettingsCard>

          <SettingsCard icon={<Download className="h-5 w-5" />} title="Data & export" subtitle="Download your refund history">
            <p className="mb-4 text-sm leading-relaxed text-[var(--gem-text-muted)]">
              Export all your VAT claims, transaction hashes, and summary stats as a JSON file for your records.
            </p>
            <GemetraButton
              variant="primary"
              size="sm"
              fullWidth
              icon={exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export all data'}
            </GemetraButton>
          </SettingsCard>

          <SettingsCard icon={<Globe className="h-5 w-5" />} title="Help & resources" subtitle="Learn more about Gemetra">
            <a
              href={GEMETRA_LINKS.deck}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-surface-muted)] hover:text-[var(--gem-text)]"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="flex-1">Pitch deck</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </a>
            <a
              href={GEMETRA_LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-surface-muted)] hover:text-[var(--gem-text)]"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="flex-1">GitHub repository</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </a>
            <a
              href={GEMETRA_LINKS.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-surface-muted)] hover:text-[var(--gem-text)]"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="flex-1">Live website</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </a>
            <a
              href={GEMETRA_LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-surface-muted)] hover:text-[var(--gem-text)]"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="flex-1">X account</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </a>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
};
