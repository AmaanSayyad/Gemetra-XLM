import React from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: string;
}

interface GemetraTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const GemetraTabs: React.FC<GemetraTabsProps> = ({ tabs, activeTab, onChange, className }) => (
  <div className={clsx('flex flex-wrap items-center gap-1 border-b border-[var(--gem-border)]', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onChange(tab.id)}
        className={clsx(
          'gem-sans relative px-4 py-3 text-sm font-medium transition-colors',
          activeTab === tab.id ? 'text-[var(--gem-text)]' : 'text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
        )}
      >
        {tab.label}
        {activeTab === tab.id && (
          <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[var(--gem-brand)]" />
        )}
      </button>
    ))}
  </div>
);
