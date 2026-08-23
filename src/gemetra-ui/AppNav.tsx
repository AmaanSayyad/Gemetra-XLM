import React from 'react';
import { LogOut } from 'lucide-react';
import { GemetraLogo } from './GemetraLogo';
import { GemetraButton } from './GemetraButton';
import { formatStellarAddress } from '../utils/stellar';

interface AppNavProps {
  links: { id: string; label: string }[];
  activeId: string;
  onNavigate: (id: string) => void;
  onDisconnect: () => void;
  onLogoClick?: () => void;
  walletAddress?: string | null;
  trailingSlot?: React.ReactNode;
}

/** Single app header — logo, tabs, wallet chip, points, disconnect */
export const AppNav: React.FC<AppNavProps> = ({
  links,
  activeId,
  onNavigate,
  onDisconnect,
  onLogoClick,
  walletAddress,
  trailingSlot,
}) => (
  <header className="sticky top-0 z-50 border-b border-[var(--gem-border)] bg-white">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => (onLogoClick ? onLogoClick() : onNavigate('dashboard'))}
        className="shrink-0"
      >
        <GemetraLogo showTagline={false} />
      </button>

      <nav className="hidden items-center gap-1 lg:flex">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onNavigate(link.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeId === link.id
                ? 'bg-[var(--gem-ink)] text-white'
                : 'text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
            }`}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        {walletAddress && (
          <span className="hidden rounded-full bg-[var(--gem-surface-muted)] px-3 py-1.5 font-mono text-xs text-[var(--gem-text-muted)] md:inline">
            {formatStellarAddress(walletAddress)}
          </span>
        )}
        {trailingSlot}
        <GemetraButton variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" />} onClick={onDisconnect}>
          <span className="hidden sm:inline">Disconnect</span>
        </GemetraButton>
      </div>
    </div>

    <nav className="flex gap-1 overflow-x-auto border-t border-[var(--gem-border)] px-4 py-2 lg:hidden scrollbar-none">
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          onClick={() => onNavigate(link.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            activeId === link.id
              ? 'bg-[var(--gem-ink)] text-white'
              : 'bg-[var(--gem-surface-muted)] text-[var(--gem-text-muted)]'
          }`}
        >
          {link.label}
        </button>
      ))}
    </nav>
  </header>
);
