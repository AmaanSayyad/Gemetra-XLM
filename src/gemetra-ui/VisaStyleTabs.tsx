import React from 'react';
import { GemetraButton } from './GemetraButton';
import ConnectButton from '../utils/connect-wallet';

interface VisaStyleTabsProps {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  guarantee?: string;
}

/** Atlys visa sub-navigation — underline tabs + sticky CTA */
export const VisaStyleTabs: React.FC<VisaStyleTabsProps> = ({
  tabs,
  activeId,
  onChange,
  guarantee = 'Refund guaranteed before departure',
}) => (
  <div className="sticky top-[73px] z-40 border-b border-[var(--gem-border)] bg-white/95 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <nav className="flex gap-1 overflow-x-auto py-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative shrink-0 px-4 py-4 text-sm font-medium transition-colors ${
              activeId === tab.id ? 'text-[var(--gem-text)]' : 'text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
            }`}
          >
            {tab.label}
            {activeId === tab.id && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[var(--gem-brand)]" />
            )}
          </button>
        ))}
      </nav>
      <div className="hidden shrink-0 items-center gap-4 lg:flex">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--gem-text-muted)]">{guarantee}</span>
        <div className="[&_button]:!rounded-full [&_button]:!px-6">
          <ConnectButton />
        </div>
      </div>
    </div>
  </div>
);
