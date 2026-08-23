import React, { useMemo, useRef } from 'react';
import { countryBg, countryFlag, countryVideo, type VatCountry } from './atlysAssets';

interface CountryExploreCardProps {
  country: VatCountry;
  onClick?: () => void;
  selected?: boolean;
}

function guaranteeDate() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function displayName(name: string) {
  if (name === 'United Arab Emirates') return 'UAE';
  if (name.startsWith('Northern Ireland')) return 'N. Ireland';
  return name.replace('United ', '');
}

/** Atlys homepage card — video on hover, blur panel expand, guarantee footer */
export const CountryExploreCard: React.FC<CountryExploreCardProps> = ({ country, onClick, selected }) => {
  const eta = useMemo(() => guaranteeDate(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const extraDocs = Math.max(0, country.documentsRequired.length - 3);

  const playVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  const pauseVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <div className="group w-full">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={playVideo}
        onMouseLeave={pauseVideo}
        onFocus={playVideo}
        onBlur={pauseVideo}
        className={`relative aspect-[5/8] w-full cursor-pointer overflow-hidden rounded-[25px] lg:rounded-[30px] ${
          selected ? 'ring-2 ring-[var(--gem-brand)] ring-offset-2 ring-offset-white' : ''
        }`}
      >
        <img
          src={countryBg(country.code, 400)}
          alt={country.name}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-0"
          loading="lazy"
        />
        <video
          ref={videoRef}
          src={countryVideo(country.code)}
          muted
          loop
          playsInline
          preload="none"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[25px] backdrop-blur-[10px] backdrop-brightness-[60%] transition-[height] duration-400 ease-out h-[42%] group-hover:h-[88%] lg:rounded-b-[30px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 75%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 75%, transparent 100%)',
          }}
        />

        <div className="absolute inset-x-0 bottom-0 z-[1] flex max-h-full flex-col rounded-b-[25px] px-4 pb-4 shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.3)] lg:rounded-b-[30px] lg:px-6 lg:pb-6">
          <div className="shrink-0">
            <span className="mx-auto flex size-5 items-center justify-center overflow-hidden rounded-full lg:size-6">
              <img src={countryFlag(country.code)} alt="" className="size-5 lg:size-6 object-cover" loading="lazy" />
            </span>

            <p className="gem-display mt-4 text-center text-sm font-medium uppercase tracking-[0.9px] text-white lg:text-lg lg:leading-[21px]">
              {displayName(country.name)}
            </p>

            <div className="mt-2 flex w-full items-start justify-between gap-2 border-t border-white/10 pt-3 lg:mt-4 lg:pt-4">
              <div className="flex min-w-0 flex-col items-start gap-0.5 text-[9px] font-bold uppercase tracking-[1.1px] text-white lg:gap-1 lg:text-[11px]">
                <p className="opacity-45">Type</p>
                <p className="truncate">{country.refundType}</p>
              </div>
              <div className="flex min-w-0 max-w-[58%] flex-col items-end gap-0.5 text-[9px] font-bold uppercase tracking-[1.1px] text-white lg:max-w-[55%] lg:gap-1 lg:text-[11px]">
                <p className="opacity-45">Min spend</p>
                <p className="line-clamp-2 text-right normal-case leading-snug" title={country.minSpend}>
                  {country.minSpend}
                </p>
              </div>
            </div>
          </div>

          <div className="pointer-events-none mt-0 max-h-0 min-h-0 flex-1 overflow-hidden opacity-0 transition-all duration-400 group-hover:pointer-events-auto group-hover:mt-3 group-hover:max-h-[52%] group-hover:opacity-100 max-lg:group-focus-within:pointer-events-auto max-lg:group-focus-within:mt-3 max-lg:group-focus-within:max-h-[52%] max-lg:group-focus-within:opacity-100">
            <div className="flex h-full min-h-0 flex-col border-t border-white/10 pt-3">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-none">
                <p className="text-[9px] font-bold uppercase tracking-[1.1px] text-white opacity-45 lg:text-[11px]">
                  Net refund · VAT {country.vatRate}
                </p>
                <p className="mt-1 text-left text-[10px] font-semibold text-white lg:text-xs">
                  {country.refundRate}
                </p>

                <p className="mt-3 text-[9px] font-bold uppercase tracking-[1.1px] text-white opacity-45 lg:text-[11px]">
                  Documents
                </p>
                <ul className="mt-1.5 space-y-1 text-left text-[10px] font-medium leading-snug text-white/95 lg:text-[11px]">
                  {country.documentsRequired.slice(0, 3).map((doc) => (
                    <li key={doc} className="flex gap-1.5">
                      <span className="shrink-0 opacity-50">·</span>
                      <span>{doc}</span>
                    </li>
                  ))}
                  {extraDocs > 0 && (
                    <li className="text-white/55">+{extraDocs} more on detail page</li>
                  )}
                </ul>

                <p className="mt-3 text-[9px] font-bold uppercase tracking-[1.1px] text-white opacity-45 lg:text-[11px]">
                  Export by
                </p>
                <p className="mt-1 text-left text-[10px] font-medium leading-snug text-white/90 lg:text-[11px]">
                  {country.exportDeadline}
                </p>

                <p className="mt-3 text-[9px] font-bold uppercase tracking-[1.1px] text-white opacity-45 lg:text-[11px]">
                  Operators
                </p>
                <p className="mt-1 text-left text-[10px] font-medium leading-snug text-white/90 lg:text-[11px]">
                  {country.operators.slice(0, 2).join(' · ')}
                  {country.operators.length > 2 ? ` +${country.operators.length - 2}` : ''}
                </p>
              </div>

              <div className="mt-3 shrink-0 border-t border-white/15 pt-3">
                <div className="flex w-full items-center justify-center rounded-[30px] bg-white/10 px-2 py-1.5 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold text-white lg:text-xs">Get refund in XLM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className="mt-3 px-1">
        <p className="text-[11px] font-medium text-[var(--gem-text-muted)] lg:text-xs">Guaranteed Refund On</p>
        <p className="text-sm font-bold text-[var(--gem-text)] lg:text-base">{eta}</p>
      </div>
    </div>
  );
};
