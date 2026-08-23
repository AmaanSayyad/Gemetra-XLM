import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Copy,
  FileText,
  Globe2,
  Sparkles,
  X,
} from 'lucide-react';
import { PassportCoverImage } from './PassportCoverImage';
import {
  VAT_COUNTRIES,
  netRefundShort,
  parseRefundRatePercent,
  parseVatRatePercent,
  type VatCountry,
} from './vatCountries';

interface CountryRefundDetailPanelProps {
  country: VatCountry;
  onClose: () => void;
  onSelectCountry: (code: string) => void;
  onStartRefund?: () => void;
}

function shortName(name: string) {
  if (name === 'United Arab Emirates') return 'UAE';
  return name;
}

function RefundBreakdownBar({ vatPct, netPct }: { vatPct: number; netPct: number }) {
  const feePct = Math.max(0, vatPct - netPct);
  const basePct = Math.max(0, 100 - vatPct);

  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        {netPct > 0 && <div className="bg-emerald-500/90" style={{ width: `${netPct}%` }} />}
        {feePct > 0 && <div className="bg-amber-500/80" style={{ width: `${feePct}%` }} />}
        {basePct > 0 && <div className="bg-white/10" style={{ width: `${basePct}%` }} />}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Net refund
          </p>
          <p className="atlys-index-heading mt-1 text-2xl text-white">{netPct > 0 ? `${netPct}%` : '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Operator fees
          </p>
          <p className="atlys-index-heading mt-1 text-2xl text-white">{feePct > 0 ? `~${feePct.toFixed(1)}%` : '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Statutory VAT
          </p>
          <p className="atlys-index-heading mt-1 text-2xl text-white">{vatPct > 0 ? `${vatPct}%` : '—'}</p>
        </div>
      </div>
    </div>
  );
}

function MiniCountryCard({
  country,
  rank,
  onClick,
}: {
  country: VatCountry;
  rank: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="atlys-detail-mini-card group">
      <PassportCoverImage
        passportName={country.passportName}
        alt=""
        className="h-[56px] w-[40px] shrink-0 rounded-[4px] object-cover shadow"
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Rank #{rank}</p>
        <p className="truncate text-sm font-semibold text-white">{shortName(country.name)}</p>
        <p className="truncate text-xs text-white/40">{netRefundShort(country.refundRate)} net</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-white/50" />
    </button>
  );
}

/** Inline country detail — Atlys-style, stays on the same page */
export const CountryRefundDetailPanel: React.FC<CountryRefundDetailPanelProps> = ({
  country,
  onClose,
  onSelectCountry,
  onStartRefund,
}) => {
  const [copied, setCopied] = useState(false);
  const sorted = useMemo(() => [...VAT_COUNTRIES].sort((a, b) => b.score - a.score), []);

  const rank = sorted.indexOf(country) + 1;
  const netPct = parseRefundRatePercent(country.refundRate);
  const vatPct = parseVatRatePercent(country.vatRate);

  const regionPeers = useMemo(
    () => sorted.filter((c) => c.region === country.region && c.code !== country.code).slice(0, 4),
    [country, sorted],
  );

  const topFive = useMemo(
    () => sorted.slice(0, 5).filter((c) => c.code !== country.code),
    [country.code, sorted],
  );

  const compareTarget = useMemo(() => {
    const idx = sorted.indexOf(country);
    return sorted[idx === 0 ? 1 : 0];
  }, [country, sorted]);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#vat/${country.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="atlys-inline-detail rounded-[24px] border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-8">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white/75"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-10 p-5 sm:p-8 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-12">
        <div>
          <div className="atlys-detail-passport-frame mx-auto max-w-[240px] lg:mx-0">
            <PassportCoverImage
              passportName={country.passportName}
              alt={`${country.name} passport`}
              className="h-auto w-full rounded-l-md rounded-r-2xl object-cover shadow-2xl"
              loading="eager"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={onStartRefund}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              <Globe2 className="h-3.5 w-3.5" />
              Start refund
            </button>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="atlys-detail-badge">
              <Sparkles className="h-3 w-3" />
              {country.tier}
            </span>
            <span className="atlys-detail-badge">{country.region.toUpperCase()}</span>
          </div>

          <h2 className="atlys-index-heading mt-4 text-[2rem] text-white sm:text-[2.5rem]">{country.name}</h2>
          <p className="mt-1 text-sm font-medium uppercase tracking-[0.18em] text-white/35">
            {country.refundType} · 2026
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="atlys-detail-stat">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Global rank</p>
              <p className={`atlys-index-heading mt-2 text-2xl ${rank === 1 ? 'atlys-rank-gold' : 'text-white'}`}>
                #{rank}
              </p>
            </div>
            <div className="atlys-detail-stat">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Refund score</p>
              <p className="atlys-index-heading mt-2 text-2xl text-white">{country.score}</p>
            </div>
            <div className="atlys-detail-stat">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Net refund</p>
              <p className="atlys-index-heading mt-2 text-2xl text-white">{netRefundShort(country.refundRate)}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Refund breakdown</p>
            <div className="mt-3">
              <RefundBreakdownBar vatPct={vatPct} netPct={netPct} />
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-white/45">
            {country.name} ranks #{rank} with a refund score of {country.score}. Tourists typically receive{' '}
            {netRefundShort(country.refundRate)} back after {country.operators.join(' / ')} fees. Minimum spend:{' '}
            {country.minSpend}. {country.exportDeadline}.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStartRefund}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start refund with Gemetra
              <ChevronRight className="h-4 w-4" />
            </button>
            {compareTarget && (
              <button
                type="button"
                onClick={() => onSelectCountry(compareTarget.code)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Compare with {shortName(compareTarget.name)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-t border-white/[0.06] p-5 sm:grid-cols-2 sm:p-8">
        <div className="atlys-detail-panel">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <FileText className="h-3.5 w-3.5" />
            Documents required
          </p>
          <ul className="mt-4 space-y-2">
            {country.documentsRequired.map((doc) => (
              <li key={doc} className="flex gap-2 text-sm text-white/55">
                <span className="text-white/25">·</span>
                {doc}
              </li>
            ))}
          </ul>
        </div>
        <div className="atlys-detail-panel">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Eligibility & validation</p>
          <p className="mt-4 text-sm leading-relaxed text-white/55">{country.eligibility}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/55">{country.customsValidation}</p>
        </div>
      </div>

      {(regionPeers.length > 0 || topFive.length > 0) && (
        <div className="space-y-8 border-t border-white/[0.06] p-5 sm:p-8">
          {regionPeers.length > 0 && (
            <div>
              <h3 className="atlys-index-heading mb-4 text-lg text-white">More from {country.region}</h3>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {regionPeers.map((c) => (
                  <MiniCountryCard
                    key={c.code}
                    country={c}
                    rank={sorted.indexOf(c) + 1}
                    onClick={() => onSelectCountry(c.code)}
                  />
                ))}
              </div>
            </div>
          )}
          {topFive.length > 0 && (
            <div>
              <h3 className="atlys-index-heading mb-4 text-lg text-white">Top ranked</h3>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {topFive.slice(0, 4).map((c) => (
                  <MiniCountryCard
                    key={c.code}
                    country={c}
                    rank={sorted.indexOf(c) + 1}
                    onClick={() => onSelectCountry(c.code)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
