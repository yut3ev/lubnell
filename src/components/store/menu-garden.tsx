'use client';

// MG-MENU-2026-10 — «قائمة لوبنيل» mobile drawer.
//
// DESIGN SOURCE: the official reference lubnel-menu-garden.html — variant A
// (بستان). The markup, CSS, palette (#fbeee9/#8a3a46/#5a2230/#e9a9ae/#f7d9c8/
// #d3e0c9/#2fa866), fonts (Aref Ruqaa + Cairo), the hand-drawn filtered icons
// (feTurbulence + feDisplacementMap), the branch draw/bloom/sway motion, the
// staggered item pop, the underline sweep, the ripple and the WhatsApp ring
// are ported 1:1 with the reference's exact timings. Invisible deltas only:
//   1. fonts resolve through next/font vars (--font-mg-ruqaa is this menu's
//      own Aref Ruqaa 400+700; --font-cairo is the store's Cairo) —
//      font-display: swap;
//   2. keyframes are renamed mg-* and rules scoped under .mg so they can
//      never collide with the site's;
//   3. the demo phone frame is dropped: the drawer is position:fixed
//      full-screen instead of absolute inside the frame;
//   4. a11y wiring: closed drawer is visibility:hidden (after the slide-out
//      finishes), Escape closes, body scroll locks while open, focus moves
//      to the close button on open.
//
// DATA (no hardcoded sections): shop/info links + WhatsApp href arrive as
// props from the header (the same real NAV/INFO lists the desktop nav uses,
// with the owner-editable dict labels). Each row's hand-drawn icon is picked
// from the href/label (عرايس→هدية، مكياج→أحمر شفاه، بشرة→قطرة، جسم→زهرة،
// الرئيسية→قلب، كل المنتجات→حقيبة) and unknown sections fall back to the
// flower per spec.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Aref_Ruqaa } from 'next/font/google';

const ruqaa = Aref_Ruqaa({ weight: ['400', '700'], subsets: ['arabic', 'latin'], variable: '--font-mg-ruqaa', display: 'swap' });

export type MgLink = { href: string; label: string };
export type MenuGardenProps = {
  open: boolean;
  onClose: () => void;
  shop: MgLink[];
  info: MgLink[];
  waHref: string;
};

/* الرسمات الخطية بخط اليد — نفس مسارات المرجع حرفيًا */
const D: Record<string, string> = {
  all: '<path d="M10 22h44l-3 30H13z"/><path d="M22 22c0-8 4-13 10-13s10 5 10 13"/>',
  gift: '<rect x="10" y="26" width="44" height="28" rx="3"/><rect x="7" y="18" width="50" height="9" rx="3"/><path d="M32 18v36M32 18c-5-9-15-9-13-3s13 3 13 3zM32 18c5-9 15-9 13-3s-13 3-13 3z"/>',
  lip: '<rect x="22" y="38" width="20" height="18" rx="3"/><path d="M25 38V28h14v10M27 28V16c0-4 5-9 10-10v22"/>',
  drop: '<path d="M32 7c10 12 17 20 17 29a17 17 0 01-34 0C15 27 22 19 32 7z"/><path d="M23 38a9 9 0 006 8"/>',
  flower: '<circle cx="32" cy="30" r="5"/><path d="M32 25c-7-8-3-18 0-18s7 10 0 18zM32 35c-7 8-3 18 0 18s7-10 0-18zM27 30c-8-7-18-3-18 0s10 7 18 0zM37 30c8 7 18 3 18 0s-10-7-18 0z"/>',
  heart: '<path d="M32 54C13 40 8 30 8 22a12 12 0 0124-4 12 12 0 0124 4c0 8-5 18-24 32z"/>',
};

