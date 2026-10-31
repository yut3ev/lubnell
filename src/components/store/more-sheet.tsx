'use client';

// MORE-SHEET-2026-10 — «المزيد من LUBNÉL» mobile bottom sheet.
//
// DESIGN SOURCE: the official reference lubnel-more.html.
// Palette (#fbeee9 / #8a3a46 / #5a2230 / #e9a9ae / #f7d9c8 / #d3e0c9 /
// #e4d8ec / #f9e7b8 / #f8d5d8 / #2b1319), typography (Aref Ruqaa + Cairo),
// hand-drawn filtered SVG icons (feTurbulence + feDisplacementMap),
// flame animation, sticker tilts, ripple effects, shine sweep, typing dots,
// grab handle drag-to-dismiss, and admin banner are ported 1:1.

import Link from 'next/link';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Aref_Ruqaa } from 'next/font/google';

const ruqaa = Aref_Ruqaa({
  weight: ['400', '700'],
  subsets: ['arabic', 'latin'],
  variable: '--font-lm-ruqaa',
  display: 'swap',
});

declare global {
  interface Window {
    LUBNEL_MORE?: { isAdmin?: boolean; adminUrl?: string };
  }
}

export type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  hasOffers?: boolean;
};

/* SVG icons from the reference lubnel-more.html */
const D: Record<string, string> = {
  fire: '<path d="M32 6c2 10 14 16 14 30a14 14 0 01-28 0c0-8 5-12 8-16 1 5 4 7 6 7 0-8-2-14 0-21z"/>',
  bag: '<path d="M10 22h44l-3 30H13z"/><path d="M22 22c0-8 4-13 10-13s10 5 10 13"/>',
  heart: '<path d="M32 54C13 40 8 30 8 22a12 12 0 0124-4 12 12 0 0124 4c0 8-5 18-24 32z"/>',
  truck: '<path d="M6 18h30v28H6zM36 28h12l9 10v8H36z"/><circle cx="17" cy="48" r="5"/><circle cx="46" cy="48" r="5"/>',
  ret: '<path d="M14 28a18 18 0 0132-8M48 8v12H36M50 36a18 18 0 01-32 8M16 56V44h12"/>',
  q: '<circle cx="32" cy="32" r="23"/><path d="M24 26c0-5 4-9 9-9s8 3 8 8c0 6-8 6-8 13M32 47v1"/>',
  chat: '<path d="M9 12h46v30H28l-12 11V42H9z"/><path d="M20 24h24M20 32h14"/>',
  dash: '<path d="M10 10h18v18H10zM36 10h18v18H36zM10 36h18v18H10zM36 36h18v18H36z"/>',
  lock: '<rect x="14" y="28" width="36" height="26" rx="4"/><path d="M22 28v-6a10 10 0 0120 0v6"/>',
  chev: '<path d="M15 6l-6 6 6 6"/>',
};

function HandIcon({ k, className }: { k: string; className?: string }) {
  return (
    <svg
      className={'d' + (className ? ' ' + className : '')}
      viewBox="0 0 64 64"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: D[k] }}
    />
  );
}

