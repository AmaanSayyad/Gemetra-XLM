import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { GemetraLogo } from './GemetraLogo';
import { GEMETRA_LINKS } from '../config/links';

export type FooterNavigateAction =
  | 'explore'
  | 'index'
  | 'guarantee'
  | 'documents'
  | 'reviews'
  | 'ai-assistant';

type FooterLink = {
  label: string;
  href?: string;
  action?: FooterNavigateAction;
  external?: boolean;
};

const ECOSYSTEM_LINKS = [
  { label: 'Freighter', href: 'https://www.freighter.app/' },
  { label: 'Albedo', href: 'https://albedo.link/' },
  { label: 'Horizon', href: 'https://horizon.stellar.org/' },
  { label: 'Stellar Expert', href: 'https://stellar.expert/' },
] as const;

const companyLinks: FooterLink[] = [
  { label: 'Careers', href: 'mailto:amaansayyad2001@gmail.com?subject=Careers%20at%20Gemetra' },
  { label: 'GitHub', href: GEMETRA_LINKS.github, external: true },
  { label: 'X', href: GEMETRA_LINKS.x, external: true },
  { label: 'Transparency', action: 'guarantee' },
  { label: 'Status', href: 'https://status.stellar.org/', external: true },
  { label: 'Partners', href: 'mailto:amaansayyad2001@gmail.com?subject=Gemetra%20Partnership' },
];

const productLinks: FooterLink[] = [
  { label: 'VAT Refund', action: 'explore' },
  { label: 'Country Index', action: 'index' },
  { label: 'Receipt Guide', action: 'documents' },
  { label: 'Stellar Payouts', href: 'https://stellar.org/use-cases/payments', external: true },
  { label: 'AI Assistant', action: 'ai-assistant' as const },
];

const resourceLinks: FooterLink[] = [
  {
    label: 'Demo Video',
    href: GEMETRA_LINKS.demo,
    external: true,
  },
  {
    label: 'Documentation',
    href: GEMETRA_LINKS.readme,
    external: true,
  },
  {
    label: 'Pitch Deck',
    href: GEMETRA_LINKS.deck,
    external: true,
  },
  {
    label: 'Sample Receipts',
    href: GEMETRA_LINKS.sampleData,
    external: true,
  },
  { label: 'Stellar Expert', href: 'https://stellar.expert/', external: true },
  { label: 'Support', href: 'mailto:amaansayyad2001@gmail.com?subject=Gemetra%20Support' },
];

interface GemetraFooterProps {
  dark?: boolean;
  onNavigate?: (action: FooterNavigateAction) => void;
}

function linkClass(dark: boolean) {
  return `text-sm transition-colors ${
    dark ? 'text-white/50 hover:text-white' : 'text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
  }`;
}

function FooterLinkItem({
  link,
  dark,
  onNavigate,
}: {
  link: FooterLink;
  dark: boolean;
  onNavigate?: (action: FooterNavigateAction) => void;
}) {
  const className = linkClass(dark);

  if (link.action && onNavigate) {
    return (
      <button type="button" onClick={() => onNavigate(link.action!)} className={`${className} text-left`}>
        {link.label}
      </button>
    );
  }

  if (link.action && !onNavigate) {
    return (
      <a href={`#${link.action}`} className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <a
      href={link.href}
      className={className}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
    >
      {link.label}
    </a>
  );
}

export const GemetraFooter: React.FC<GemetraFooterProps> = ({ dark = false, onNavigate }) => (
  <footer className={`border-t ${dark ? 'border-white/10 bg-[var(--gem-ink)] text-white' : 'border-[var(--gem-border)] bg-white'}`}>
    <div className="mx-auto max-w-[1400px] px-4 pt-16 pb-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-6">
          <button type="button" onClick={() => onNavigate?.('explore')} className="inline-block text-left">
            <GemetraLogo variant={dark ? 'light' : 'dark'} />
          </button>
          <p className={`max-w-sm text-sm leading-relaxed ${dark ? 'text-white/60' : 'text-[var(--gem-text-muted)]'}`}>
            Gemetra helps tourists reclaim VAT on purchases abroad — verified receipts, instant XLM payouts on Stellar mainnet.
          </p>

          <div>
            <p className={`mb-3 text-xs font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-[var(--gem-text-muted)]'}`}>
              Built with Stellar ecosystem
            </p>
            <div className="flex flex-wrap gap-3">
              {ECOSYSTEM_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-80 ${
                    dark ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-[var(--gem-surface-muted)] text-[var(--gem-text-muted)] hover:text-[var(--gem-text)]'
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('reviews')}
            className={`inline-flex items-center gap-2 text-sm font-medium ${dark ? 'text-white hover:text-[var(--gem-lime)]' : 'text-[var(--gem-text)] hover:text-[var(--gem-brand)]'}`}
          >
            Wall Of Love
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('reviews')}
            className={`flex items-center gap-3 text-left transition hover:opacity-80 ${dark ? '' : ''}`}
          >
            <div className="flex -space-x-2">
              {['#FDA4AF', '#C4B5FD', '#86EFAC', '#FDE047'].map((c, i) => (
                <div
                  key={c}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-[var(--gem-ink)]"
                  style={{ backgroundColor: c }}
                >
                  {['P', 'A', 'R', 'M'][i]}
                </div>
              ))}
            </div>
            <span className={`text-sm ${dark ? 'text-white/50' : 'text-[var(--gem-text-muted)]'}`}>2K+ early refunds</span>
          </button>
        </div>

        {[
          { title: 'Company', links: companyLinks },
          { title: 'Product', links: productLinks },
          { title: 'Resources', links: resourceLinks },
        ].map((col) => (
          <div key={col.title}>
            <h4 className={`mb-4 text-sm font-bold ${dark ? 'text-white/80' : 'text-[var(--gem-text)]'}`}>{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <FooterLinkItem link={link} dark={dark} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={`mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row ${dark ? 'border-white/10' : 'border-[var(--gem-border)]'}`}>
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-[var(--gem-text-muted)]'}`}>© Gemetra · Stellar mainnet · All rights reserved</p>
        <div className={`flex gap-4 text-sm ${dark ? 'text-white/40' : 'text-[var(--gem-text-muted)]'}`}>
          <a
            href="mailto:amaansayyad2001@gmail.com?subject=Gemetra%20Privacy%20Policy"
            className="hover:underline"
          >
            Privacy
          </a>
          <span>·</span>
          <a
            href={GEMETRA_LINKS.readme}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Terms
          </a>
        </div>
        <button type="button" onClick={() => onNavigate?.('explore')} aria-label="Back to top">
          <GemetraLogo showTagline={false} variant={dark ? 'light' : 'dark'} className="opacity-60" />
        </button>
      </div>
    </div>
  </footer>
);

export type { FooterLink };
