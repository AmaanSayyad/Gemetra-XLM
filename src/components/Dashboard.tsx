import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  GemetraTimeline,
  GemetraButton,
  TimelineStep,
  CountryExploreCard,
  VAT_COUNTRIES,
  countryHero,
  countryVideo,
  countryFlag,
  getCountryByCode,
} from '../gemetra-ui';
import { VATRefundOverview } from './VATRefundOverview';
import { TokenBalance } from './TokenBalance';
import { RecentActivity } from './RecentActivity';
import { AllActivityPage } from './AllActivityPages';
import { usePayments } from '../hooks/usePayments';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  refreshKey?: number;
  featuredCountryCode?: string | null;
}

function readCountryFromHash(): string | null {
  const match = window.location.hash.match(/^#(?:explore|vat)\/([A-Z]{2})$/i);
  return match ? match[1].toUpperCase() : null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
  refreshKey = 0,
  featuredCountryCode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hashCountryCode, setHashCountryCode] = useState<string | null>(() => readCountryFromHash());

  useEffect(() => {
    const syncHash = () => setHashCountryCode(readCountryFromHash());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const countryCode = featuredCountryCode ?? hashCountryCode ?? 'AE';
  const country = useMemo(() => getCountryByCode(countryCode) ?? getCountryByCode('AE')!, [countryCode]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, [countryCode]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const { getAllPayments } = usePayments();
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    getAllPayments().then((payments) => {
      const vat = payments.filter((p) => p.employee_id === 'vat-refund');
      setPendingCount(vat.filter((p) => p.status === 'pending').length);
      setCompletedCount(vat.filter((p) => p.status === 'completed').length);
    });
  }, [getAllPayments, refreshKey]);

  if (showAllActivity) {
    return <AllActivityPage onClose={() => setShowAllActivity(false)} refreshKey={refreshKey} />;
  }

  const timelineSteps: TimelineStep[] = [
    { id: '1', title: 'Connect Stellar wallet', status: 'completed' },
    { id: '2', title: 'Submit VAT receipt', status: pendingCount + completedCount > 0 ? 'completed' : 'current' },
    { id: '3', title: 'Validation & review', status: pendingCount > 0 ? 'current' : completedCount > 0 ? 'completed' : 'pending' },
    { id: '4', title: 'XLM payout to wallet', status: completedCount > 0 ? 'completed' : 'pending' },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--gem-text)] md:text-4xl">
          Welcome back
        </h1>
        <p className="mt-2 text-[var(--gem-text-muted)]">Track refunds and wallet balance in one place</p>
      </div>

      {/* Hero status — Atlys approved visa card with country image */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-10 overflow-hidden rounded-[32px] bg-[var(--gem-ink)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.4)]"
      >
        <video
          ref={videoRef}
          key={country.code}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
          src={countryVideo(country.code)}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/55" />
        <div className="relative grid md:grid-cols-2">
          <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-10">
            <div className="flex items-center gap-2">
              <img src={countryFlag(country.code)} alt="" className="h-6 w-6 rounded-full object-cover" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                {country.name} · {country.refundType}
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {completedCount > 0 ? (
                <>Your refund pipeline is <span className="text-[var(--gem-lime)]">active</span></>
              ) : (
                <>Ready for your first <span className="text-[var(--gem-lime)]">refund</span></>
              )}
            </h2>
            <p className="mt-3 text-sm text-white/60">
              {pendingCount > 0
                ? `${pendingCount} claim${pendingCount > 1 ? 's' : ''} processing`
                : 'Submit a receipt to start earning XLM and traveler points abroad'}
            </p>
            {completedCount > 0 && (
              <span className="gem-pill mt-4 bg-[var(--gem-lime)]/20 text-[var(--gem-lime)]">
                Refund by departure · Guaranteed
              </span>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <GemetraButton onClick={() => setActiveTab('vat-refund')}>Submit Refund</GemetraButton>
              <GemetraButton variant="ghost" className="!border-white/20 !text-white hover:!bg-white/10" onClick={() => setActiveTab('refund-history')}>
                My claims
              </GemetraButton>
            </div>
          </div>
          <div className="p-8 md:p-10">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white/40">Refund progress</p>
            <GemetraTimeline steps={timelineSteps} compact className="[&_*]:text-white/90" />
          </div>
        </div>
      </motion.div>

      <div className="mb-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <VATRefundOverview setActiveTab={setActiveTab} refreshKey={refreshKey} />
          <RecentActivity onViewAllClick={() => setShowAllActivity(true)} refreshKey={refreshKey} />
        </div>
        <div>
          <TokenBalance />
        </div>
      </div>

      {/* Popular corridors — exploration only */}
      <div>
        <h3 className="mb-5 text-xl font-semibold tracking-tight text-[var(--gem-text)]">Popular refund corridors</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {VAT_COUNTRIES.slice(0, 4).map((country) => (
            <CountryExploreCard
              key={country.code}
              country={country}
              onClick={() => setActiveTab('vat-refund')}
            />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h3 className="mb-4 font-semibold text-[var(--gem-text)]">Need help?</h3>
        <button
          type="button"
          onClick={() => setActiveTab('ai-assistant-chat')}
          className="group relative w-full overflow-hidden rounded-[24px] border border-[var(--gem-border)] bg-white text-left shadow-sm transition hover:shadow-lg sm:max-w-md"
        >
          <img src={countryHero('JP')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 transition group-hover:opacity-30" />
          <div className="relative flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gem-brand-soft)] text-[var(--gem-brand)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-[var(--gem-text-muted)]">AI Assistant</p>
              <p className="font-semibold text-[var(--gem-text)]">Ask about VAT rules & Stellar</p>
              <p className="text-sm text-[var(--gem-text-muted)]">Get instant answers before you submit</p>
            </div>
            <ChevronRight className="h-5 w-5 text-[var(--gem-text-muted)] transition group-hover:translate-x-1" />
          </div>
        </button>
      </div>
    </div>
  );
};
