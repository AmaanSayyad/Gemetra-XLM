import React, { useEffect, useState } from 'react';
import { Clock, Receipt, Wallet } from 'lucide-react';
import { DocumentUploadHero } from './DocumentUploadHero';
import { HeroRefundCard } from './HeroRefundCard';
import { ProcessRoadmap } from './ProcessRoadmap';
import { ReviewsCarousel } from './ReviewsCarousel';
import { VisaStyleTabs } from './VisaStyleTabs';
import type { VatCountry } from './vatCountries';

const DETAIL_TABS = [
  { id: 'info', label: 'Refund Info' },
  { id: 'documents', label: 'Documents' },
  { id: 'process', label: 'Refund Process' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'faq', label: 'FAQs' },
];

const exploreFaqs = [
  { q: 'How fast do I receive my VAT refund?', a: 'Most refunds settle in XLM within seconds after validation. You see an exact ETA before you submit.' },
  { q: 'Which countries are supported?', a: 'We cover 50+ destinations with active tourist VAT refund schemes — EU, Middle East, Asia, and more.' },
  { q: 'Do I need a Stellar wallet?', a: 'Yes — connect Freighter or Albedo. Refunds land directly in your wallet as XLM on mainnet.' },
  { q: 'What documents do I need?', a: 'Typically a tax-free receipt and passport. Upload a photo — we extract VAT amount automatically.' },
];

interface CountryExploreDetailProps {
  country: VatCountry;
  onTabChange?: (tabId: string) => void;
  activeTab?: string;
  onStartApplication?: () => void | Promise<void>;
}

/** Atlys explore detail block — hero + sticky tabs + tab panels, same page */
export const CountryExploreDetail: React.FC<CountryExploreDetailProps> = ({
  country,
  onTabChange,
  activeTab,
  onStartApplication,
}) => {
  const [detailTab, setDetailTab] = useState('info');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (activeTab) setDetailTab(activeTab);
  }, [activeTab]);

  const pickTab = (id: string) => {
    setDetailTab(id);
    onTabChange?.(id);
    document.getElementById(`explore-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="country-detail" className="scroll-mt-20">
      <section className="border-t border-[var(--gem-border)] bg-[var(--gem-surface-muted)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <HeroRefundCard country={country} onStart={() => pickTab('documents')} />
        </div>
      </section>

      <VisaStyleTabs tabs={DETAIL_TABS} activeId={detailTab} onChange={pickTab} />

      {detailTab === 'info' && (
        <section id="explore-info" className="scroll-mt-32 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[1fr_380px]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--gem-text)]">Refund Information</h2>
              <p className="mt-3 text-[var(--gem-text-muted)]">Everything you need to know before submitting your claim.</p>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Clock, label: 'Settlement', value: '< 5 seconds' },
                  { icon: Receipt, label: 'Min. purchase', value: country.minSpend },
                  { icon: Wallet, label: 'Payout asset', value: 'XLM mainnet' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-[20px] bg-[var(--gem-surface-muted)] p-6">
                    <Icon className="mb-3 h-5 w-5 text-[var(--gem-text-muted)]" />
                    <p className="text-xs font-medium text-[var(--gem-text-muted)]">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--gem-text)]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:sticky lg:top-36 lg:self-start">
              <div className="rounded-[24px] border border-[var(--gem-border)] bg-white p-6 shadow-[0_8px_40px_-16px_rgba(0,0,0,0.12)]">
                <h3 className="font-semibold text-[var(--gem-text)]">{country.name}</h3>
                <div className="mt-4 space-y-2 border-t border-[var(--gem-border)] pt-4 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-[var(--gem-text-muted)]">Net refund</span><span className="font-medium text-right">{country.refundRate}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-[var(--gem-text-muted)]">VAT / GST</span><span className="font-medium">{country.vatRate}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-[var(--gem-text-muted)]">Export by</span><span className="font-medium text-right text-xs">{country.exportDeadline}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-[var(--gem-text-muted)]">Operators</span><span className="font-medium text-right text-xs">{country.operators.join(', ')}</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {detailTab === 'documents' && (
        <div id="explore-documents" className="scroll-mt-32">
          <DocumentUploadHero passportName={country.passportName} onStartApplication={onStartApplication} />
        </div>
      )}
      {detailTab === 'process' && <div id="explore-process" className="scroll-mt-32"><ProcessRoadmap /></div>}
      {detailTab === 'reviews' && <div id="explore-reviews" className="scroll-mt-32"><ReviewsCarousel /></div>}

      {detailTab === 'faq' && (
        <section id="explore-faq" className="scroll-mt-32 bg-[var(--gem-surface-muted)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight">Questions, answered</h2>
            <div className="space-y-3">
              {exploreFaqs.map((faq, i) => (
                <div key={faq.q} className="overflow-hidden rounded-[20px] border border-[var(--gem-border)] bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-6 py-5 text-left text-sm font-medium"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    {faq.q}
                    <span className="text-[var(--gem-brand)]">{openFaq === i ? '−' : '+'}</span>
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-[var(--gem-border)] px-6 py-4 text-sm leading-relaxed text-[var(--gem-text-muted)]">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
