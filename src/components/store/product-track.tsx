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
// MG-DESK-CAROUSEL-2026-10 — owner: على الديسكتوب «كل المنتجات» بقت شريط
// رأسي طويل (~140 منتج) — استُبدل بكاروسيل أفقي من صفين (4 أعمدة ظاهرة):
// grid-auto-flow:column + grid-rows-2 على نفس الشجرة (lg+ فقط)، بأسهم
// أنيقة تتعطل عند الطرفين، سحب بالماوس، scroll-snap، أسهم الكيبورد، شريط
// مخفي، ودعم RTL/LTR. ترتيب المنتجات محفوظ (عمودي: 1 فوق 2 في العمود الأول…)
// وكل «صفحة» = الـ 8 منتجات اللي بعدها. الموبايل والتابلت زي ما هما بالظبط.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const drag = useRef({ active: false, startX: 0, startSL: 0, moved: false });
  const suppressClick = useRef(false);

  // PERF-2026-11 — «الموقع تقيل»: كان الـ SSR بيرسم كل الـ 145 كارت في الـ
  // HTML (605KB لصفحة /c/all). دلوقتي 16 كارت في السيرفر، والباقي بيركب
  // بعد الهيدريشن بـ250ms — نفس الترتيب، كل المنتجات متاحة، والفلاتر
  // بتحصل بدون remount فبتظهر كاملة فورًا.
  const INITIAL_CARDS = 16;
  const [mountLimit, setMountLimit] = useState(INITIAL_CARDS);
  useEffect(() => {
    if (mountLimit >= products.length) return;
    const t = setTimeout(() => setMountLimit(products.length), 250);
    return () => clearTimeout(t);
  }, [mountLimit, products.length]);
  const shown = products.slice(0, Math.max(mountLimit, Math.min(products.length, INITIAL_CARDS)));

  // Direction-proof progress mapping (RTL scrollLeft is negative → abs()).
  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const span = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft); // RTL: scrollLeft ≤ 0
    if (span <= 0) {
      setActive(0);
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const idx = Math.round((pos / span) * (products.length - 1));
    setActive(Math.max(0, Math.min(products.length - 1, idx)));
    // مع scroll-snap موضع الراحة النهائي ممكن يكون أقرب من span بهامش عمود
    // جزئي — فبنعتبر «النهاية» أي موضع أقل من 30% صفحة عن أقصى مدى
    const th = Math.max(60, el.clientWidth * 0.3);
    setCanPrev(pos > th);
    setCanNext(span - pos > th);
  }, [products.length]);

  useEffect(() => {
    // القياس الأولي بعد أول رسم (rAF) + إعادة القياس تلقائيًا كل ما يتغير
    // مقاس المسار (ResizeObserver يغطي حالات زي صفحات الـ streaming اللي
    // تتحول من hidden لظاهرة بعد ما تخلص — وresize النافذة كمان)
    const raf = requestAnimationFrame(sync);
    const el = trackRef.current;
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => sync());
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [sync]);

  /** صفحة واحدة للأمام (dir=1) أو للخلف (dir=-1) — بمراعاة الاتجاه. */
  function page(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const amt = el.clientWidth * 0.9 * dir * (rtl ? -1 : 1);
    el.scrollBy({ left: amt, behavior: 'smooth' });
  }

  // سحب بالماوس (الموبايل والتابلت لهم السكرول اللمسي الأصلي) — المحتوى
  // يتبع المؤشر، مع كبت النص أثناء السحب ومنع الضغطات العرضية على الكروت.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, startSL: el.scrollLeft, moved: false };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released (synthetic events) — drag still works */
    }
    el.classList.add('select-none', 'cursor-grabbing');
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollLeft = drag.current.startSL + (rtl ? dx : -dx);
  }
  function endDrag(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const el = trackRef.current;
    drag.current.active = false;
    el?.classList.remove('select-none', 'cursor-grabbing');
    try {
      el?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* nothing captured */
    }
    if (drag.current.moved) {
      suppressClick.current = true; // السحب مش ضغطة
      setTimeout(() => (suppressClick.current = false), 0);
    }
  }
  function onClickCapture(e: React.MouseEvent) {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const el = trackRef.current;
      const rtl = el ? getComputedStyle(el).direction === 'rtl' : false;
      page(rtl ? -1 : 1); // السهم يمين = تحريك العرض يمينًا بصريًا
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const el = trackRef.current;
      const rtl = el ? getComputedStyle(el).direction === 'rtl' : false;
      page(rtl ? 1 : -1);
    }
  }

  const arrowCls =
    'hidden lg:grid absolute z-10 h-11 w-11 place-items-center rounded-full bg-card/90 backdrop-blur-sm ring-1 ring-border shadow-lg text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-0 disabled:pointer-events-none top-[124px] -translate-y-1/2';

  return (
    <div className={`relative ${className}`}>
      <div
        ref={trackRef}
        onScroll={sync}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        tabIndex={0}
        aria-label={ariaLabel}
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] focus:outline-none md:grid md:grid-cols-3 md:snap-none md:gap-4 md:overflow-visible md:pb-0 lg:grid-cols-none lg:grid-rows-[repeat(2,auto)] lg:grid-flow-col lg:auto-cols-[calc((100%-3rem)/4)] lg:gap-4 lg:snap-x lg:overflow-x-auto lg:pb-2 lg:cursor-grab [&::-webkit-scrollbar]:hidden`}
      >
        {shown.map((p, i) => (
          <div
            key={p.id}
            className="w-[45%] shrink-0 snap-start md:w-auto lg:w-auto"
          >
            {/* staggered entrance — replays as off-screen cards slide into
                view, so flipping the rail feels alive but smooth */}
            <Reveal delay={Math.min(i * 60, 300)}>
              <EditorialCard product={p} />
            </Reveal>
          </div>
        ))}
      </div>

      {/* desktop arrows — MG-DESK-CAROUSEL: فوق منطقة الصورة (مش على نص
          البطاقة)، تختفي عند الأطراف، وتشتغل بالكيبورد كمان */}
      <button
        type="button"
        onClick={() => page(-1)}
        disabled={!canPrev}
        aria-label={ar ? 'المنتجات السابقة' : 'Previous products'}
        className={`${arrowCls} start-2`}
      >
        {ar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
      <button
        type="button"
        onClick={() => page(1)}
        disabled={!canNext}
        aria-label={ar ? 'المنتجات التالية' : 'More products'}
        className={`${arrowCls} end-2`}
      >
        {ar ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>

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
    </div>
  );
}
