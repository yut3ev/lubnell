'use client';

// U23-CATALOG-RAIL — shared swipeable product track for full catalog pages.
// The owner: «الجزء الخاص بتاع كل المنتات طويل والمستخدم مش هيقعد يعمل
// اسكرول لحت لكل دا» — /c/all rendered 19 products in a 2-col grid ≈ 10 rows
// (~3700px) of vertical scrolling on a phone.
// U28-EDITORIAL — owner: «قسم كل المنتجات محتاج يتغير جذريًا… عايز شكل
// البطاقات يبقا زي شكل بطاقات قسم تسوقي حسب الفئة… انيمشين متحرك بشكل سلس».
// The old ProductCard (white body + full-width button) is replaced by the
// shared EditorialCard — the categories-mosaic DNA she approved for the
// offers — and the mobile rail now shows TWO cards side by side (45% each
// + a slim peek) with a staggered reveal cascade as you swipe, exactly like
// the U26c offers rail. md+ keeps the 3/4-column grid. One DOM tree,
// breakpoint-switched.

import { useRef, useState } from 'react';
import { EditorialCard } from '@/components/store/editorial-card';
import { Reveal } from '@/components/store/reveal';
import type { ProductCardData } from '@/components/store/product-card';
import { useT } from '@/lib/i18n';

export function ProductTrack({
  products,
  ariaLabel,
  className = '',
}: {
  products: ProductCardData[];
  ariaLabel: string;
  className?: string;
}) {
  const { ar } = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Direction-proof progress mapping (RTL scrollLeft is negative → abs()).
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const span = el.scrollWidth - el.clientWidth;
    if (span <= 0) {
      setActive(0);
      return;
    }
    const idx = Math.round((Math.abs(el.scrollLeft) / span) * (products.length - 1));
    setActive(Math.max(0, Math.min(products.length - 1, idx)));
  };

  return (
    <>
      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={ariaLabel}
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] focus:outline-none md:grid md:grid-cols-3 md:snap-none md:gap-4 md:overflow-visible md:pb-0 lg:grid-cols-4 ${className} [&::-webkit-scrollbar]:hidden`}
      >
        {products.map((p, i) => (
          <div
            key={p.id}
            className="w-[45%] shrink-0 snap-start md:w-auto"
          >
            {/* staggered entrance — replays as off-screen cards slide into
                view, so flipping the rail feels alive but smooth */}
            <Reveal delay={Math.min(i * 60, 300)}>
              <EditorialCard product={p} />
            </Reveal>
          </div>
        ))}
      </div>

      {/* mobile-only swipe progress — signals «there's more, swipe» */}
      {products.length > 1 && (
        <div className="mx-auto mt-4 h-1 w-24 overflow-hidden rounded-full bg-border md:hidden" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-transform duration-300"
            style={{
              width: `${100 / products.length}%`,
              transform: `translateX(${(ar ? -1 : 1) * active * 100}%)`,
            }}
          />
        </div>
      )}
    </>
  );
}
