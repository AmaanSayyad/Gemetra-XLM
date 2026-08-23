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
} from 'lucide-react';
import {
  AtlysIndexNavbar,
  PassportCoverImage,
  VAT_COUNTRIES,
  getCountryByCode,
  netRefundShort,
  parseRefundRatePercent,
  parseVatRatePercent,
  type VatCountry,
} from '../gemetra-ui';

interface VATCountryDetailPageProps {
  countryCode: string;
  onBack: () => void;
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
  const netWidth = netPct;
  const feeWidth = feePct;
  const baseWidth = basePct;

  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        {netWidth > 0 && (
          <div className="bg-emerald-500/90" style={{ width: `${netWidth}%` }} title="Net refund" />
        )}
        {feeWidth > 0 && (
          <div className="bg-amber-500/80" style={{ width: `${feeWidth}%` }} title="Operator fees" />
        )}
        {baseWidth > 0 && (
          <div className="bg-white/10" style={{ width: `${baseWidth}%` }} title="Remainder" />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Net refund
          </p>
          <p className="atlys-index-heading mt-1 text-2xl text-white">{netPct > 0 ? `${netPct}%` : '—'}</p>
          <p className="mt-0.5 text-xs text-white/35">Typical tourist payout</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Operator fees
          </p>
          <p className="atlys-index-heading mt-1 text-2xl text-white">{feePct > 0 ? `~${feePct.toFixed(1)}%` : '—'}</p>
          <p className="mt-0.5 text-xs text-white/35">Commission + admin</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Statutory VAT
          </p>
          <p className="atlys-index-heading mt-1 text-2xl text-white">{vatPct > 0 ? `${vatPct}%` : '—'}</p>
          <p className="mt-0.5 text-xs text-white/35">Before fees</p>
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

export const VATCountryDetailPage: React.FC<VATCountryDetailPageProps> = ({
  countryCode,
  onBack,
  onSelectCountry,
  onStartRefund,
}) => {
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(() => [...VAT_COUNTRIES].sort((a, b) => b.score - a.score), []);
  const country = getCountryByCode(countryCode);

  const rank = country ? sorted.indexOf(country) + 1 : 0;
  const netPct = country ? parseRefundRatePercent(country.refundRate) : 0;
  const vatPct = country ? parseVatRatePercent(country.vatRate) : 0;

  const regionPeers = useMemo(() => {
    if (!country) return [];
    return sorted.filter((c) => c.region === country.region && c.code !== country.code).slice(0, 4);
  }, [country, sorted]);

  const topFive = useMemo(() => sorted.slice(0, 5).filter((c) => c.code !== countryCode), [sorted, countryCode]);

  const compareTarget = useMemo(() => {
    if (!country) return sorted[1];
    const idx = sorted.indexOf(country);
    return sorted[idx === 0 ? 1 : 0];
  }, [country, sorted]);

  if (!country) {
    return (
      <div className="atlys-index-page min-h-screen bg-black gem-sans text-white">
        <AtlysIndexNavbar onLogoClick={onBack} />
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <p className="text-white/50">Country not found.</p>
          <button type="button" onClick={onBack} className="mt-6 text-sm text-white underline">
            Back to ranking
          </button>
        </div>
      </div>
    );
  }

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
    <div className="atlys-index-page relative min-h-screen w-full overflow-hidden bg-black pb-20 gem-sans text-white">
      <AtlysIndexNavbar onLogoClick={onBack} />

      <div className="mx-auto max-w-[1140px] px-5 pt-5 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-white/40">
          <button type="button" onClick={onBack} className="hover:text-white/65">
            Gemetra
          </button>
          <span className="mx-1.5">/</span>
          <button type="button" onClick={onBack} className="hover:text-white/65">
            VAT Refunds
          </button>
          <span className="mx-1.5">/</span>
          <span className="text-white/55">{country.name}</span>
        </nav>

        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white/75"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ranking
        </button>
      </div>

      <section className="px-5 pb-12 pt-8 sm:px-8">
        <div className="mx-auto grid max-w-[1140px] gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-14">
          {/* Passport visual */}
          <div>
            <div className="atlys-detail-passport-frame mx-auto max-w-[280px] lg:mx-0">
              <PassportCoverImage
                passportName={country.passportName}
                alt={`${country.name} passport`}
                className="h-auto w-full rounded-l-md rounded-r-2xl object-cover shadow-2xl"
                loading="eager"
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
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
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
              >
                <Globe2 className="h-3.5 w-3.5" />
                Refund guide
              </button>
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="atlys-detail-badge">
                <Sparkles className="h-3 w-3" />
                {country.tier} destination
              </span>
              <span className="atlys-detail-badge">{country.region.toUpperCase()}</span>
            </div>

            <h1 className="atlys-index-heading mt-4 text-[2.25rem] text-white sm:text-[2.75rem]">
              {country.name}
            </h1>
            <p className="mt-1 text-sm font-medium uppercase tracking-[0.18em] text-white/35">
              {country.refundType} · 2026
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="atlys-detail-stat">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Global rank</p>
                <p className={`atlys-index-heading mt-2 text-3xl ${rank === 1 ? 'atlys-rank-gold' : 'text-white'}`}>
                  #{rank}
                </p>
              </div>
              <div className="atlys-detail-stat">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Refund score</p>
                <p className="atlys-index-heading mt-2 text-3xl text-white">{country.score}</p>
              </div>
              <div className="atlys-detail-stat">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Net refund</p>
                <p className="atlys-index-heading mt-2 text-3xl text-white">{netRefundShort(country.refundRate)}</p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Refund breakdown</p>
              <div className="mt-4">
                <RefundBreakdownBar vatPct={vatPct} netPct={netPct} />
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-white/45">
              As of 2026, {country.name} ranks #{rank} in the Gemetra VAT Refund Index with a score of {country.score}.
              Tourists typically receive {netRefundShort(country.refundRate)} back on eligible purchases after{' '}
              {country.operators.join(' / ')} fees — statutory {country.vatRate} VAT applies at checkout.
              Minimum spend: {country.minSpend}. {country.exportDeadline}.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
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
      </section>

      {/* Requirements */}
      <section className="border-t border-white/[0.06] px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[1140px] gap-6 lg:grid-cols-2">
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
            <p className="mt-4 text-xs text-white/35">
              Operators: {country.operators.join(', ')}
            </p>
          </div>
        </div>
      </section>

      {/* Related */}
      {regionPeers.length > 0 && (
        <section className="px-5 py-10 sm:px-8">
          <div className="mx-auto max-w-[1140px]">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="atlys-index-heading text-xl text-white sm:text-2xl">
                More from {country.region}
              </h2>
              <button type="button" onClick={onBack} className="text-sm text-white/40 hover:text-white/65">
                View all →
              </button>
            </div>
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
        </section>
      )}

      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-[1140px]">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="atlys-index-heading text-xl text-white sm:text-2xl">Top 5 in the world</h2>
            <button type="button" onClick={onBack} className="text-sm text-white/40 hover:text-white/65">
              View all →
            </button>
          </div>
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
      </section>
    </div>
  );
};

export default VATCountryDetailPage;