const MORE_CSS = `
.lm{--w:#8a3a46;--wd:#5a2230;--rose:#e9a9ae;--bl:#fbeee9;--peach:#f7d9c8;--sage:#d3e0c9;--lilac:#e4d8ec;--sun:#f9e7b8;--pink:#f8d5d8;--cream:#fffaf3;--ink:#3a2226;--mut:#8a6d70;--ease:cubic-bezier(.2,.8,.2,1);--spring:cubic-bezier(.34,1.56,.64,1);--hand:var(--font-lm-ruqaa,'Aref Ruqaa'),'Noto Naskh Arabic',serif;--font-sans:var(--font-cairo,Cairo),system-ui,sans-serif}
.lm-bk{position:fixed;inset:0;background:#3a1a2088;opacity:0;pointer-events:none;transition:opacity .4s,visibility 0s .4s;z-index:65;visibility:hidden}
.lm-bk.on{opacity:1;pointer-events:auto;visibility:visible;transition:opacity .4s}
.lm-sh{position:fixed;inset-inline:0;bottom:0;margin-inline:auto;width:100%;max-width:440px;z-index:66;background:var(--bl);border-radius:30px 30px 0 0;max-height:92%;display:flex;flex-direction:column;transform:translateY(105%);transition:transform .6s var(--spring),visibility 0s .6s;visibility:hidden;color:var(--ink);font-family:var(--font-sans);direction:rtl;box-sizing:border-box}
.lm-sh.on{transform:none;visibility:visible;transition:transform .6s var(--spring)}
.lm-sh.dg{transition:none}
.lm .gr{flex:none;padding:10px 0 4px;display:grid;place-items:center;cursor:grab;touch-action:none}
.lm .gr i{display:block;width:46px;height:5px;border-radius:5px;background:#dcc3bb}
.lm .sh-h{flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px 8px}
.lm .sh-h h2{margin:0;font:700 1.3rem var(--hand);color:var(--wd)}
.lm .sh-h h2 small{font:600 .8rem var(--font-sans);letter-spacing:2px;color:var(--mut);margin-inline-start:6px}
.lm .x{width:36px;height:36px;border:0;border-radius:50%;background:#fff;color:var(--wd);cursor:pointer;position:relative;box-shadow:0 6px 12px -8px #5a2230;transition:transform .5s var(--spring);display:grid;place-items:center;padding:0}
.lm .x:hover{transform:rotate(90deg)}
.lm .x::before,.lm .x::after{content:"";position:absolute;left:11px;right:11px;top:17px;height:2px;border-radius:2px;background:currentColor;transform:rotate(45deg)}
.lm .x::after{transform:rotate(-45deg)}
.lm .sc{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:2px 16px 4px;scrollbar-width:none}
.lm .sc::-webkit-scrollbar{display:none}
.lm .ft{flex:none;padding:4px 16px calc(12px + env(safe-area-inset-bottom));text-align:center}
.lm .ft p{margin:10px 0 0;font:400 1.05rem var(--hand);color:var(--w)}
.lm a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}
.lm svg.d{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:url(#lm-rf)}
.lm .it{opacity:0;transform:translateY(16px) scale(.96)}
.lm-sh.on .it{animation:lm-pop .7s var(--spring) forwards;animation-delay:calc(.25s + var(--i)*.055s)}
@keyframes lm-pop{to{opacity:1;transform:none}}
@keyframes lm-wig{25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes lm-fk{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.1,1.05) rotate(3deg)}}
@keyframes lm-dt{40%{transform:translateY(-4px);opacity:1}}
@keyframes lm-shn{40%,100%{transform:translateX(450%) skewX(-18deg)}}
.lm .rp{position:absolute;border-radius:50%;background:#e9a9ae77;pointer-events:none;width:20px;height:20px;margin:-10px 0 0 -10px;transform:scale(0);animation:lm-rpl .6s ease-out forwards}
@keyframes lm-rpl{to{transform:scale(20);opacity:0}}
.lm .lk{position:relative;overflow:hidden}
.lm .fl{color:#e0592f}
.lm .fl svg{animation:lm-fk 1.6s ease-in-out infinite}
.lm .ga{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.lm .ga .wd{grid-column:1/-1}
.lm .ga a{display:flex;align-items:center;gap:10px;padding:10px 14px;transition:transform .35s var(--spring)}
.lm .ga a:active{transform:scale(.96) rotate(-.8deg)}
.lm .ga svg.d{width:28px;height:28px;flex:none}
.lm .ga span{font:700 1.15rem/1.25 var(--hand)}
.lm .ga .o{background:linear-gradient(120deg,#f9d9bf,#f7c7b3);border-radius:22px 18px 24px 20px;min-height:56px;position:relative;overflow:hidden}
.lm .ga .o svg{width:34px;height:34px}
.lm .ga .o span{font-size:1.35rem;color:var(--wd)}
.lm .ga .o::after{content:"";position:absolute;top:0;bottom:0;width:26%;background:linear-gradient(100deg,transparent,#fff7,transparent);transform:translateX(-400%) skewX(-18deg);animation:lm-shn 4.5s 1s ease-in-out infinite}
.lm .ga .p{background:var(--w);color:#fff;border-radius:20px 22px 18px 24px;min-height:48px}
.lm .ga .t{min-height:66px;border-radius:20px 16px 22px 18px;color:var(--wd);gap:8px;padding:8px 12px}
.lm .ga .t span{font-size:1.05rem}
.lm .ga .t1{background:var(--sage);transform:rotate(-.8deg)}
.lm .ga .t2{background:var(--lilac);transform:rotate(.8deg)}
.lm .ga .t3{background:var(--sun);transform:rotate(1deg)}
.lm .ga .t4{background:var(--pink);transform:rotate(-1deg)}
.lm .ga .t svg{color:var(--w)}
.lm .ga .c{background:#fff;border-radius:18px 22px 18px 20px;border:1.5px dashed #e0b9b3;min-height:50px}
.lm .ga .c svg{color:var(--w)}
.lm .ga .dts{margin-inline-start:auto;display:flex;gap:4px}
.lm .ga .dts i{width:6px;height:6px;border-radius:50%;background:var(--rose);animation:lm-dt 1.2s infinite}
.lm .ga .dts i:nth-child(2){animation-delay:.15s}
.lm .ga .dts i:nth-child(3){animation-delay:.3s}
.lm .adm{display:flex;align-items:center;gap:10px;height:44px;margin:12px 0 0;padding:0 14px;border-radius:14px;background:#2b1319;color:#f3dcc9;font:700 .9rem var(--font-sans);box-shadow:0 10px 18px -12px #2b1319;transition:transform .35s var(--spring)}
.lm .adm:active{transform:scale(.97)}
.lm .adm svg{width:20px;height:20px;color:#e9c27a;flex:none}
.lm .adm span{flex:1}
.lm .adm em{font:700 .66rem var(--font-sans);font-style:normal;background:#e9c27a;color:#2b1319;padding:3px 9px;border-radius:99px}
@media(prefers-reduced-motion:reduce){.lm *{animation-duration:.01s!important;transition-duration:.01s!important;animation-iteration-count:1!important}.lm .it{opacity:1;transform:none}}
`;

