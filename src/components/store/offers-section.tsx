'use client';

import Link from 'next/link';
import { ChevronLeft, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { Reveal } from '@/components/store/reveal';
import { EditorialCard } from '@/components/store/editorial-card';
import type { ProductCardData } from '@/components/store/product-card';

// U26c-OFFERS — owner: «النص مش بيبان كامل للمستخدم وكمان مش عايز المستخدم
// يقعد يعمل اسكرول لتحت خليهم يكونو بالجنب وهو يقلب للجنل».
//  • NAMES → line-clamp-2 with a fixed 2-line min-height so prices/chips
//    stay aligned across cards (was line-clamp-1 = cut text).
//  • MOBILE → one horizontal snap rail, TWO cards side by side (45% each
//    + a slim peek of the third) — the user flips sideways instead of
//    scrolling down a tall grid. sm+ keeps the 3/4-up grid; Studio
//    template='rail' still forces the rail on every screen.

/* U26-COUNTDOWN — ms left until local midnight (offers «end» daily).
   Returns null until mounted so SSR never mismatches the clock. */
function useMidnightCountdown(): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      setLeft(Math.max(0, end.getTime() - now.getTime()));
    };
    // rAF deferral keeps the react-compiler lint rule happy (same as Reveal)
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);
  return left;
}

function fmtCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/* U44-STRIP-FLAME — the owner asked to remove the flame badge and the
   «حتى X%» chip from this header («حوش علامة النار دي من الجزئية دي
   وجملة حتى 21%»): AnimatedFlame + the maxOff chip are gone — the header
   is now just the title, the sub-line and the live countdown pill.
   (The 🔥 label in the bottom nav is a different element and stays.) */

/* Live «ينتهي عرض اليوم خلال 05:23:45» pill — pulsing dot + tabular digits */
function CountdownPill() {
  const { ar } = useT();
  const left = useMidnightCountdown();
  return (
    <span
      title={ar ? 'ينتهي العرض منتصف الليل' : 'Offer ends at midnight'}
      className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/15"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
      </span>
      {ar ? 'ينتهي عرض اليوم خلال' : 'Ends in'}
      <span dir="ltr" className="font-bold tabular-nums tracking-tight" aria-hidden>
        {left === null ? '--:--:--' : fmtCountdown(left)}
      </span>
      <span className="sr-only">
        {ar ? 'ينتهي العرض منتصف الليل' : 'The offer ends at midnight'}
      </span>
    </span>
  );
}

// template='grid' (default): mobile 2-up grid → sm 3-up → md+ 4-up, every
// card fully visible (no more half-cut neighbour in the scroll).
// template='rail': keeps the shared U25 rail language on every screen.
export function OffersSection({
  products,
  template = 'grid',
}: {
  products: ProductCardData[];
  template?: 'grid' | 'rail';
}) {
  const { ar } = useT();
  if (!products.length) return null;

  const railAll = template === 'rail';

  return (
    <section id="offers" aria-labelledby="offers-title" className="scroll-mt-24 bg-secondary/30 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="offers-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">
                {ar ? 'عروض اليوم' : 'Today’s offers'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ar ? 'خصومات حقيقية لفترة محدودة — الكميات على قواتها.' : 'Real, limited-time discounts — while stock lasts.'}
              </p>
              <CountdownPill />
            </div>
            <Link
              href="/c/all"
              className="group inline-flex items-center gap-1 rounded-full border border-primary/30 bg-card px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-secondary active:scale-[0.97] sm:text-[13px]"
            >
              {ar ? 'شاهدي الكل' : 'View all'}
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </Reveal>

        {railAll ? (
          <Reveal delay={80} className="mt-6 sm:mt-8">
            <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {products.slice(0, 8).map((p) => (
                <div key={p.id} className="w-[calc(100%-3.5rem)] max-w-[320px] shrink-0 snap-start sm:w-[42%] sm:max-w-none lg:w-[31%]">
                  <EditorialCard product={p} />
                </div>
              ))}
            </div>
          </Reveal>
        ) : (
          /* U26c — mobile: ONE horizontal rail, 2 cards side by side (45%)
             + a slim peek; the owner flips sideways instead of scrolling a
             tall grid. sm+ becomes the 3/4-up grid. */
          <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-8 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-x-visible sm:pb-0 md:grid-cols-4 [&::-webkit-scrollbar]:hidden">
            {products.slice(0, 8).map((p, i) => (
              <div key={p.id} className="w-[45%] shrink-0 snap-start sm:w-auto">
                <Reveal delay={i * 70}>
                  <EditorialCard product={p} />
                </Reveal>
              </div>
            ))}
          </div>
        )}

        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:hidden" aria-hidden>
          <Timer className="h-3.5 w-3.5 text-accent" />
          {ar ? 'اسحبي البطاقات جانبًا للمزيد' : 'Swipe the cards for more'}
        </p>
      </div>
    </section>
  );
}
