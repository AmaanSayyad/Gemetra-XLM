import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Globe,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  AtlysIndexNavbar,
  CountryRefundDetailPanel,
  PassportCarousel,
  PassportCoverImage,
  VAT_COUNTRIES,
  REGIONS,
  getCountryByCode,
  parseRefundRatePercent,
  netRefundShort,
} from '../gemetra-ui';

interface VATIndexPageProps {
  onBack?: () => void;
  initialCountryCode?: string | null;
  onOpenExplore?: (code: string) => void;
}

const faqs = [
  {
    q: 'What does "net refund" actually mean?',
    a: 'Net refund is what you typically receive after operator and admin fees — not the full statutory VAT rate. Global Blue and Planet publish "save up to X%" figures that reflect this.',
  },
  {
    q: 'Do I need to validate at customs before leaving?',
    a: 'In most countries, yes. EU destinations require a customs stamp or electronic validation (PABLO, DIVA, OTELLO) at your last EU exit. UAE, Thailand, and Australia have their own airport kiosks or desks.',
  },
  {
    q: 'Which documents are always required?',
    a: 'Almost everywhere: original passport, tax-free form or receipt, purchased goods for inspection, and boarding pass. Some countries also require an e-Visit Pass (Singapore) or P.P.10 form (Thailand).',
  },
  {
    q: 'Why do refund rates differ from VAT rates?',
    a: 'Statutory VAT (e.g. 20% in France) is reduced by operator commission, currency conversion, and handling fees. The net refund rate is what tourists actually get back.',
  },
  {
    q: 'Can I receive my refund in XLM instead of cash?',
    a: 'Gemetra settles eligible claims in XLM on Stellar mainnet — typically within seconds after validation, compared to weeks for traditional operator refunds.',
  },
];

function netRefundDisplay(rate: string) {
  return netRefundShort(rate);
}

function shortName(name: string) {
  if (name === 'United Arab Emirates') return 'UAE';
  if (name.startsWith('Northern Ireland')) return 'N. Ireland';
  return name;
}

function rankColor(rank: number) {
  return rank === 1 ? 'atlys-rank-gold' : 'text-white/55';
}

