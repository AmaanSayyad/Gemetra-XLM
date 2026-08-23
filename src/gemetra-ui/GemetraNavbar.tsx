import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { GemetraLogo } from './GemetraLogo';

interface GemetraNavbarProps {
  onNavigate?: (id: string) => void;
  searchSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  variant?: 'light' | 'dark';
}

/** Atlys-style header: logo + guarantee | search | profile/actions */
export const GemetraNavbar: React.FC<GemetraNavbarProps> = ({
  onNavigate,
  searchSlot,
  rightSlot,
  variant = 'light',
}) => {
  const isDark = variant === 'dark';

  return (
    <header
      className={`sticky top-0 z-50 w-full ${
        isDark ? 'bg-[var(--gem-ink)]/95' : 'bg-white'
      }`}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => onNavigate?.('top')} className="flex shrink-0 items-center gap-3">
          <GemetraLogo showTagline={false} variant={isDark ? 'light' : 'dark'} />
          <span className={`hidden h-6 w-px sm:block ${isDark ? 'bg-white/15' : 'bg-[var(--gem-border)]'}`} />
          <span
            className={`hidden items-center gap-1.5 sm:flex ${
              isDark ? 'text-white/80' : 'text-[var(--gem-text)]'
            }`}
          >
            <ShieldCheck className={`h-4 w-4 ${isDark ? 'text-[var(--gem-lime)]' : 'text-[var(--gem-brand)]'}`} />
            <span className="max-w-[120px] text-[11px] font-semibold leading-tight">
              Refunds On Time Guaranteed
            </span>
          </span>
        </button>

        {searchSlot && <div className="ml-auto flex flex-1 justify-end lg:max-w-md">{searchSlot}</div>}

        {rightSlot && <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>}
      </div>
    </header>
  );
};
