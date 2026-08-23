import React from 'react';
import { FileText, FolderOpen, Shield, Wallet } from 'lucide-react';
import { passportCover, getCountryByCode } from '../gemetra-ui/atlysAssets';

type WizardStep = 'passport' | 'upload' | 'review' | 'sign' | 'confirmation' | 'error';

interface VATRefundWizardLayoutProps {
  step: WizardStep;
  children: React.ReactNode;
  claimCountryCode?: string;
}

const STEPS = [
  { id: 'passport' as const, label: 'Passport', icon: Shield },
  { id: 'upload' as const, label: 'Receipt', icon: FolderOpen },
  { id: 'review' as const, label: 'Review', icon: FileText },
  { id: 'sign' as const, label: 'Pay', icon: Wallet },
];

function progressPercent(step: WizardStep): number {
  switch (step) {
    case 'passport':
      return 5;
    case 'upload':
      return 25;
    case 'review':
      return 50;
    case 'sign':
      return 75;
    case 'confirmation':
      return 100;
    default:
      return 0;
  }
}

function activeSidebarStep(step: WizardStep): 'passport' | 'upload' | 'review' | 'sign' {
  if (step === 'confirmation' || step === 'error') return 'sign';
  if (step === 'sign') return 'sign';
  if (step === 'review') return 'review';
  if (step === 'upload') return 'upload';
  return 'passport';
}

const HERO_COPY: Record<'passport' | 'upload', { title: string; subtitle: string }> = {
  passport: {
    title: 'Verify your passport',
    subtitle: 'Upload the bio page — we validate MRZ checksums and extract your details for the VAT claim.',
  },
  upload: {
    title: 'Upload your tax-free receipt',
    subtitle: 'Choose the country where you paid tax, then add your receipt — we calculate VAT and your XLM refund automatically.',
  },
};

/** VAT claim wizard — passport → receipt → review → pay */
export const VATRefundWizardLayout: React.FC<VATRefundWizardLayoutProps> = ({
  step,
  children,
  claimCountryCode = 'AE',
}) => {
  const sidebarStep = activeSidebarStep(step);
  const progress = progressPercent(step);
  const showHero = step === 'passport' || step === 'upload';
  const heroKey = step === 'passport' ? 'passport' : 'upload';
  const claimCountry = getCountryByCode(claimCountryCode);
  const passportSlug = claimCountry?.passportName ?? claimCountry?.name ?? 'UAE';

  return (
    <div className="gem-vat-wizard min-h-[640px] overflow-hidden rounded-[24px] bg-gradient-to-br from-[#f8f9fc] via-white to-[#eef3ff]">
      <div className="border-b border-[var(--gem-border)] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--gem-border)]">
            <div
              className="h-full rounded-full bg-[var(--gem-ink)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gem-text-muted)]">
            {progress}% completed
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-[var(--gem-border)] p-6 lg:block">
          <nav className="space-y-1">
            {STEPS.map(({ id, label, icon: Icon }) => {
              const isActive = sidebarStep === id;
              const isDone =
                (id === 'passport' && ['upload', 'review', 'sign', 'confirmation'].includes(step)) ||
                (id === 'upload' && ['review', 'sign', 'confirmation'].includes(step)) ||
                (id === 'review' && ['sign', 'confirmation'].includes(step));
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                    isActive ? 'bg-[var(--gem-brand-soft)] text-[var(--gem-brand)]' : 'text-[var(--gem-text-muted)]'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span>{label}</span>
                  {isDone && !isActive && (
                    <span className="ml-auto text-xs text-[var(--gem-success)]">✓</span>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="p-4 sm:p-8 lg:p-12">
          {showHero && (
            <div className="mx-auto mb-10 max-w-lg text-center lg:max-w-none lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--gem-text)] sm:text-3xl">
                {HERO_COPY[heroKey].title}
              </h2>
              <p className="mt-2 text-[var(--gem-text-muted)]">{HERO_COPY[heroKey].subtitle}</p>
              {step === 'upload' && claimCountry && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--gem-brand)]/25 bg-[var(--gem-brand-soft)] px-4 py-1.5 text-sm font-medium text-[var(--gem-brand)]">
                  Claiming refund in {claimCountry.name} · {claimCountry.refundType} · VAT {claimCountry.vatRate}
                </p>
              )}
              <div className="mx-auto mt-8 max-w-xs rounded-[24px] bg-white/80 p-8 shadow-sm lg:mx-0">
                <img src={passportCover(passportSlug)} alt="" className="mx-auto h-36 object-contain" />
              </div>
            </div>
          )}
          <div className="mx-auto max-w-3xl">{children}</div>
        </div>
      </div>
    </div>
  );
};

export type { WizardStep };