export const VATIndexPage: React.FC<VATIndexPageProps> = ({ onBack, initialCountryCode, onOpenExplore }) => {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('All');
  const [sort, setSort] = useState<'rank' | 'rate' | 'az'>('rank');
  const [visible, setVisible] = useState(30);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedCode, setSelectedCode] = useState<string | null>(initialCountryCode ?? null);

  const selectedCountry = selectedCode ? getCountryByCode(selectedCode) : undefined;

  useEffect(() => {
    if (initialCountryCode) {
      setSelectedCode(initialCountryCode);
      requestAnimationFrame(() => {
        document.getElementById('country-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [initialCountryCode]);

  const selectCountry = (code: string) => {
    setSelectedCode(code);
    window.location.hash = `vat/${code}`;
    requestAnimationFrame(() => {
      document.getElementById('country-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const closeDetail = () => {
    setSelectedCode(null);
    window.location.hash = 'vat-index';
    document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sorted = useMemo(() => {
    const list = [...VAT_COUNTRIES];
    list.sort((a, b) => b.score - a.score);
    return list;
  }, []);

  const filtered = useMemo(() => {
    let list = [...sorted];
    if (region !== 'All') list = list.filter((c) => c.region === region);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (sort === 'rate') list.sort((a, b) => parseRefundRatePercent(b.refundRate) - parseRefundRatePercent(a.refundRate));
    else if (sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [query, region, sort, sorted]);

  const top3 = sorted.slice(0, 3);
  const top10Names = sorted.slice(0, 10).map((c) => shortName(c.name)).join(', ');
  const highestRefundCountry = useMemo(
    () => [...VAT_COUNTRIES].sort((a, b) => parseRefundRatePercent(b.refundRate) - parseRefundRatePercent(a.refundRate))[0],
    [],
  );
  const highestRefund = parseRefundRatePercent(highestRefundCountry?.refundRate ?? '0');

  const scrollToRankings = () => {
    document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="atlys-index-page relative min-h-screen w-full overflow-hidden bg-black pb-20 gem-sans text-white">
      <AtlysIndexNavbar onLogoClick={() => onBack?.()} />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1140px] px-5 pt-5 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-white/40">
          <button type="button" onClick={() => onBack?.()} className="hover:text-white/65">
            Gemetra
          </button>
          <span className="mx-1.5">/</span>
          <span className="text-white/55">VAT Refunds</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="px-5 pb-2 pt-8 sm:px-8">
        <div className="mx-auto max-w-[680px] text-center">
          <span className="atlys-index-pill mb-7">
            ✨ 2026 VAT Refund Index · Updated August 2026
          </span>
          <h1 className="atlys-index-heading text-[2.5rem] text-white sm:text-[3.25rem] lg:text-[3.75rem]">
            Where tourists get the most back
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/45 sm:text-base">
            Compare {VAT_COUNTRIES.length} destinations by net refund rate, minimum spend and global rank.
            Find yours, study the rest, and plan your next shopping trip.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={scrollToRankings}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              See full ranking
            </button>
          </div>
        </div>

        {/* Top 3 cards */}
        <div className="mx-auto mt-12 grid max-w-[960px] gap-2.5 sm:grid-cols-3 sm:gap-3">
          {top3.map((c, i) => {
            const rank = i + 1;
            const net = netRefundDisplay(c.refundRate);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => selectCountry(c.code)}
                className="atlys-top-card w-full"
              >
                <PassportCoverImage
                  passportName={c.passportName}
                  alt=""
                  className="h-[68px] w-[48px] shrink-0 rounded-[4px] object-cover shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${rankColor(rank)}`}>
                    Rank #{rank}
                  </p>
                  <h3 className="mt-0.5 truncate text-[15px] font-semibold text-white sm:text-base">{c.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-white/40">
                    Score {c.score} · {net}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Net refund</p>
                  <p className="mt-0.5 text-lg font-semibold text-white">{net}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6">
          <PassportCarousel
            sortedCountries={sorted}
            onSelectCountry={(c) => selectCountry(c.code)}
            onViewReport={(c) => selectCountry(c.code)}
          />
        </div>
      </section>

      {/* Stats cards */}
      <section className="px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[960px] gap-3 sm:grid-cols-3">
          <div className="atlys-stat-card">
            <Globe className="mb-3 h-4 w-4 text-white/35" strokeWidth={1.5} />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Total destinations tracked</p>
            <p className="atlys-index-heading mt-2 text-4xl text-white">{VAT_COUNTRIES.length}</p>
          </div>
          <div className="atlys-stat-card">
            <TrendingUp className="mb-3 h-4 w-4 text-white/35" strokeWidth={1.5} />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Highest net refund</p>
            <p className="atlys-index-heading mt-2 text-4xl text-white">{highestRefund}%</p>
            <p className="mt-1.5 text-xs text-white/40">held by {highestRefundCountry?.name}</p>
          </div>
          <div className="atlys-stat-card">
            <Sparkles className="mb-3 h-4 w-4 text-white/35" strokeWidth={1.5} />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Top 10</p>
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/50">{top10Names} …</p>
            <p className="mt-3 text-xs text-white/35">EU + Middle East destinations dominate</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">2026 Index</p>
          </div>
        </div>
      </section>

      {/* Rankings grid */}
      <section id="rankings" className="atlys-index-grid-section px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-[1140px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">2026 Index</p>
              <h2 className="atlys-index-heading mt-2 text-3xl text-white sm:text-[2.5rem]">Complete country rankings</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/40">
                All {VAT_COUNTRIES.length} destinations ranked by refund score — net rate, minimum spend, and operator coverage combined.
              </p>
            </div>
            <p className="shrink-0 text-sm text-white/35">
              Showing {Math.min(visible, filtered.length)} of {filtered.length}
            </p>
          </div>

          <label className="relative mt-8 block max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${VAT_COUNTRIES.length} countries…`}
              className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/15"
            />
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  region === r ? 'bg-white text-black' : 'border border-white/12 text-white/55 hover:bg-white/5'
                }`}
              >
                {r}
              </button>
            ))}
            <div className="atlys-sort-group ml-auto">
              {([
                ['rank', 'By rank'],
                ['rate', 'By rate'],
                ['az', 'A–Z'],
              ] as const).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    sort === s ? 'bg-white text-black' : 'text-white/55 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, visible).map((c) => {
              const rank = sorted.indexOf(c) + 1;
              const net = netRefundDisplay(c.refundRate);
              const isElite = c.tier === 'Elite';
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCountry(c.code)}
                  className={`atlys-grid-card group w-full text-left ${isElite ? 'atlys-grid-card-elite' : ''} ${
                    selectedCode === c.code ? 'ring-1 ring-white/30' : ''
                  }`}
                >
                  <PassportCoverImage
                    passportName={c.passportName}
                    alt=""
                    className="h-[52px] w-[38px] shrink-0 rounded-[3px] object-cover shadow"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${rank === 1 ? 'atlys-rank-gold' : 'text-white/40'}`}>
                      #{rank} · {c.tier}
                    </p>
                    <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                    <p className="truncate text-xs text-white/38">{c.region} · Score {c.score}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/28">Net refund</p>
                    <p className="text-xl font-semibold text-white">{net}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/45" />
                </button>
              );
            })}
          </div>

          {visible < filtered.length && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + 30)}
                className="rounded-full border border-white/15 px-7 py-3 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Show {Math.min(30, filtered.length - visible)} more
              </button>
            </div>
          )}
        </div>
      </section>

      {selectedCountry && (
        <section id="country-detail" className="scroll-mt-20 px-5 pb-10 sm:px-8">
          <div className="mx-auto max-w-[1140px]">
            <CountryRefundDetailPanel
              country={selectedCountry}
              onClose={closeDetail}
              onSelectCountry={selectCountry}
              onStartRefund={() => onOpenExplore?.(selectedCountry.code)}
            />
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">FAQ</p>
          <h2 className="atlys-index-heading mt-2 text-3xl text-white sm:text-4xl">Questions, answered</h2>
        </div>
        <div className="mx-auto mt-10 max-w-[720px] space-y-2">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="atlys-faq-item">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{faq.q}</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/50">
                  {openFaq === i ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
              {openFaq === i && (
                <p className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-sm leading-relaxed text-white/45">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-10 sm:px-8">
        <div className="atlys-cta-card mx-auto max-w-[1140px] p-8 sm:p-10">
          <h2 className="atlys-index-heading max-w-md text-2xl text-white sm:text-3xl">
            Need a refund? Get it in seconds, not weeks.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/45">
            Gemetra handles claims for {VAT_COUNTRIES.length}+ destinations — receipt upload, validation, and XLM payout on Stellar mainnet.
          </p>
          <button
            type="button"
            onClick={() => onBack?.()}
            className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Explore Gemetra
          </button>
        </div>
      </section>
    </div>
  );
};

export default VATIndexPage;