function iconFor(href: string, label: string): string {
  const s = (href + ' ' + label).toLowerCase();
  if (href === '/' || /الرئيسية|home/.test(s)) return 'heart';
  if (/\/c\/all|كل المنتجات|all products/.test(s)) return 'all';
  if (/bridal|عرايس|بوكس/.test(s)) return 'gift';
  if (/makeup|مكياج/.test(s)) return 'lip';
  if (/skin|بشرة/.test(s)) return 'drop';
  if (/body|جسم/.test(s)) return 'flower';
  return 'flower'; // تصنيف جديد من غير رسمة → الزهرة (افتراضي المرجع)
}

function Hand({ k, className }: { k: string; className?: string }) {
  return <svg className={'d' + (className ? ' ' + className : '')} viewBox="0 0 64 64" aria-hidden dangerouslySetInnerHTML={{ __html: D[k] }} />;
}

/* فرع الورد — نفس التركيبة: ساق يترسم + أوراق تتفتح + زهور تتمايل */
function leaf(x: number, y: number, r: number, d: number) {
  return `<g transform="translate(${x} ${y}) rotate(${r})"><path class="lf" style="--d:${d}s" d="M0 0C10-14 28-14 36 0C28 12 10 12 0 0Z"/></g>`;
}
function bloom(x: number, y: number, s: number, d: number, b?: boolean) {
  const p = [0, 72, 144, 216, 288].map((r) => `<path class="pt${b ? ' b' : ''}" transform="rotate(${r})" d="M0 0C-10-6-11-22 0-26C11-22 10-6 0 0Z"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="bs" style="--d:${d}s">${p}<circle class="ct" r="5"/></g></g>`;
}
function BR() {
  return (
    <svg className="br" viewBox="0 0 110 760" preserveAspectRatio="xMidYMid slice" aria-hidden dangerouslySetInnerHTML={{ __html:
      '<path class="st" pathLength="1" d="M62 770C20 680 92 600 52 520S34 360 74 270S44 120 62 -10"/>' +
      leaf(56, 640, -150, 1.2) + leaf(60, 560, -20, 1.5) + leaf(48, 470, -160, 1.8) +
      leaf(64, 380, -10, 2) + leaf(58, 300, -155, 2.2) + leaf(70, 200, -20, 2.4) +
      bloom(52, 520, 1.1, 1.6) + bloom(74, 270, 1, 2.3, true) + bloom(58, 120, 0.8, 2.8) + bloom(66, 690, 0.7, 1.4, true)
    }} />
  );
}

/* ===== مرجع lubnel-menu-garden.html — الـ CSS منقول حرفيًا (variant A، بادئة .mg) ===== */
const MG_CSS = `
.mg{--w:#8a3a46;--wd:#5a2230;--rose:#e9a9ae;--blush:#fbeee9;--peach:#f7d9c8;--sage:#d3e0c9;--lilac:#e4d8ec;--cream:#fffaf5;--ink:#3a2226;--mut:#8a6d70;--wa:#2fa866;--ease:cubic-bezier(.2,.8,.2,1);--spring:cubic-bezier(.34,1.56,.64,1);--hand:var(--font-mg-ruqaa,'Aref Ruqaa'),'Noto Naskh Arabic',serif;--body-font:var(--font-cairo,Cairo),system-ui,sans-serif;font-family:var(--body-font);color:var(--ink)}
.mg a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}
.mg .dr{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;transform:translateX(104%);transition:transform .7s var(--ease),visibility 0s .7s;overflow:hidden;visibility:hidden}
.mg .dr.open{transform:none;visibility:visible;transition:transform .7s var(--ease)}
.mg .da{background:var(--blush)}
.mg .hd{flex:none;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;position:relative;z-index:3}
.mg .wm{font:700 1.35rem var(--hand);letter-spacing:3px;color:var(--wd)}
.mg .x{width:42px;height:42px;border:0;border-radius:50%;background:#fff8;cursor:pointer;position:relative;color:var(--wd);transition:transform .5s var(--spring),background .3s}
.mg .x:hover{transform:rotate(90deg);background:#fff}
.mg .x::before,.mg .x::after{content:"";position:absolute;left:12px;right:12px;top:20px;height:2px;border-radius:2px;background:currentColor;transform:rotate(45deg)}
.mg .x::after{transform:rotate(-45deg)}
.mg .x:focus-visible{outline:2px solid var(--rose);outline-offset:2px}
.mg .bd{flex:1;min-height:0;overflow:auto;padding:4px 24px 14px;position:relative;z-index:3;scrollbar-width:none}
.mg .bd::-webkit-scrollbar{display:none}
.mg .bd{-webkit-mask-image:linear-gradient(#000 calc(100% - 22px),transparent);mask-image:linear-gradient(#000 calc(100% - 22px),transparent);padding-bottom:26px;padding-inline-start:96px}
.mg .ft{flex:none;padding:12px 22px calc(18px + env(safe-area-inset-bottom));position:relative;z-index:3}
.mg .wa{display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border-radius:18px 22px 18px 24px;background:var(--wa);color:#fff;font:700 1.02rem var(--body-font);text-decoration:none;box-shadow:0 14px 24px -14px #1f7a4a;transition:transform .35s var(--spring);position:relative;overflow:hidden;animation:mg-ring 3.2s 2.5s ease-out infinite}
.mg .wa:active,.mg .wa:hover{transform:scale(1.03) rotate(-.6deg)}
.mg .wa svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mg .wa:focus-visible{outline:2px solid #fff;outline-offset:2px}
@keyframes mg-ring{0%{box-shadow:0 14px 24px -14px #1f7a4a,0 0 0 0 #2fa86666}60%,100%{box-shadow:0 14px 24px -14px #1f7a4a,0 0 0 16px #2fa86600}}
.mg .tg{margin-top:10px;text-align:center;font:400 1.15rem var(--hand);color:var(--w)}
.mg .it{opacity:0;transform:translateY(18px) scale(.96)}
.mg .open .it{animation:mg-pop .75s var(--spring) forwards;animation-delay:calc(.3s + var(--i)*.06s)}
@keyframes mg-pop{to{opacity:1;transform:none}}
.mg .hi{font:700 1.5rem var(--hand);color:var(--w);margin:2px 0 0}
.mg .hs{font-size:.88rem;color:var(--mut);margin:0 0 6px}
.mg svg.d{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:url(#mg-rf)}
@keyframes mg-wig{25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}
@keyframes mg-sway{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
@keyframes mg-bloom{from{transform:scale(0) rotate(-40deg)}to{transform:scale(1) rotate(0)}}
@keyframes mg-grow{to{stroke-dashoffset:0}}
.mg .lbl{font:700 1.2rem var(--hand);color:var(--w);margin:16px 0 4px}
.mg .br{position:absolute;inset-block:0;inset-inline-start:0;width:110px;height:100%;z-index:1;pointer-events:none}
.mg .br .st{fill:none;stroke:#7a8d6a;stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;filter:url(#mg-rf)}
.mg .open .br .st{animation:mg-grow 2.6s .3s ease-out forwards}
.mg .br .lf{fill:var(--sage);stroke:#6f8260;stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:0 100%}
.mg .open .br .lf{animation:mg-lfin .6s var(--spring) forwards;animation-delay:var(--d)}
@keyframes mg-lfin{from{opacity:0;transform:scale(0)}to{opacity:1;transform:none}}
.mg .br .bs{transform-box:fill-box;transform-origin:center;transform:scale(0)}
.mg .open .br .bs{animation:mg-bloom 1s var(--spring) forwards,mg-sway 5s 2s ease-in-out infinite alternate;animation-delay:var(--d),calc(var(--d) + 1s)}
.mg .br .pt{fill:var(--rose);stroke:var(--w);stroke-width:1.6;fill-opacity:.9}
.mg .br .pt.b{fill:#f4c4c0}
.mg .br .ct{fill:#e9c27a;stroke:var(--w);stroke-width:1.4}
.mg .da .rw{display:flex;align-items:center;gap:12px;padding:8px 0;position:relative;margin-inline-start:0;border-radius:14px;overflow:hidden;transition:transform .25s var(--spring)}
.mg .da .rw:active{transform:scale(.97)}
.mg .da .rw span{font:700 1.85rem/1.35 var(--hand);transition:transform .4s var(--spring),color .3s}
.mg .da .rw:hover span,.mg .da .rw:active span{transform:translateX(-8px);color:var(--w)}
.mg .da .rw svg.d{width:30px;height:30px;color:var(--w);opacity:0;transform:scale(.4);transition:.4s var(--spring);flex:none}
.mg .da .rw:hover svg.d,.mg .da .rw.on svg.d{opacity:1;transform:none}
.mg .da .rw:hover svg.d{animation:mg-wig .6s}
.mg .da .rw.on span{color:var(--w)}
.mg .da .rw .ul{position:absolute;inset-inline-start:42px;inset-inline-end:0;bottom:3px;height:10px;pointer-events:none;clip-path:inset(0 0 0 100%);transition:clip-path .55s var(--ease);background:no-repeat center/100% 100% url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 10' preserveAspectRatio='none'%3E%3Cpath d='M2 6 C 20 1 40 9 62 4 S 100 7 118 3' fill='none' stroke='%23e9a9ae' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E")}
.mg .da .rw:hover .ul,.mg .da .rw:focus-visible .ul,.mg .da .rw:active .ul,.mg .da .rw.on .ul,.mg .da .rw.hnt .ul{clip-path:inset(0)}
.mg .da .rw:focus-visible{outline:2px solid var(--rose);outline-offset:2px}
.mg .da .rw.hnt svg.d{opacity:.9;transform:none}
.mg .da .rw.hnt span{transform:translateX(-6px)}
.mg .rp{position:absolute;border-radius:50%;background:#e9a9ae66;pointer-events:none;width:20px;height:20px;margin:-10px 0 0 -10px;transform:scale(0);animation:mg-rpl .6s ease-out forwards}
.mg .wa .rp{background:#ffffff44}
@keyframes mg-rpl{to{transform:scale(22);opacity:0}}
.mg .da .nt{margin:14px 0 0;padding:14px 16px 8px;background:var(--peach);border-radius:26px 18px 28px 20px;position:relative}
.mg .da .nt .lbl{margin-top:0}
.mg .da .nt a{display:flex;align-items:center;gap:10px;padding:9px 0;font-weight:600;font-size:.95rem;border-top:1.5px dashed #d9a98f66;position:relative;overflow:hidden;transition:padding .3s var(--ease),color .3s}
.mg .da .nt a:first-of-type{border-top:0}
.mg .da .nt a:hover,.mg .da .nt a:active{padding-inline-start:8px;color:var(--w)}
.mg .da .nt a i{width:8px;height:8px;border-radius:50%;background:var(--rose);box-shadow:0 0 0 3px #e9a9ae44;flex:none;transition:transform .3s var(--spring)}
.mg .da .nt a:hover i{transform:scale(1.4)}
.mg .da .nt a:focus-visible{outline:2px solid var(--rose);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.mg *,.mg *::before,.mg *::after{animation-duration:.01s!important;transition-duration:.01s!important;animation-iteration-count:1!important}.mg .it{opacity:1;transform:none}.mg .wa{animation:none}}
`;

export function MenuGarden({ open, onClose, shop, info, waHref }: MenuGardenProps) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // المرجع بيفتح القايمة على مستوى الشاشة كلها — العنوان فيه backdrop-blur
  // بيخلّي أي fixed جواه يتمدد على مقاس الهيدر بدل الشاشة، فبتحوّل القايمة
  // لـ body بـ portal (لا شيء يترسم قبل الهيدريشن — القايمة بتبدأ مقفولة)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // قفل سكرول الصفحة + Escape + نقل التركيز لزر الإغلاق (سلوك القايمة القديمة)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const ft = setTimeout(() => closeRef.current?.focus(), 80);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      clearTimeout(ft);
    };
  }, [open, onClose]);

  // الإيماءة الودّية: الصفوف اللي مش هي هي الصفحة الحالية بتتللمح بالخط تحت
  // بنفس توقيت المرجع (1.5s ثم كل 220ms لمدة 700ms) — وتتعطل مع reduce
  useEffect(() => {
    if (!open) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rows = Array.from(rootRef.current?.querySelectorAll('.rw:not(.on)') ?? []);
    const timers = rows.map((r, i) =>
      setTimeout(() => {
        r.classList.add('hnt');
        setTimeout(() => r.classList.remove('hnt'), 700);
      }, 1500 + i * 220),
    );
    return () => timers.forEach(clearTimeout);
  }, [open, shop]);

  // رشّة اللمس (ripple) — نفس سلوك المرجع على .rw/.nt a/.wa
  function ripple(e: React.PointerEvent) {
    const t = (e.target as HTMLElement).closest('.rw,.nt a,.wa');
    if (!t) return;
    const r = t.getBoundingClientRect();
    const p = document.createElement('span');
    p.className = 'rp';
    p.style.left = (e.clientX - r.left) + 'px';
    p.style.top = (e.clientY - r.top) + 'px';
    if (getComputedStyle(t).position === 'static') (t as HTMLElement).style.position = 'relative';
    t.appendChild(p);
    setTimeout(() => p.remove(), 650);
  }

  const tree = (
    <div className={`mg ${ruqaa.variable}`} ref={rootRef} dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: MG_CSS }} />
      {/* فلتر الخط اليدوي — نفس قيم المرجع (feTurbulence + feDisplacementMap) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="mg-rf" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
          </filter>
        </defs>
      </svg>
      <nav className={`dr da${open ? ' open' : ''}`} aria-label="القائمة الرئيسية" aria-hidden={!open} onPointerDown={ripple}>
        {BR()}
        <div className="hd it" style={{ '--i': 0 } as React.CSSProperties}>
          <span className="wm">LUBNÉL</span>
          <button className="x" ref={closeRef} onClick={onClose} aria-label="إغلاق" tabIndex={open ? 0 : -1} />
        </div>
        <div className="bd">
          <p className="hi it" style={{ '--i': 1 } as React.CSSProperties}>أهلًا يا جميلة</p>
          <p className="hs it" style={{ '--i': 1 } as React.CSSProperties}>اختاري اللي يعجبك</p>
          {shop.map((n, i) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={'rw it' + (active ? ' on' : '')}
                style={{ '--i': i + 2 } as React.CSSProperties}
                tabIndex={open ? 0 : -1}
              >
                <Hand k={iconFor(n.href, n.label)} />
                <span>{n.label}</span>
                <i className="ul" aria-hidden />
              </Link>
            );
          })}
          <div className="nt it" style={{ '--i': 9 } as React.CSSProperties}>
            <div className="lbl">معلومات</div>
            {info.map((n) => (
              <Link key={n.href} href={n.href} onClick={onClose} tabIndex={open ? 0 : -1}>
                <i aria-hidden />
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="ft it" style={{ '--i': 10 } as React.CSSProperties}>
          <a className="wa" href={waHref} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M21 12a9 9 0 01-13.4 7.8L3 21l1.3-4.4A9 9 0 1121 12z" />
              <path d="M9 8.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.7c-.8-.3-1.6-1.1-1.9-1.9l.7-.8-1-2z" />
            </svg>
            اطلبي عبر واتساب
          </a>
          <div className="tg">جمال يليق بكِ</div>
        </div>
      </nav>
    </div>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
}
