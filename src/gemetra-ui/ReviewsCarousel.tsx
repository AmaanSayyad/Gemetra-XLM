import React, { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { ATLYS } from './atlysAssets';

const reviews = [
  { initials: 'PK', name: 'Priya K.', text: 'Got my Dubai VAT back in XLM before boarding. Took under a minute to submit.', rating: 5, source: 'App Store', color: '#FDA4AF' },
  { initials: 'ML', name: 'Marcus L.', text: 'Finally a refund flow that feels modern — no paper forms at the airport.', rating: 5, source: 'Trustpilot', color: '#C4B5FD' },
  { initials: 'YT', name: 'Yuki T.', text: 'Receipt upload was simple. Stellar transaction showed up instantly in Freighter.', rating: 5, source: 'Play Store', color: '#86EFAC' },
  { initials: 'ER', name: 'Elena R.', text: 'Transparent fees and clear ETA. Exactly what tourist VAT should be.', rating: 5, source: 'App Store', color: '#FDE047' },
];

export const ReviewsCarousel: React.FC = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' }, [Autoplay({ delay: 4500 })]);
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <img src={ATLYS.laurel} alt="" className="h-10 w-10 opacity-80" />
            <h2 className="gem-serif text-4xl text-[var(--gem-text)]">4.9 Rating Across All Platforms</h2>
            <img src={ATLYS.laurel} alt="" className="h-10 w-10 scale-x-[-1] opacity-80" />
          </div>
          <p className="mt-3 text-[var(--gem-text-muted)]">Highest rating for any VAT refund platform on Stellar</p>
        </div>

        <div className="relative mt-14">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex gap-5">
              {reviews.map((r) => (
                <div key={r.name} className="min-w-0 flex-[0_0_100%] sm:flex-[0_0_48%] lg:flex-[0_0_32%]">
                  <div className="h-full rounded-[24px] border border-[var(--gem-border)] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-[var(--gem-ink)]"
                          style={{ backgroundColor: r.color }}
                        >
                          {r.initials}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--gem-text)]">{r.name}</p>
                          <p className="text-xs text-[var(--gem-text-muted)]">{r.source}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mb-3 flex gap-0.5">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[var(--gem-lime)] text-[var(--gem-lime)]" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--gem-text-muted)]">{r.text}</p>
                    <button type="button" className="mt-3 text-sm font-medium text-[var(--gem-brand)]">read more</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <button type="button" onClick={scrollPrev} className="rounded-full border border-[var(--gem-border)] p-3 transition hover:bg-[var(--gem-surface-muted)]">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={scrollNext} className="rounded-full border border-[var(--gem-border)] p-3 transition hover:bg-[var(--gem-surface-muted)]">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