export function MoreSheet({
  open,
  onClose,
  isAdmin = false,
  hasOffers = true,
}: MoreSheetProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const grabRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const scRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const dragY0 = useRef<number | null>(null);
  const dragT0 = useRef<number>(0);

  // Sync window.LUBNEL_MORE for testing/preview if defined, or expose actual state
  const effectiveIsAdmin =
    typeof window !== 'undefined' && window.LUBNEL_MORE?.isAdmin !== undefined
      ? Boolean(window.LUBNEL_MORE.isAdmin)
      : isAdmin;
  const adminUrl =
    typeof window !== 'undefined' && window.LUBNEL_MORE?.adminUrl
      ? window.LUBNEL_MORE.adminUrl
      : '/admin';

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.LUBNEL_MORE) {
      window.LUBNEL_MORE = { isAdmin: effectiveIsAdmin, adminUrl };
    }
  }, [effectiveIsAdmin, adminUrl]);

  // Focus trap + body scroll lock + Escape listener
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      if (scRef.current) {
        scRef.current.scrollTop = 0;
      }
      const t = setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    } else {
      document.body.style.overflow = '';
      if (prevFocusRef.current) {
        prevFocusRef.current.focus();
      }
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const sh = sheetRef.current;
        if (!sh) return;
        const focusable = sh.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Drag down gesture
  useEffect(() => {
    const g = grabRef.current;
    const sh = sheetRef.current;
    if (!g || !sh) return;

    const onPointerDown = (e: PointerEvent) => {
      dragY0.current = e.clientY;
      dragT0.current = Date.now();
      try {
        g.setPointerCapture(e.pointerId);
      } catch {}
      sh.classList.add('dg');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragY0.current === null) return;
      const d = Math.max(0, e.clientY - dragY0.current);
      sh.style.transform = `translateY(${d}px)`;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragY0.current === null) return;
      const d = e.clientY - dragY0.current;
      const v = d / (Date.now() - dragT0.current);
      sh.classList.remove('dg');
      dragY0.current = null;
      if (d > 90 || v > 0.6) {
        sh.style.transform = '';
        onClose();
      } else {
        sh.style.transform = '';
      }
    };

    g.addEventListener('pointerdown', onPointerDown);
    g.addEventListener('pointermove', onPointerMove);
    g.addEventListener('pointerup', onPointerUp);
    g.addEventListener('pointercancel', onPointerUp);

    return () => {
      g.removeEventListener('pointerdown', onPointerDown);
      g.removeEventListener('pointermove', onPointerMove);
      g.removeEventListener('pointerup', onPointerUp);
      g.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onClose]);

  // Touch ripple
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.lk');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'rp';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    target.appendChild(ripple);
    setTimeout(() => {
      ripple.remove();
    }, 650);
  };

  if (!mounted) return null;

  return createPortal(
    <div className={`lm ${ruqaa.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: MORE_CSS }} />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="lm-rf">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={4} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.4} />
          </filter>
        </defs>
      </svg>

      {/* Backdrop */}
      <div
        id="bk"
        className={`lm-bk ${open ? 'on' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <section
        id="lubnel-more-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="المزيد من لوبنيل"
        className={`lm-sh ${open ? 'on' : ''}`}
        onPointerDown={handlePointerDown}
      >
        {/* Grab bar */}
        <div className="gr" id="gr" ref={grabRef} aria-hidden="true">
          <i />
        </div>

        {/* Sheet Header */}
        <div className="sh-h it" style={{ ['--i' as string]: 0 }}>
          <h2>
            المزيد من لوبنيل<small>LUBNÉL</small>
          </h2>
          <button
            type="button"
            ref={closeBtnRef}
            className="x"
            id="cl"
            onClick={onClose}
            aria-label="إغلاق"
          />
        </div>

        {/* Scrollable grid area */}
        <div className="sc" ref={scRef}>
          <div className="ga">
            {/* If offers available: show Offers banner at the top, then All Products */}
            {hasOffers && (
              <Link
                href="/#offers"
                onClick={onClose}
                className="lk it o wd fl"
                style={{ ['--i' as string]: 1 }}
              >
                <HandIcon k="fire" />
                <span>عروض اليوم</span>
              </Link>
            )}

            {/* All Products banner */}
            <Link
              href="/c/all"
              onClick={onClose}
              className="lk it p wd"
              style={{ ['--i' as string]: hasOffers ? 2 : 1 }}
            >
              <HandIcon k="bag" />
              <span>كل المنتجات</span>
            </Link>

            {/* 4 Compact Cards */}
            <Link
              href="/info/shipping"
              onClick={onClose}
              className="lk it t t1"
              style={{ ['--i' as string]: hasOffers ? 3 : 2 }}
            >
              <HandIcon k="truck" />
              <span>الشحن والتسليم</span>
            </Link>

            <Link
              href="/info/returns"
              onClick={onClose}
              className="lk it t t2"
              style={{ ['--i' as string]: hasOffers ? 4 : 3 }}
            >
              <HandIcon k="ret" />
              <span>الاستبدال والإرجاع</span>
            </Link>

            <Link
              href="/info/faq"
              onClick={onClose}
              className="lk it t t3"
              style={{ ['--i' as string]: hasOffers ? 5 : 4 }}
            >
              <HandIcon k="q" />
              <span>الأسئلة الشائعة</span>
            </Link>

            <Link
              href="/info/about"
              onClick={onClose}
              className="lk it t t4"
              style={{ ['--i' as string]: hasOffers ? 6 : 5 }}
            >
              <HandIcon k="heart" />
              <span>عن لوبنيل</span>
            </Link>

            {/* Contact banner */}
            <Link
              href="/info/contact"
              onClick={onClose}
              className="lk it c wd"
              style={{ ['--i' as string]: hasOffers ? 7 : 6 }}
            >
              <HandIcon k="chat" />
              <span>تواصلي معنا</span>
              <span className="dts" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="ft it" style={{ ['--i' as string]: 12 }}>
          {effectiveIsAdmin && (
            <Link
              href={adminUrl}
              onClick={onClose}
              className="adm lk"
            >
              <HandIcon k="lock" />
              <span>لوحة الإدارة</span>
              <em>للإدارة فقط</em>
            </Link>
          )}
          <p>جمال يليق بكِ</p>
        </div>
      </section>
    </div>,
    document.body
  );
}
