'use client';

// RW-WALL-2026-10 — «آراء عميلاتنا» live horizontal reviews carousel.
//
// DESIGN SOURCE: the official reference lubnel-reviews-wall.html + mobile horizontal swipe.
// Horizontal swipe track (overflow-x: auto; scroll-snap-type: x mandatory),
// auto-scrolls to the next card every 2 seconds, user can freely swipe/drag sideways,
// note card tilts and tape styling, Aref Ruqaa title + drawn underline path,
// deterministic colors based on ID hash, sticker card for short text (<20 chars),
// live diff updates (drop in / fade out), 60s background polling + visibilitychange,
// and instant SSE sync.

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Aref_Ruqaa } from 'next/font/google';

const ruqaa = Aref_Ruqaa({
  weight: ['400', '700'],
  subsets: ['arabic', 'latin'],
  variable: '--font-rw-ruqaa',
  display: 'swap',
});

export interface ReviewCardData {
  id: string;
  name: string;
  text: string;
  rating?: number;
  productNameAr?: string | null;
  productNameEn?: string | null;
  product?: string;
  verified?: boolean;
  createdAt?: string | number | Date;
}

export interface ReviewsSectionProps {
  reviews?: ReviewCardData[];
}

export type CleanReview = {
  id: string;
  name: string;
  text: string;
  product: string;
  verified: boolean;
  createdAt: number;
};

declare global {
  interface Window {
    LUBNEL_REVIEWS_CONFIG?: {
      endpoint?: string | null;
      pollMs?: number;
      demo?: boolean;
      max?: number;
      map?: (r: any) => CleanReview;
    };
    LubnelReviews?: {
      refresh: () => Promise<void>;
    };
  }
}

const COL = ['#f7d9c8', '#e4d8ec', '#d3e0c9', '#f9e7b8', '#f8d5d8', '#d9e6ee'];

