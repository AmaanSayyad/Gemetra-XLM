import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VAT_COUNTRIES, netRefundShort, type VatCountry } from './atlysAssets';
import { PassportCoverImage } from './PassportCoverImage';

interface PassportCarouselProps {
  sortedCountries?: VatCountry[];
  onSelectCountry?: (country: VatCountry) => void;
  onViewReport?: (country: VatCountry) => void;
}

const SLOTS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** Exact Atlys passport-index coverflow transforms (measured from atlys.com DOM). */
function atlysSlideStyle(offset: number): React.CSSProperties {
  const abs = Math.abs(offset);

  if (offset === 0) {
    return {
      transform: 'translateX(calc(-50% + 0px)) translateY(-50%) scale(1.18)',
      opacity: 1,
      zIndex: 20,
    };
  }

  const tx = abs === 1 ? 175 : abs === 2 ? 350 : 525;
  const translateX = offset < 0 ? -tx : tx;
  // Atlys caps rotation at ±18° (adjacent) and ±36° (outer two rings — same angle).
  const rotateY = Math.sign(offset) * (abs === 1 ? 18 : 36);
  const scale = abs === 1 ? 0.92 : abs === 2 ? 0.84 : 0.76;
  const opacity = abs === 1 ? 0.72 : abs === 2 ? 0.44 : 0.16;

  return {
    transform: `translateX(calc(-50% + ${translateX}px)) translateY(-50%) translateZ(${-90 * abs}px) scale(${scale}) rotateY(${rotateY}deg)`,
    opacity,
    zIndex: 20 - abs,
  };
}

/** Atlys coverflow — 7-slot 3D passport fan with exact transform math */
export const PassportCarousel: React.FC<PassportCarouselProps> = ({
  sortedCountries = VAT_COUNTRIES,
  onSelectCountry,
  onViewReport,
}) => {
  const defaultIndex = useMemo(() => {
    const idx = sortedCountries.findIndex((c) => c.code === 'AE');
    return idx >= 0 ? idx : 0;
  }, [sortedCountries]);

  const [selected, setSelected] = useState(defaultIndex);

  const len = sortedCountries.length;
  const goPrev = () => setSelected((s) => (s - 1 + len) % len);
  const goNext = () => setSelected((s) => (s + 1) % len);
  const pickOffset = (offset: number) => {
    const next = (selected + offset + len) % len;
    setSelected(next);
    onSelectCountry?.(sortedCountries[next]);
  };

  const current = sortedCountries[selected] ?? sortedCountries[0];
  const rank = current ? sortedCountries.indexOf(current) + 1 : 1;

  return (
    <div className="relative w-full">
      <div className="relative w-full">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous passport"
          className="absolute left-2 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur transition hover:bg-white/15 active:scale-95 sm:left-6"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="relative h-[360px] w-full select-none [perspective:1400px] sm:h-[460px]">
          {SLOTS.map((offset) => {
            const country = sortedCountries[(selected + offset + len) % len];
            return (
              <div
                key={`${offset}-${country.code}`}
                className="absolute left-1/2 top-1/2 h-[260px] w-[185px] origin-center will-change-[transform,opacity] sm:h-[340px] sm:w-[240px]"
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.55s ease',
                  ...atlysSlideStyle(offset),
                }}
              >
                <div
                  role="button"
                  tabIndex={offset === 0 ? -1 : 0}
                  className="relative h-full w-full cursor-pointer"
                  style={{ filter: 'drop-shadow(0 25px 35px rgba(0, 0, 0, 0.6))' }}
                  onClick={() => {
                    if (offset !== 0) pickOffset(offset);
                  }}
                  onKeyDown={(e) => {
                    if (offset !== 0 && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      pickOffset(offset);
                    }
                  }}
                  aria-label={offset === 0 ? `${country.name} passport` : `View ${country.name}`}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-l-md rounded-r-2xl ring-1 ring-black/40">
                    <PassportCoverImage
                      passportName={country.passportName}
                      alt={`${country.name} passport`}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="Next passport"
          className="absolute right-2 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur transition hover:bg-white/15 active:scale-95 sm:right-6"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {current && (
        <div className="relative mx-auto max-w-lg px-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Now viewing</p>
          <h2 className="atlys-index-heading mt-3 text-[2rem] text-white sm:text-[2.5rem]">{current.name}</h2>

          <div className="mt-8 grid grid-cols-3 gap-4 sm:gap-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Rank</p>
              <p className={`atlys-index-heading mt-2 text-3xl sm:text-4xl ${rank === 1 ? 'atlys-rank-gold' : 'text-white'}`}>
                #{rank}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Score</p>
              <p className="atlys-index-heading mt-2 text-3xl text-white sm:text-4xl">{current.score}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Net refund</p>
              <p className="atlys-index-heading mt-2 text-2xl text-white sm:text-4xl">{netRefundShort(current.refundRate)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => current && (onViewReport ?? onSelectCountry)?.(current)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
          >
            View full report
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
