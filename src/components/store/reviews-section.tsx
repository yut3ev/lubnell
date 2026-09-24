'use client';

import { useRef, useState } from 'react';
import { Quote, BadgeCheck } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Reveal } from '@/components/store/reveal';

export interface ReviewCardData {
  id: string;
  name: string;
  text: string;
  rating: number;
  productNameAr: string | null;
  productNameEn: string | null;
}

// U12-REVIEWS — owner's approved target has NO star row: just the quote mark,
// the review text, then the verified buyer footer.
//
// U23-REVIEWS-SWIPE — the owner asked for a compact section («مش هيقعد
// يسكرول لتحت»): below sm the cards now live in a horizontal snap carousel
// (one card + a peek of the next, progress bar underneath) instead of a tall
// one-column stack — the section drops from ~1270px to under 400px on a
// 390px phone. sm+ keeps the approved 2/3-column grid; both modes share one
// DOM tree (flex scroll switches to grid at sm).

export function ReviewsSection({ reviews }: { reviews: ReviewCardData[] }) {
  const { ar, t } = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Scroll progress → active card (proportional mapping is direction-proof:
  // RTL browsers report negative scrollLeft, abs() handles them all).
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const span = el.scrollWidth - el.clientWidth;
    if (span <= 0) {
      setActive(0);
      return;
    }
    const idx = Math.round((Math.abs(el.scrollLeft) / span) * (reviews.length - 1));
    setActive(Math.max(0, Math.min(reviews.length - 1, idx)));
  };

  return (
    <section className="w-full bg-secondary/30 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
        <div className="text-center">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{t.reviewsTitle}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.reviewsSub}</p>
        </div>
        </Reveal>

        <Reveal delay={80} className="mt-6 sm:mt-8">
        <div
          ref={trackRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label={t.reviewsTitle}
          className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-3"
        >
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="flex w-[80vw] max-w-[320px] shrink-0 snap-start flex-col gap-3.5 rounded-3xl border border-border/60 bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-md hover:shadow-primary/5 sm:w-auto sm:max-w-none sm:gap-4 sm:p-6"
            >
              <div className="flex items-start justify-start">
                <Quote className="h-5 w-5 text-primary/30" aria-hidden />
              </div>

              <blockquote className="flex-1 text-sm leading-relaxed text-foreground/85">
                {r.text}
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t border-border/50 pt-4">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary"
                  aria-hidden
                >
                  {r.name.trim().charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <span className="truncate">{r.name}</span>
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {(ar ? r.productNameAr : r.productNameEn) ?? t.verifiedBuyer}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        </Reveal>

        {/* mobile-only swipe progress — communicates «there's more, swipe»
            without costing a second row of cards */}
        {reviews.length > 1 && (
          <div className="mx-auto mt-4 h-1 w-24 overflow-hidden rounded-full bg-border sm:hidden" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-transform duration-300"
              style={{
                width: `${100 / reviews.length}%`,
                transform: `translateX(${(ar ? -1 : 1) * active * 100}%)`,
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
