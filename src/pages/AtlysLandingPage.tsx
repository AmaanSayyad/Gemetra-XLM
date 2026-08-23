import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, User, Clock, Shield } from 'lucide-react';
import {
  GemetraNavbar,
  GemetraFooter,
  GemetraComparison,
  CountryExploreCard,
  CountryExploreDetail,
  VideoPromoBanner,
  ExploreNav,
  AtlysFilterBar,
  BottomNav,
  DEFAULT_FILTERS,
  applyCountryFilters,
  VAT_COUNTRIES,
  getCountryByCode,
  type VatCountry,
} from '../gemetra-ui';
import ConnectButton from '../utils/connect-wallet';

interface AtlysLandingPageProps {
  onExploreIndex?: () => void;
  initialCountryCode?: string | null;
  onCountrySelected?: (code: string) => void;
  onOpenDashboard?: (tab?: string) => void;
  onStartApplication?: () => void | Promise<void>;
}

export const AtlysLandingPage: React.FC<AtlysLandingPageProps> = ({
  onExploreIndex,
  initialCountryCode,
  onCountrySelected,
  onOpenDashboard,
  onStartApplication,
}) => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [featured, setFeatured] = useState<VatCountry | null>(() => {
    if (!initialCountryCode) return null;
    return getCountryByCode(initialCountryCode) ?? null;
  });
  const [navTab, setNavTab] = useState<'explore' | 'index'>('explore');
  const [bottomNav, setBottomNav] = useState<'home' | 'profile'>('home');
  const [detailTab, setDetailTab] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyCountryFilters(VAT_COUNTRIES, filters, search),
    [search, filters],
  );

  const scrollTo = (id: string) => {
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openDetailTab = (tab: string) => {
    const country = featured ?? getCountryByCode('AE');
    if (!country) return;
    if (!featured) setFeatured(country);
    setDetailTab(tab);
    requestAnimationFrame(() => scrollTo('country-detail'));
  };

  const pickCountry = (country: VatCountry) => {
    setFeatured(country);
    onCountrySelected?.(country.code);
    window.location.hash = `explore/${country.code}`;
    requestAnimationFrame(() => scrollTo('country-detail'));
  };

  useEffect(() => {
    if (!initialCountryCode) return;
    const country = getCountryByCode(initialCountryCode);
    if (!country) return;
    setFeatured(country);
    const timer = window.setTimeout(() => scrollTo('country-detail'), 150);
    return () => window.clearTimeout(timer);
  }, [initialCountryCode]);

  return (
    <div className="min-h-screen bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0 gem-sans">
      <GemetraNavbar
        onNavigate={scrollTo}
        searchSlot={
          <label className="gem-search-pill hidden w-full sm:flex">
            <Search className="h-4 w-4 shrink-0 text-[var(--gem-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Country"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--gem-text-muted)]"
            />
            <button type="button" className="shrink-0 rounded-full p-1 hover:bg-black/5">
              <SlidersHorizontal className="h-4 w-4 text-[var(--gem-text-muted)]" />
            </button>
          </label>
        }
        rightSlot={
          <>
            {onOpenDashboard && (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="hidden rounded-full bg-[var(--gem-ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--gem-ink)]/90 sm:block"
              >
                Dashboard
              </button>
            )}
            <button type="button" className="rounded-full p-2 hover:bg-[var(--gem-surface-muted)] sm:hidden">
              <Search className="h-5 w-5" />
            </button>
            <button type="button" className="hidden rounded-full p-2 hover:bg-[var(--gem-surface-muted)] sm:block">
              <User className="h-5 w-5 text-[var(--gem-text)]" />
            </button>
            <ConnectButton variant="minimal" />
          </>
        }
      />

      <ExploreNav
        active={navTab}
        onExplore={() => setNavTab('explore')}
        onIndex={() => {
          setNavTab('index');
          onExploreIndex?.();
        }}
      />

      <AtlysFilterBar value={filters} onChange={setFilters} resultCount={filtered.length} />

      <section id="explore" className="relative z-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <label className="gem-search-pill mb-5 flex w-full sm:hidden">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Country"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-4 lg:gap-y-8">
            {filtered.map((country) => (
              <CountryExploreCard
                key={country.code}
                country={country}
                selected={featured?.code === country.code}
                onClick={() => pickCountry(country)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[var(--gem-text-muted)]">No countries match your filters.</p>
              <button
                type="button"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setSearch('');
                }}
                className="mt-4 rounded-full border border-[var(--gem-border)] px-5 py-2 text-sm font-semibold text-[var(--gem-text)] transition hover:bg-[var(--gem-surface-muted)]"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </section>

      {featured && (
        <CountryExploreDetail
          country={featured}
          activeTab={detailTab ?? undefined}
          onTabChange={setDetailTab}
          onStartApplication={onStartApplication ?? (() => onOpenDashboard?.('vat-refund'))}
        />
      )}

      <section id="guarantee" className="bg-[var(--gem-surface-muted)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <VideoPromoBanner
            countryCode={featured?.code ?? 'AE'}
            icon={Clock}
            size="lg"
            title={
              <>
                Get your refund on or before{' '}
                <span className="text-[var(--gem-lime)]">departure day</span>
              </>
            }
            subtitle="No ambiguity. Know exactly when your XLM payout arrives before you apply."
          />

          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <GemetraComparison headingAlign="left" />
            <VideoPromoBanner
              countryCode={featured?.code === 'SG' ? 'FR' : (featured?.code ?? 'SG')}
              icon={Shield}
              size="md"
              align="left"
              title={
                <>
                  Refund not on time? <span className="text-[var(--gem-lime)]">No charge.</span>
                </>
              }
              subtitle="When we miss our promise, we don't expect anything back."
            />
          </div>
        </div>
      </section>

      <GemetraFooter
        onNavigate={(action) => {
          switch (action) {
            case 'explore':
              scrollTo('explore');
              break;
            case 'index':
              onExploreIndex?.();
              break;
            case 'guarantee':
              scrollTo('guarantee');
              break;
            case 'documents':
              openDetailTab('documents');
              break;
            case 'reviews':
              openDetailTab('reviews');
              break;
            case 'ai-assistant':
              onOpenDashboard?.('ai-assistant-chat');
              break;
            default:
              break;
          }
        }}
      />

      <BottomNav
        active={bottomNav}
        onHome={() => {
          setBottomNav('home');
          scrollTo('top');
        }}
        onProfile={() => {
          setBottomNav('profile');
          if (featured) scrollTo('country-detail');
          else scrollTo('explore');
        }}
      />
    </div>
  );
};

export default AtlysLandingPage;
