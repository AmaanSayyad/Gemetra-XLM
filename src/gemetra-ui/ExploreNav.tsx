import React from 'react';
import { Globe } from 'lucide-react';
import { ATLYS } from './atlysAssets';

interface ExploreNavProps {
  active: 'explore' | 'index';
  onExplore: () => void;
  onIndex: () => void;
}

/** Atlys Explore / Events center navigation with icon circles */
export const ExploreNav: React.FC<ExploreNavProps> = ({ active, onExplore, onIndex }) => (
  <div className="flex items-center justify-center gap-10 border-b border-[var(--gem-border)] bg-white py-3">
    <button type="button" onClick={onExplore} className="group flex flex-col items-center gap-2">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
          active === 'explore' ? 'bg-[var(--gem-surface-muted)]' : 'bg-transparent group-hover:bg-[var(--gem-surface-muted)]'
        }`}
      >
        <Globe className="h-6 w-6 text-[var(--gem-text)]" strokeWidth={1.5} />
      </span>
      <span
        className={`text-sm font-semibold pb-2 border-b-2 transition ${
          active === 'explore'
            ? 'border-[var(--gem-ink)] text-[var(--gem-text)]'
            : 'border-transparent text-[var(--gem-text-muted)]'
        }`}
      >
        Explore
      </span>
    </button>
    <button type="button" onClick={onIndex} className="group flex flex-col items-center gap-2">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
          active === 'index' ? 'bg-[var(--gem-surface-muted)]' : 'bg-transparent group-hover:bg-[var(--gem-surface-muted)]'
        }`}
      >
        <img src={ATLYS.eventIcon} alt="" className="h-7 w-7 object-contain" />
      </span>
      <span
        className={`text-sm font-semibold pb-2 border-b-2 transition ${
          active === 'index'
            ? 'border-[var(--gem-ink)] text-[var(--gem-text)]'
            : 'border-transparent text-[var(--gem-text-muted)]'
        }`}
      >
        Country Index
      </span>
    </button>
  </div>
);
