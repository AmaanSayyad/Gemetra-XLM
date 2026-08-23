import React from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { countryHero, countryFlag, type VatCountry } from './atlysAssets';
import { GemetraButton } from './GemetraButton';
import ConnectButton from '../utils/connect-wallet';

interface HeroRefundCardProps {
  country: VatCountry;
  onStart?: () => void;
}

/** Atlys visa detail hero — dark card with destination photo + lime accent headline */
export const HeroRefundCard: React.FC<HeroRefundCardProps> = ({ country, onStart }) => (
  <motion.div
    initial={{ opacity: 0, y: 32 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="relative overflow-hidden rounded-[32px] bg-[var(--gem-ink)] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.5)]"
  >
    <img
      src={countryHero(country.code)}
      alt=""
      className="absolute inset-0 h-full w-full object-cover opacity-50"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />

    <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12 lg:p-14">
      <div>
        <div className="mb-6 flex items-center gap-3">
          <img src={countryFlag(country.code)} alt="" className="h-10 w-10 rounded-full border-2 border-white/30 object-cover" />
          <span className="text-sm font-medium text-white/70">Tourist VAT refund for</span>
        </div>

        <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
          {country.name}
          <br />
          <span className="text-[var(--gem-lime)]">paid in XLM</span>
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
          {[
            { label: 'Net refund', value: country.refundRate },
            { label: 'VAT / GST', value: country.vatRate },
            { label: 'Min spend', value: country.minSpend },
            { label: 'Export by', value: country.exportDeadline },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">{item.label}</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-white sm:text-base">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Required documents</p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/85">
            {country.documentsRequired.map((doc) => (
              <li key={doc} className="flex gap-2">
                <span className="text-[var(--gem-lime)]">·</span>
                {doc}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/50">
            {country.customsValidation}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <ConnectButton />
          <GemetraButton variant="secondary" size="lg" className="!bg-white !text-[var(--gem-ink)]" onClick={onStart}>
            Check required documents
          </GemetraButton>
        </div>
      </div>

      <div className="hidden md:flex flex-col items-end justify-start">
        <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['#FDA4AF', '#C4B5FD', '#86EFAC'].map((c) => (
                <div key={c} className="h-7 w-7 rounded-full border-2 border-[var(--gem-ink)]" style={{ backgroundColor: c }} />
              ))}
            </div>
            <Users className="h-4 w-4 text-white/70" />
          </div>
          <p className="mt-2 text-xs font-medium text-white/80">2,400+ refunds this month</p>
        </div>
      </div>
    </div>
  </motion.div>
);
