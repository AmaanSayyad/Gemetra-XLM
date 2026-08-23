import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, FileText, Receipt, Wallet, X } from 'lucide-react';
import type { VatCountry } from './vatCountries';

export interface FilterState {
  refundBy: string;
  refundType: string;
  documents: string;
  payout: string;
}

export const DEFAULT_FILTERS: FilterState = {
  refundBy: 'Any Time',
  refundType: 'All Types',
  documents: 'Any Documents',
  payout: 'XLM',
};

const FILTER_CONFIG = [
  {
    key: 'refundBy' as const,
    icon: Clock,
    label: 'Refund by',
    options: ['Any Time', 'Before Departure', 'This Week'],
  },
  {
    key: 'refundType' as const,
    icon: Receipt,
    label: 'Type',
    options: ['All Types', 'Tax Free', 'VAT Refund', 'Detaxe', 'GST Refund', 'TRS'],
  },
  {
    key: 'documents' as const,
    icon: FileText,
    label: 'Documents',
    options: ['Any Documents', 'Receipt Only', 'Receipt + Passport'],
  },
  {
    key: 'payout' as const,
    icon: Wallet,
    label: 'Payout',
    options: ['XLM'],
  },
];

function isDefaultFilters(filters: FilterState) {
  return (
    filters.refundBy === DEFAULT_FILTERS.refundBy &&
    filters.refundType === DEFAULT_FILTERS.refundType &&
    filters.documents === DEFAULT_FILTERS.documents &&
    filters.payout === DEFAULT_FILTERS.payout
  );
}

function activeFilterCount(filters: FilterState) {
  let n = 0;
  if (filters.refundBy !== DEFAULT_FILTERS.refundBy) n += 1;
  if (filters.refundType !== DEFAULT_FILTERS.refundType) n += 1;
  if (filters.documents !== DEFAULT_FILTERS.documents) n += 1;
  if (filters.payout !== DEFAULT_FILTERS.payout) n += 1;
  return n;
}

interface AtlysFilterBarProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  resultCount?: number;
}

/** Atlys floating filter pill with working dropdowns */
export const AtlysFilterBar: React.FC<AtlysFilterBarProps> = ({ value, onChange, resultCount }) => {
  const [openKey, setOpenKey] = useState<keyof FilterState | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const active = activeFilterCount(value);
  const openConfig = FILTER_CONFIG.find((c) => c.key === openKey);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--gem-border)] bg-white/95 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto max-w-[1400px]" ref={barRef}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 overflow-x-auto rounded-full border border-[var(--gem-border)] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] scrollbar-none">
            {FILTER_CONFIG.map(({ key, icon: Icon, label, options }, i) => {
              const isActive = value[key] !== DEFAULT_FILTERS[key];
              return (
                <div
                  key={key}
                  className={`relative min-w-[140px] flex-1 ${i > 0 ? 'border-l border-[var(--gem-border)]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenKey(openKey === key ? null : key)}
                    className={`flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition hover:bg-[var(--gem-surface-muted)] sm:px-5 ${
                      openKey === key ? 'bg-[var(--gem-surface-muted)]' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isActive ? 'bg-[var(--gem-brand-soft)]' : 'bg-[var(--gem-surface-muted)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-[var(--gem-text)]" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-[var(--gem-text-muted)]">{label}</span>
                      <span className="block truncate text-sm font-semibold text-[var(--gem-text)]">{value[key]}</span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[var(--gem-text-muted)] transition ${
                        openKey === key ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:pl-2">
            {typeof resultCount === 'number' && (
              <span className="text-sm text-[var(--gem-text-muted)]">
                <span className="font-semibold text-[var(--gem-text)]">{resultCount}</span> countries
              </span>
            )}
            {active > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange(DEFAULT_FILTERS);
                  setOpenKey(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gem-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gem-text-muted)] transition hover:bg-[var(--gem-surface-muted)] hover:text-[var(--gem-text)]"
              >
                <X className="h-3.5 w-3.5" />
                Clear {active} filter{active === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        {openKey && openConfig && (
          <div className="mt-3 rounded-2xl border border-[var(--gem-border)] bg-white p-3 shadow-lg">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--gem-text-muted)]">
              {openConfig.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {openConfig.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, [openKey]: opt });
                    setOpenKey(null);
                  }}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    value[openKey] === opt
                      ? 'bg-[var(--gem-ink)] font-semibold text-white'
                      : 'bg-[var(--gem-surface-muted)] text-[var(--gem-text-muted)] hover:bg-[var(--gem-border)] hover:text-[var(--gem-text)]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function matchesRefundBy(country: VatCountry, refundBy: string) {
  if (refundBy === 'Any Time') return true;
  if (refundBy === 'Before Departure') {
    const blob = `${country.exportDeadline} ${country.customsValidation}`.toLowerCase();
    return (
      blob.includes('depart') ||
      blob.includes('airport') ||
      blob.includes('border') ||
      blob.includes('validate') ||
      blob.includes('customs')
    );
  }
  if (refundBy === 'This Week') {
    return country.tier === 'Elite' || country.score >= 93;
  }
  return true;
}

function matchesDocuments(country: VatCountry, documents: string) {
  if (documents === 'Any Documents') return true;

  const reqs = country.documentsRequired.map((d) => d.toLowerCase());
  const needsPassport = reqs.some((d) => d.includes('passport'));
  const needsGoods = reqs.some((d) => d.includes('goods') || d.includes('luggage') || d.includes('merchandise'));

  if (documents === 'Receipt Only') {
    return !needsGoods && country.documentsRequired.length <= 4;
  }
  if (documents === 'Receipt + Passport') {
    return needsPassport;
  }
  return true;
}

/** Apply filter state to country list */
export function applyCountryFilters(
  countries: VatCountry[],
  filters: FilterState,
  search: string,
): VatCountry[] {
  let list = [...countries];

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.refundType.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }

  if (filters.refundBy !== 'Any Time') {
    list = list.filter((c) => matchesRefundBy(c, filters.refundBy));
  }

  if (filters.refundType !== 'All Types') {
    list = list.filter((c) => c.refundType === filters.refundType);
  }

  if (filters.documents !== 'Any Documents') {
    list = list.filter((c) => matchesDocuments(c, filters.documents));
  }

  // All destinations on Gemetra settle in XLM today; payout filter reserved for future assets.
  return list;
}

export { isDefaultFilters, activeFilterCount };
