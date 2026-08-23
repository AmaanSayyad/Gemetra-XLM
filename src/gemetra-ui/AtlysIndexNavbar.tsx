import React from 'react';
import { User } from 'lucide-react';
import { GemetraLogo } from './GemetraLogo';

interface AtlysIndexNavbarProps {
  onLogoClick?: () => void;
}

/** Atlys passport-index header — logo left, guarantee + profile right */
export const AtlysIndexNavbar: React.FC<AtlysIndexNavbarProps> = ({ onLogoClick }) => (
  <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/90 backdrop-blur-md">
    <div className="mx-auto flex max-w-[1140px] items-center justify-between px-5 py-4 sm:px-8">
      <button type="button" onClick={onLogoClick} className="text-left">
        <GemetraLogo showTagline={false} variant="light" />
        <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">
          Refunds on Stellar
        </span>
      </button>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15"
          aria-label="Sign in"
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
);
