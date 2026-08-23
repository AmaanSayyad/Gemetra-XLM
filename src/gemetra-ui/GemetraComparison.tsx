import React from 'react';
import { Check, X } from 'lucide-react';
import { GemetraLogo } from './GemetraLogo';

const features = [
  'Real-time refund tracking on Stellar',
  'Precise ETA — no guesswork',
  'Transparent fees in XLM',
  '100% digital receipt upload',
  'Wallet-native payouts',
  'On-chain audit trail',
];

interface GemetraComparisonProps {
  headingAlign?: 'center' | 'left';
  className?: string;
}

export const GemetraComparison: React.FC<GemetraComparisonProps> = ({
  headingAlign = 'center',
  className = '',
}) => (
  <div className={`flex h-full flex-col overflow-hidden rounded-[32px] border border-[var(--gem-border)] bg-white p-8 shadow-[0_8px_48px_-20px_rgba(0,0,0,0.08)] md:p-10 ${className}`}>
    <h2
      className={`gem-serif mb-8 text-3xl font-normal text-[var(--gem-text)] md:text-[2.25rem] ${
        headingAlign === 'left' ? 'text-left' : 'text-center'
      }`}
    >
      VAT refunds made simple and reliable
    </h2>
    <div className="flex-1 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr>
            <th className="pb-6 text-left text-sm font-medium text-[var(--gem-text-muted)]" />
            <th className="pb-6 text-center">
              <div className="mx-auto inline-flex flex-col items-center rounded-2xl bg-white px-8 py-4 shadow-[0_12px_40px_-16px_rgba(80,87,253,0.35)] ring-1 ring-[var(--gem-brand)]/20">
                <GemetraLogo showTagline={false} />
              </div>
            </th>
            <th className="pb-6 text-center text-sm font-medium text-[var(--gem-text-muted)]">Others</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature} className="border-t border-[var(--gem-border)]">
              <td className="py-4 pr-4 text-sm text-[var(--gem-text)]">{feature}</td>
              <td className="py-4 text-center">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gem-success)]/15 text-[var(--gem-success)]">
                  <Check className="h-4 w-4" />
                </span>
              </td>
              <td className="py-4 text-center">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-400">
                  <X className="h-4 w-4" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