function hash(s: string | number): number {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function formatCountText(n: number): string {
  const num = toArabicNumerals(n);
  if (n === 1) return `${num} تجربة`;
  if (n === 2) return `${num} تجربتين`;
  if (n >= 3 && n <= 10) return `${num} تجارب`;
  return `${num} تجربة`;
}

const RW_CSS = `
.rw{--w:#8a3a46;--wd:#5a2230;--rose:#e9a9ae;--bl:#fbeee9;--ink:#3a2226;--mut:#8a6d70;--ease:cubic-bezier(.2,.8,.2,1);--spring:cubic-bezier(.34,1.56,.64,1);--hand:var(--font-rw-ruqaa,'Aref Ruqaa'),'Noto Naskh Arabic',serif;--font-sans:var(--font-cairo,Cairo),system-ui,sans-serif;font-family:var(--font-sans);color:var(--ink);direction:rtl}
.rw .sec{position:relative;overflow:hidden;padding:56px 0 64px;background:var(--bl)}
.rw .in{position:relative;z-index:2;max-width:1160px;margin:0 auto;padding:0 20px}
.rw .hd{text-align:center;margin-bottom:34px}
.rw .hd h2{margin:0;font:700 2.6rem/1.3 var(--hand);color:var(--wd);display:inline-block;position:relative}
.rw .hd h2 svg{position:absolute;inset-inline:-6px;bottom:-8px;width:calc(100% + 12px);height:14px;fill:none;stroke:var(--rose);stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:rw-dr 1.4s .3s var(--ease) forwards}
@keyframes rw-dr{to{stroke-dashoffset:0}}
.rw .hd p{margin:16px 0 0;color:var(--mut);font-size:1rem}
.rw .hd p b{color:var(--w)}
.rw .dc{position:absolute;pointer-events:none;color:var(--rose);fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;opacity:.35;z-index:1;filter:url(#rw-rf);animation:rw-fl 11s ease-in-out infinite alternate}
@keyframes rw-fl{from{transform:translateY(-6px) rotate(var(--r,0deg))}to{transform:translateY(8px) rotate(calc(var(--r,0deg) + 6deg))}}

/* Horizontal swipe track */
.rw .wl{display:flex;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;gap:20px;padding:26px 20px 34px;margin:0 -20px;scrollbar-width:none;touch-action:pan-x pan-y;scroll-behavior:smooth;cursor:grab;align-items:stretch}
.rw .wl:active{cursor:grabbing}
.rw .wl::-webkit-scrollbar{display:none}

.rw .nt{flex:0 0 auto;width:min(85vw,320px);scroll-snap-align:center;position:relative;padding:34px 22px 20px;background:var(--c);border-radius:8px 14px 10px 16px;box-shadow:0 18px 24px -20px #5a2230aa;transform:rotate(var(--r));transition:transform .45s var(--spring),box-shadow .3s;box-sizing:border-box;user-select:none}
@media(min-width:768px){.rw .nt{width:340px}}
.rw .nt.new{animation:rw-drop .9s var(--spring) both}
@keyframes rw-drop{from{opacity:0;transform:translateY(-40px) rotate(calc(var(--r)*4)) scale(.9)}to{opacity:1;transform:rotate(var(--r))}}
.rw .nt.st{opacity:0;animation:rw-pop .8s var(--spring) forwards;animation-delay:calc(var(--i)*.08s)}
@keyframes rw-pop{from{opacity:0;transform:translateY(26px) rotate(calc(var(--r)*3)) scale(.94)}to{opacity:1;transform:rotate(var(--r))}}
.rw .nt.done{animation:none;opacity:1}
.rw .nt.out{animation:rw-bye .55s ease-in forwards;pointer-events:none}
@keyframes rw-bye{to{opacity:0;transform:translateY(34px) rotate(calc(var(--r)*-5)) scale(.85)}}
.rw .nt:hover{transform:rotate(0) translateY(-6px);box-shadow:0 28px 30px -20px #5a2230bb}
.rw .nt::before{content:"";position:absolute;top:-10px;left:50%;width:70px;height:20px;margin-left:-35px;background:#ffffffaa;border:1px solid #fff;transform:rotate(var(--tr,-3deg))}
.rw .qm{font:700 3.4rem/.7 var(--hand);color:var(--rose);display:block;height:26px}
.rw .nt p{margin:8px 0 18px;line-height:1.95;font-size:.98rem;overflow-wrap:anywhere}
.rw .nt.s p{font:700 1.9rem/1.4 var(--hand);text-align:center;margin:10px 0 16px}
.rw .f{display:flex;align-items:center;gap:12px;border-top:1.5px dashed #0000001f;padding-top:14px}
.rw .f b{display:block;font-size:.95rem;color:var(--ink)}
.rw .av{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font:700 1.25rem var(--hand);color:var(--wd);background:#fff8;border:2px solid #fff;box-shadow:0 4px 10px -4px #5a223055}
.rw .tgp{display:inline-block;font-size:.76rem;font-weight:700;color:var(--w);background:#fff9;padding:3px 10px;border-radius:99px;border:1px dashed #d9a98f;margin-top:2px}
.rw .vf{display:inline-flex;align-items:center;gap:5px;font-size:.76rem;color:#5d7a52;font-weight:700}
.rw .vf svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}

/* Carousel navigation & dots */
.rw .nav-bar{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:20px}
.rw .nav-btn{width:36px;height:36px;border-radius:50%;background:#ffffffdd;border:1px solid #e9a9ae88;color:var(--w);display:grid;place-items:center;box-shadow:0 4px 12px -4px #5a223022;cursor:pointer;transition:all .2s var(--ease);padding:0}
.rw .nav-btn:hover{background:#ffffff;transform:scale(1.06)}
.rw .nav-btn:active{transform:scale(.94)}
.rw .dots{display:flex;align-items:center;gap:6px}
.rw .dot{height:7px;border-radius:9999px;border:none;padding:0;background:#8a3a4633;cursor:pointer;transition:all .3s var(--ease)}
.rw .dot.act{width:22px;background:var(--w)}
.rw .dot:not(.act){width:7px}
.rw .dot:not(.act):hover{background:#8a3a4666}

.rw .emp{text-align:center;color:var(--mut);padding:30px 0;font-size:1.05rem}
@media(max-width:600px){.rw .hd h2{font-size:2rem}.rw .sec{padding:40px 0 48px}}
@media(prefers-reduced-motion:reduce){.rw .nt,.rw .dc{animation:none!important;opacity:1}}
`;

export function ReviewsSection({ reviews: initialReviews = [] }: ReviewsSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Record<string, HTMLElement>>({});
  const orderRef = useRef<string[]>([]);
  const firstRef = useRef<boolean>(true);
  const busyRef = useRef<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(initialReviews.length);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const activeIdxRef = useRef<number>(0);

  // Interaction tracking for autoplay pause & resume
  const isInteractingRef = useRef<boolean>(false);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mouse drag on desktop
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartScrollLeftRef = useRef<number>(0);

  // Re-layout cards horizontally in DOM order
  const updateLayout = useCallback(() => {
    const wl = wallRef.current;
    if (!wl) return;
    wl.innerHTML = '';
    orderRef.current.forEach((id) => {
      const card = cardsRef.current[id];
      if (card) {
        wl.appendChild(card);
      }
    });
  }, []);

  // Create card DOM element strictly using textContent (XSS immune)
  const makeCardElement = (r: CleanReview): HTMLElement => {
    const h = hash(r.id);
    const a = document.createElement('article');
    a.className = 'nt' + (r.text.length < 20 ? ' s' : '');
    a.dataset.id = r.id;
    a.dataset.text = r.text;
    a.dataset.name = r.name;
    a.dataset.product = r.product;

    a.style.setProperty('--c', COL[h % COL.length]);
    a.style.setProperty('--r', `${(h % 2 ? 1 : -1) * (0.6 + (h % 3) * 0.5)}deg`);
    a.style.setProperty('--tr', `${(h % 2 ? -1 : 1) * (2 + (h % 3))}deg`);

    const q = document.createElement('span');
    q.className = 'qm';
    q.textContent = '“';

    const p = document.createElement('p');
    p.textContent = r.text;

    const f = document.createElement('div');
    f.className = 'f';

    const av = document.createElement('span');
    av.className = 'av';
    av.textContent = r.name.trim().charAt(0) || 'ل';

    const d = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = r.name;
    d.appendChild(b);

    if (r.product) {
      const s = document.createElement('span');
      s.className = 'tgp';
      s.textContent = r.product;
      d.appendChild(s);
    } else if (r.verified) {
      const v = document.createElement('span');
      v.className = 'vf';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
      svg.appendChild(path);
      v.appendChild(svg);
      v.appendChild(document.createTextNode('عميلة موثّقة'));
      d.appendChild(v);
    }

    f.appendChild(av);
    f.appendChild(d);
    a.appendChild(q);
    a.appendChild(p);
    a.appendChild(f);
    return a;
  };

  // Update card if name or text was edited
  const updateCardContent = (el: HTMLElement, r: CleanReview) => {
    el.className = 'nt' + (r.text.length < 20 ? ' s' : '') + (el.classList.contains('done') ? ' done' : '');
    el.dataset.text = r.text;
    el.dataset.name = r.name;
    el.dataset.product = r.product;

    const p = el.querySelector('p');
    if (p) p.textContent = r.text;

    const b = el.querySelector('.f b');
    if (b) b.textContent = r.name;

    const av = el.querySelector('.av');
    if (av) av.textContent = r.name.trim().charAt(0) || 'ل';
  };

  // Apply diff between current rendered cards and new list
  const applyList = useCallback((list: CleanReview[]) => {
    const ids = list.map((r) => String(r.id));
    const prev = orderRef.current.slice();
    const added = list.filter((r) => !cardsRef.current[r.id]);
    const gone = prev.filter((id) => !ids.includes(id));

    // Check if unchanged
    if (!added.length && !gone.length && !firstRef.current && ids.join(',') === prev.join(',')) {
      list.forEach((r) => {
        const c = cardsRef.current[r.id];
        if (c && (c.dataset.text !== r.text || c.dataset.name !== r.name || c.dataset.product !== r.product)) {
          updateCardContent(c, r);
        }
      });
      return;
    }

    // Removed cards
    gone.forEach((id) => {
      const el = cardsRef.current[id];
      if (!el) return;
      el.classList.add('out');
      setTimeout(() => {
        if (cardsRef.current[id]) {
          delete cardsRef.current[id];
        }
        orderRef.current = orderRef.current.filter((x) => x !== id);
        updateLayout();
        const count = orderRef.current.filter((k) => !cardsRef.current[k]?.classList.contains('out')).length;
        setTotalCount(count);
      }, 560);
    });

    // Added cards
    added.forEach((r, k) => {
      const el = makeCardElement(r);
      cardsRef.current[r.id] = el;
      if (firstRef.current) {
        el.classList.add('st');
        el.style.setProperty('--i', String(k % 4));
        el.addEventListener(
          'animationend',
          () => {
            el.classList.remove('st');
            el.classList.add('done');
          },
          { once: true }
        );
      } else {
        el.classList.add('new');
        el.addEventListener(
          'animationend',
          () => {
            el.classList.remove('new');
            el.classList.add('done');
          },
          { once: true }
        );
      }
    });

    orderRef.current = ids
      .filter((id) => cardsRef.current[id])
      .concat(gone.filter((id) => cardsRef.current[id]));
    orderRef.current = orderRef.current.filter((id, i, a) => a.indexOf(id) === i);

    updateLayout();
    const activeCount = orderRef.current.filter((k) => !cardsRef.current[k]?.classList.contains('out')).length;
    setTotalCount(activeCount);
    firstRef.current = false;
  }, [updateLayout]);

  // Convert raw review to CleanReview
  const cleanReviews = (rawList: any[], max: number, mapFn?: (r: any) => CleanReview): CleanReview[] => {
    const seen: Record<string, boolean> = {};
    const defaultMap = (r: any): CleanReview => ({
      id: String(r.id),
      name: r.name || r.customer_name || '',
      text: r.text || r.comment || r.body || '',
      product: r.product || r.productNameAr || r.productNameEn || r.product_name || r.productTitle || '',
      verified: r.verified !== undefined ? Boolean(r.verified) : true,
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : 0,
    });

    const mapper = mapFn || defaultMap;

    return rawList
      .map(mapper)
      .filter((x) => {
        if (!x || x.id == null || !x.name || !x.text || seen[x.id]) return false;
        seen[x.id] = true;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, max);
  };

  // Scroll to a specific card index
  const scrollToIndex = useCallback((index: number) => {
    const wl = wallRef.current;
    if (!wl) return;
    const cards = Array.from(wl.querySelectorAll<HTMLElement>('.nt'));
    if (!cards.length) return;
    const targetIdx = Math.max(0, Math.min(cards.length - 1, index));
    activeIdxRef.current = targetIdx;
    setActiveIndex(targetIdx);
    cards[targetIdx]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, []);

  const goToPrev = () => {
    pauseAutoPlayTemporarily();
    const total = orderRef.current.length;
    if (total <= 1) return;
    const prev = (activeIdxRef.current - 1 + total) % total;
    scrollToIndex(prev);
  };

  const goToNext = () => {
    pauseAutoPlayTemporarily();
    const total = orderRef.current.length;
    if (total <= 1) return;
    const next = (activeIdxRef.current + 1) % total;
    scrollToIndex(next);
  };

  const pauseAutoPlayTemporarily = () => {
    isInteractingRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, 3200);
  };

  // Detect which card is currently centered while user scrolls/swipes
  const handleScroll = () => {
    const wl = wallRef.current;
    if (!wl) return;
    const cards = Array.from(wl.querySelectorAll<HTMLElement>('.nt'));
    if (!cards.length) return;

    const wlRect = wl.getBoundingClientRect();
    const wlCenter = wlRect.left + wlRect.width / 2;
    let minDiff = Infinity;
    let closestIdx = 0;

    cards.forEach((card, idx) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const diff = Math.abs(cardCenter - wlCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    activeIdxRef.current = closestIdx;
    setActiveIndex(closestIdx);
    pauseAutoPlayTemporarily();
  };

  // Desktop mouse drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const wl = wallRef.current;
    if (!wl) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = wl.scrollLeft;
    pauseAutoPlayTemporarily();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const wl = wallRef.current;
    if (!wl) return;
    const dx = e.clientX - dragStartXRef.current;
    wl.scrollLeft = dragStartScrollLeftRef.current - dx;
    pauseAutoPlayTemporarily();
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      pauseAutoPlayTemporarily();
    }
  };

  // Autoplay timer effect: advance every 2000ms (~2s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isInteractingRef.current || document.hidden) return;
      const wl = wallRef.current;
      if (!wl) return;
      const cards = Array.from(wl.querySelectorAll<HTMLElement>('.nt'));
      if (cards.length <= 1) return;

      const next = (activeIdxRef.current + 1) % cards.length;
      activeIdxRef.current = next;
      setActiveIndex(next);
      cards[next]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Client fetch and live update
  useEffect(() => {
    const cfg = Object.assign(
      {
        endpoint: '/api/store/reviews',
        pollMs: 60000,
        demo: false,
        max: 24,
      },
      typeof window !== 'undefined' ? window.LUBNEL_REVIEWS_CONFIG || {} : {}
    );

    // Initial render from initialReviews
    if (initialReviews.length > 0 && firstRef.current) {
      const cleanedInitial = cleanReviews(initialReviews, cfg.max, cfg.map);
      applyList(cleanedInitial);
    }

    const fetchLatest = async () => {
      if (!cfg.endpoint) return;
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(cfg.endpoint, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.items || json.reviews || [];
          applyList(cleanReviews(list, cfg.max, cfg.map));
        }
      } catch {
        // Leave existing displayed cards undisturbed on network error
      } finally {
        busyRef.current = false;
      }
    };

    if (initialReviews.length === 0) {
      fetchLatest();
    }

    window.LubnelReviews = {
      refresh: fetchLatest,
    };

    let timer: NodeJS.Timeout | null = null;
    if (cfg.pollMs > 0) {
      timer = setInterval(() => {
        if (!document.hidden) {
          fetchLatest();
        }
      }, cfg.pollMs);
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchLatest();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        es = new EventSource('/api/store/reviews/events');
        es.onmessage = () => {
          fetchLatest();
        };
      } catch {}
    }

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (es) es.close();
    };
  }, [applyList, initialReviews]);

  return (
    <div className={`rw ${ruqaa.variable}`} ref={containerRef}>
      <style dangerouslySetInnerHTML={{ __html: RW_CSS }} />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="rw-rf">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={4} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.4} />
          </filter>
        </defs>
      </svg>

      <section className="sec" id="reviews" aria-labelledby="reviews-title">
        {/* Floating floral graphic */}
        <svg
          className="dc"
          viewBox="0 0 64 64"
          style={{ width: '130px', height: '130px', insetInlineStart: '-20px', top: '20px', ['--r' as string]: '-10deg' }}
          aria-hidden="true"
        >
          <circle cx="32" cy="30" r="5" />
          <path d="M32 25c-7-8-3-18 0-18s7 10 0 18zM32 35c-7 8-3 18 0 18s7-10 0-18zM27 30c-8-7-18-3-18 0s10 7 18 0zM37 30c8 7 18 3 18 0s-10-7-18 0z" />
        </svg>

        <div className="in">
          {/* Header */}
          <div className="hd">
            <h2 id="reviews-title">
              آراء عميلاتنا
              <svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength="1" d="M2 9 C 25 2, 55 13, 98 4" />
              </svg>
            </h2>
            <p>
              تجارب حقيقية من ناس جرّبوا لوبنيل بحب
              {totalCount > 0 && (
                <span> — <b>{formatCountText(totalCount)}</b></span>
              )}
            </p>
          </div>

          {/* Horizontal Carousel Track */}
          <div
            className="wl"
            id="wl"
            ref={wallRef}
            aria-live="polite"
            onScroll={handleScroll}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onMouseEnter={() => { isInteractingRef.current = true; }}
            onMouseLeave={() => { isInteractingRef.current = false; }}
          />

          {/* Carousel controls & pagination dots */}
          {totalCount > 1 && (
            <div className="nav-bar">
              <button
                type="button"
                onClick={goToPrev}
                className="nav-btn"
                aria-label="التقييم السابق"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="dots" aria-hidden="true">
                {Array.from({ length: Math.min(totalCount, 12) }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      pauseAutoPlayTemporarily();
                      scrollToIndex(idx);
                    }}
                    className={`dot ${activeIndex === idx ? 'act' : ''}`}
                    aria-label={`الانتقال إلى التقييم ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={goToNext}
                className="nav-btn"
                aria-label="التقييم التالي"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="emp">
              لسه مفيش آراء، كوني أول واحدة تشاركنا تجربتها.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
