import React from 'react';
import { Home, User } from 'lucide-react';

interface BottomNavProps {
  active: 'home' | 'profile';
  onHome: () => void;
  onProfile: () => void;
}

/** Atlys floating bottom nav — Home / Profile pill (mobile-first) */
export const BottomNav: React.FC<BottomNavProps> = ({ active, onHome, onProfile }) => (
  <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 md:hidden">
    <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-[var(--gem-border)] bg-white p-1.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]">
      <button
        type="button"
        onClick={onHome}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
          active === 'home' ? 'bg-[var(--gem-ink)] text-white' : 'text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
        }`}
      >
        <Home className="h-4 w-4" />
        Home
      </button>
      <button
        type="button"
        onClick={onProfile}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
          active === 'profile' ? 'bg-[var(--gem-ink)] text-white' : 'text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
        }`}
      >
        <User className="h-4 w-4" />
        My Profile
      </button>
    </nav>
  </div>
);
