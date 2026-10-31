'use client';

// LUBNÉL Checkout — View B (3-Step Card: Bag → Delivery Details → Review & WhatsApp Confirm).
// DESIGN SOURCE: the official reference lubnel-checkout-b.html.
// Colors: --w (#8a3a46), --wd (#5a2230), --rose (#e9a9ae), --bl (#fbeee9),
// --peach (#f7d9c8), --sage (#d3e0c9), --lilac (#e4d8ec), --sun (#f9e7b8),
// --cream (#fffaf3), --ink (#3a2226), --mut (#8a6d70), --line (#ecd9d1),
// --wa (#2fa866), --err (#c0392b).
// Hand-drawn SVG noise filter, vine step progress with moving flower,
// free shipping progress bar, Egyptian governorates datalist, strict Arabic
// validation, server-side idempotency, database order persistence BEFORE WhatsApp redirect,
// success modal with copyable LN-XXXXXX order number, falling petals, and auto-redirect.

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Aref_Ruqaa, Cairo } from 'next/font/google';
import { useCart, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, WHATSAPP_NUMBER } from '@/lib/cart-store';
import { trackVisit } from '@/components/store/visit-tracker';

const ruqaa = Aref_Ruqaa({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-checkout-ruqaa',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-checkout-cairo',
  display: 'swap',
});

// Egyptian governorates list
const EG_GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'القليوبية',
  'بني سويف',
  'المنيا',
  'الفيوم',
  'أسيوط',
  'سوهاج',
  'الدقهلية',
  'الشرقية',
  'الغربية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'أسوان',
  'الأقصر',
  'قنا',
  'البحر الأحمر',
  'مطروح',
  'الوادي الجديد',
  'شمال سيناء',
  'جنوب سيناء',
];

// SVG Icon Paths matching the reference
const ICONS = {
  truck: '<path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  wa: '<path d="M21 12a9 9 0 01-13.4 7.8L3 21l1.3-4.4A9 9 0 1121 12z"/><path d="M9 8.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.7c-.8-.3-1.6-1.1-1.9-1.9l.7-.8-1-2z"/>',
  ret: '<path d="M4 12a8 8 0 0113-6l2 2M20 4v4h-4M20 12a8 8 0 01-13 6l-2-2M4 20v-4h4"/>',
  cash: '<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1"/><rect x="3" y="7" width="18" height="4" rx="1"/><path d="M12 7v13M12 7c-2-4-6-3-5-1s5 1 5 1zM12 7c2-4 6-3 5-1s-5 1-5 1z"/>',
  pin: '<path d="M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  bag: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 016 0"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5c-2.5-3.5-1-6.5 0-6.5s2.5 3 0 6.5zM12 14.5c-2.5 3.5-1 6.5 0 6.5s2.5-3 0-6.5zM9.5 12c-3.5-2.5-6.5-1-6.5 0s3 2.5 6.5 0zM14.5 12c3.5 2.5 6.5 1 6.5 0s-3-2.5-6.5 0z"/>',
  party: '<path d="M4 20l5-14 9 9zM14 4v2M19 8h2M17 3l1 2M20 13l2 1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cart: '<path d="M3 4h2l2.5 11h10L20 7H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
};

function renderIcon(name: keyof typeof ICONS, size = 20, extraClass = '') {
  return `<svg class="d${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" style="width:${size}px;height:${size}px">${ICONS[name]}</svg>`;
}

function formatNumber(n: number) {
  return Number(n).toLocaleString('en-US');
}

function esc(s: unknown) {
  if (typeof window === 'undefined') {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

export interface CheckoutSettings {
  whatsapp?: string;
  shipping?: number;
  freeFrom?: number;
  currency?: string;
  whatsappMessage?: string;
}

interface CartViewProps {
  initialSettings?: CheckoutSettings;
  whatsapp?: string;
}

const CHECKOUT_CSS = `
.chk-root{--w:#8a3a46;--wd:#5a2230;--rose:#e9a9ae;--bl:#fbeee9;--peach:#f7d9c8;--sage:#d3e0c9;--lilac:#e4d8ec;--sun:#f9e7b8;--cream:#fffaf3;--ink:#3a2226;--mut:#8a6d70;--line:#ecd9d1;--wa:#2fa866;--err:#c0392b;--ease:cubic-bezier(.2,.8,.2,1);--spring:cubic-bezier(.34,1.56,.64,1);--hand:var(--font-checkout-ruqaa,'Aref Ruqaa'),'Noto Naskh Arabic',serif;--font-sans:var(--font-checkout-cairo,Cairo),system-ui,sans-serif;font-family:var(--font-sans);background:var(--bl);color:var(--ink);min-height:100vh;direction:rtl;position:relative;overflow-x:clip}
.chk-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.chk-root .pg{max-width:1120px;margin:0 auto;padding:26px 20px 40px;position:relative}
.chk-root .pg>*{position:relative;z-index:2}
.chk-root .dc{position:absolute!important;z-index:1!important;pointer-events:none;color:var(--rose);fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;opacity:.35;filter:url(#rf);animation:chk-fl 11s ease-in-out infinite alternate}
@keyframes chk-fl{from{transform:translateY(-6px) rotate(var(--r,0deg))}to{transform:translateY(8px) rotate(calc(var(--r,0deg) + 6deg))}}

.chk-root h1{margin:0;font:700 2.4rem/1.3 var(--hand);color:var(--wd);display:inline-block;position:relative}
.chk-root h1 svg{position:absolute;inset-inline:-4px;bottom:-6px;width:calc(100% + 8px);height:12px;fill:none;stroke:var(--rose);stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:chk-dr 1.2s .3s var(--ease) forwards}
@keyframes chk-dr{to{stroke-dashoffset:0}}
.chk-root svg.d{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

/* الخطوات */
.chk-root .st{display:flex;align-items:center;gap:0;margin:18px 0 22px;flex-wrap:nowrap}
.chk-root .st .s{display:flex;align-items:center;gap:10px;font-weight:700;font-size:.88rem;color:var(--mut);white-space:nowrap}
.chk-root .st .s b{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1.5px solid var(--line);font-size:.82rem;transition:all .5s var(--spring)}
.chk-root .st .s b svg{width:16px;height:16px}
.chk-root .st .s.on{color:var(--wd)}
.chk-root .st .s.on b{background:var(--w);color:#fff;border-color:var(--w);transform:scale(1.1)}
.chk-root .st .s.dn b{background:var(--sage);border-color:#a9bf9a;color:#3f6a34}
.chk-root .st .l{flex:1;min-width:16px;max-width:90px;height:2px;margin:0 8px;background:repeating-linear-gradient(90deg,#d9c3ba 0 6px,transparent 6px 11px);position:relative}
.chk-root .st .l i{position:absolute;inset:0;background:var(--w);transform:scaleX(0);transform-origin:right;transition:transform .7s var(--ease)}
.chk-root .st .l.dn i{transform:none}

/* بار الشحن */
.chk-root .fb{padding:14px 16px;border-radius:18px 14px 20px 16px;background:var(--sun);display:grid;gap:10px}
.chk-root .fb p{margin:0;font-weight:600;font-size:.92rem;display:flex;align-items:center;gap:10px}
.chk-root .fb p svg{width:26px;height:26px;color:var(--w);flex:none}
.chk-root .fb p b{color:var(--w)}
.chk-root .fb .tr{height:8px;border-radius:8px;background:#fff9;overflow:hidden}
.chk-root .fb .tr i{display:block;height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,#e9a9ae,var(--w));transition:width .9s var(--ease)}
.chk-root .fb.ok{background:var(--sage)}
.chk-root .fb.ok .tr i{background:linear-gradient(90deg,#8fb07e,#5d8a4e)}

/* عناصر السلة */
.chk-root .it{display:flex;gap:14px;align-items:center;padding:14px;background:#fff;border-radius:20px 16px 22px 18px;box-shadow:0 12px 20px -18px #5a2230aa;border:1px solid var(--line);animation:chk-pop .6s var(--spring) both}
@keyframes chk-pop{from{opacity:0;transform:translateY(14px) scale(.97)}}
.chk-root .it+.it{margin-top:12px}
.chk-root .it .im{flex:none;width:84px;height:84px;border-radius:14px;background:var(--c,#f3e2da) center/cover no-repeat;display:grid;place-items:center;color:var(--wd);overflow:hidden}
.chk-root .it .im svg{width:40px;height:40px;opacity:.6}
.chk-root .it .tx{flex:1;min-width:0}
.chk-root .it .nm{font:700 1.15rem/1.35 var(--hand);color:var(--wd)}
.chk-root .it .pr{font-weight:800;color:var(--w);margin-top:2px}
.chk-root .it .rm{border:0;background:transparent;color:var(--mut);cursor:pointer;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;transition:all .3s}
.chk-root .it .rm:hover{background:#f8d5d8;color:var(--err)}
.chk-root .it .rm svg{width:18px;height:18px}
.chk-root .qt{display:inline-flex;align-items:center;margin-top:8px;border:1.5px solid var(--line);border-radius:99px;background:var(--cream)}
.chk-root .qt button{width:34px;height:34px;border:0;background:transparent;font-size:1.2rem;cursor:pointer;color:var(--wd);border-radius:50%;transition:background .2s;display:grid;place-items:center}
.chk-root .qt button:hover{background:#f6e2df}
.chk-root .qt span{min-width:30px;text-align:center;font-weight:800;display:inline-block}
.chk-root .qt span.bmp{animation:chk-bmp .35s var(--spring)}
@keyframes chk-bmp{50%{transform:scale(1.4)}}
.chk-root .clr{margin-top:12px;border:0;background:transparent;color:var(--mut);font:600 .85rem var(--font-sans);cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.chk-root .clr:hover{color:var(--err)}
.chk-root .clr svg{width:16px;height:16px}
.chk-root .emp{text-align:center;padding:34px 10px;color:var(--mut)}
.chk-root .emp b{display:block;font:700 1.5rem var(--hand);color:var(--wd);margin-bottom:6px}

/* ملخص */
.chk-root .ln{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;font-size:.95rem}
.chk-root .ln span:first-child{color:var(--mut)}
.chk-root .ln b{font-weight:800}
.chk-root .ln.ds b{color:#4d8a3e}
.chk-root .ln.sh b.fr{color:#4d8a3e}
.chk-root .tot{display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px;border-top:2px dashed #dfc9c0;margin-top:8px}
.chk-root .tot span{font:700 1.4rem var(--hand);color:var(--wd)}
.chk-root .tot b{font-size:1.5rem;font-weight:800;color:var(--w);font-variant-numeric:tabular-nums}
.chk-root .tot b.bmp{animation:chk-bmp .4s var(--spring)}
.chk-root .cp{display:flex;gap:8px;margin:10px 0 4px}
.chk-root .cp input{flex:1;min-width:0;height:44px;border:1.5px solid var(--line);border-radius:14px;background:var(--cream);padding:0 14px;font:600 .92rem var(--font-sans);outline:0}
.chk-root .cp input:focus{border-color:var(--w)}
.chk-root .cp button{height:44px;padding:0 18px;border-radius:14px;border:1.5px solid var(--w);background:transparent;color:var(--w);font:700 .88rem var(--font-sans);cursor:pointer}
.chk-root .cp button:hover{background:var(--w);color:#fff}
.chk-root .cpm{font-size:.8rem;min-height:1.2em;margin:2px 0 0}
.chk-root .cpm.ok{color:#4d8a3e}
.chk-root .cpm.er{color:var(--err)}

/* فورم */
.chk-root .fm h3{margin:0 0 14px;font:700 1.5rem var(--hand);color:var(--wd);display:flex;align-items:center;gap:10px}
.chk-root .fm h3 svg{width:28px;height:28px;color:var(--w)}
.chk-root .fg{display:grid;grid-template-columns:1fr 1fr;gap:14px 14px}
.chk-root .fg .f{grid-column:span 1}
.chk-root .fg .f.w{grid-column:1/-1}
.chk-root .f label{display:flex;justify-content:space-between;font-weight:700;font-size:.88rem;margin-bottom:6px}
.chk-root .f label em{font:400 .76rem var(--font-sans);font-style:normal;color:var(--mut)}
.chk-root .f input,.chk-root .f textarea{width:100%;border:1.5px solid var(--line);border-radius:16px 14px 18px 14px;background:#fff;padding:0 16px;height:50px;font:600 .95rem var(--font-sans);color:var(--ink);outline:0;transition:border-color .25s,box-shadow .25s}
.chk-root .f textarea{height:84px;padding:12px 16px;resize:none;line-height:1.7}
.chk-root .f input::placeholder,.chk-root .f textarea::placeholder{color:#bda7a2;font-weight:400}
.chk-root .f input:focus,.chk-root .f textarea:focus{border-color:var(--w);box-shadow:0 0 0 4px #e9a9ae44}
.chk-root .f.bad input,.chk-root .f.bad textarea{border-color:var(--err);background:#fff6f4}
.chk-root .f.good input,.chk-root .f.good textarea{border-color:#8fb07e}
.chk-root .f .er{color:var(--err);font-size:.78rem;min-height:1.1em;margin-top:4px}
.chk-root .f .vw{position:relative}
.chk-root .f.good .vw::after{content:"";position:absolute;inset-inline-end:14px;top:19px;width:14px;height:8px;border-left:2.5px solid #5d8a4e;border-bottom:2.5px solid #5d8a4e;transform:rotate(-45deg) scale(0);animation:chk-ck .4s var(--spring) forwards}
@keyframes chk-ck{to{transform:rotate(-45deg) scale(1)}}
.chk-root .f.good input{padding-inline-end:40px}
.chk-root .shk{animation:chk-shk .4s}
@keyframes chk-shk{20%,60%{transform:translateX(7px)}40%,80%{transform:translateX(-7px)}}

.chk-root .tc{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 14px}
.chk-root .tc span{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:99px;background:#fff;border:1.5px dashed #dfb9ae;font-size:.78rem;font-weight:700;color:var(--wd)}
.chk-root .tc svg{width:15px;height:15px;color:var(--w)}
.chk-root .go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:58px;border:0;border-radius:20px 24px 20px 26px;background:var(--w);color:#fff;font:800 1.05rem var(--font-sans);cursor:pointer;box-shadow:0 18px 26px -16px var(--w);transition:transform .35s var(--spring),background .3s;position:relative;overflow:hidden}
.chk-root .go:hover{transform:translateY(-2px)}
.chk-root .go:active{transform:scale(.98)}
.chk-root .go svg{width:22px;height:22px}
.chk-root .go.ld{pointer-events:none;opacity:.85}
.chk-root .go.ld::after{content:"";position:absolute;inset-inline:0;bottom:0;height:4px;background:#fff8;animation:chk-ldb 1s linear infinite;transform-origin:right}
@keyframes chk-ldb{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.chk-root .go::before{content:"";position:absolute;top:0;bottom:0;width:26%;background:linear-gradient(100deg,transparent,#fff5,transparent);transform:translateX(-400%) skewX(-18deg);animation:chk-shn 5s 1.5s ease-in-out infinite}
@keyframes chk-shn{40%,100%{transform:translateX(450%) skewX(-18deg)}}
.chk-root .nt{text-align:center;color:var(--mut);font-size:.8rem;margin:10px 0 0;line-height:1.8}

/* كارت خطوات ب */
.chk-root .B .card{max-width:760px;margin:0 auto;background:#fff;border-radius:28px 24px 30px 26px;padding:28px;box-shadow:0 30px 40px -30px #5a2230aa;border:1px solid var(--line);overflow:hidden;position:relative}
.chk-root .B .pan{display:none}
.chk-root .B .pan.on{display:block;animation:chk-sl .55s var(--ease)}
@keyframes chk-sl{from{opacity:0;transform:translateX(-36px)}}
.chk-root .B .vine{height:10px;border-radius:10px;background:#f3e3dc;margin-bottom:22px;position:relative}
.chk-root .B .vine i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:10px;background:linear-gradient(90deg,#b9d3a8,#e9a9ae);width:33.34%;transition:width .8s var(--ease)}
.chk-root .B .vine svg{position:absolute;top:-11px;width:30px;height:30px;color:var(--w);transition:inset-inline-start .8s var(--ease);margin-inline-start:-15px}
.chk-root .B .nav{display:flex;gap:12px;margin-top:22px}
.chk-root .B .nav .bk{height:58px;padding:0 22px;border-radius:20px;border:1.5px solid var(--line);background:#fff;font:700 .95rem var(--font-sans);cursor:pointer;color:var(--wd);transition:background .2s}
.chk-root .B .nav .bk:hover{background:var(--cream)}
.chk-root .B .nav .go{flex:1}
.chk-root .B .rv{display:grid;gap:6px;background:var(--cream);padding:16px;border-radius:16px;margin-bottom:14px;font-size:.9rem;line-height:1.8}
.chk-root .B .rv b{color:var(--wd)}

/* شريط الإجمالي الثابت بالموبايل */
.chk-root .B .mb{position:fixed;inset-inline:0;bottom:calc(3.5rem + env(safe-area-inset-bottom, 0px));z-index:30;background:#fff;border-top:1px solid var(--line);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 -10px 20px -14px #5a223055}
@media(min-width:768px){.chk-root .B .mb{bottom:0}}
.chk-root .B .mb span{color:var(--mut);font-size:.85rem}
.chk-root .B .mb b{font-size:1.2rem;color:var(--w)}

/* مودال النجاح */
.chk-root .md{position:fixed;inset:0;z-index:60;display:none;place-items:center;background:#3a1a2088;padding:20px}
.chk-root .md.on{display:grid;animation:chk-fi .3s}
@keyframes chk-fi{from{opacity:0}}
.chk-root .md .bx{position:relative;width:min(480px,100%);background:var(--cream);border-radius:30px 26px 32px 28px;padding:34px 28px 28px;text-align:center;animation:chk-up .6s var(--spring);overflow:hidden}
@keyframes chk-up{from{opacity:0;transform:translateY(40px) scale(.95)}}
.chk-root .md .ba{width:84px;height:84px;margin:0 auto 14px;border-radius:50%;background:var(--peach);display:grid;place-items:center;color:var(--w)}
.chk-root .md .ba svg{width:46px;height:46px;stroke-dasharray:1;stroke-dashoffset:1;animation:chk-dr 1.1s .3s ease-out forwards}
.chk-root .md h2{margin:0 0 8px;font:700 2rem var(--hand);color:var(--wd)}
.chk-root .md p{margin:0 0 6px;color:var(--mut);line-height:1.9}
.chk-root .md .no{display:inline-flex;align-items:center;gap:10px;margin:10px 0;padding:8px 8px 8px 16px;border:2px dashed #d9a98f;border-radius:14px;font:800 1.15rem var(--font-sans);color:var(--w);direction:ltr;letter-spacing:1px}
.chk-root .md .no button{border:0;background:var(--w);color:#fff;font:700 .75rem var(--font-sans);padding:6px 12px;border-radius:9px;cursor:pointer;transition:background .2s}
.chk-root .md .no button:hover{background:var(--wd)}
.chk-root .md .acts{display:grid;gap:10px;margin-top:18px}
.chk-root .md .acts a,.chk-root .md .acts button{height:54px;border-radius:18px 22px 18px 24px;border:0;font:800 1rem var(--font-sans);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;transition:transform .2s}
.chk-root .md .acts a:active,.chk-root .md .acts button:active{transform:scale(.98)}
.chk-root .md .wa{background:var(--wa);color:#fff}
.chk-root .md .ct{background:#fff;color:var(--wd);border:1.5px solid var(--line)!important}
.chk-root .md .cx{position:absolute;top:14px;inset-inline-end:14px;width:36px;height:36px;border-radius:50%;border:0;background:#fff;cursor:pointer;color:var(--wd);display:grid;place-items:center}
.chk-root .pt{position:absolute;top:-30px;width:22px;height:22px;color:var(--rose);opacity:.8;animation:chk-fall linear infinite;fill:none;stroke:currentColor;stroke-width:2;pointer-events:none}
@keyframes chk-fall{to{transform:translateY(520px) rotate(300deg)}}

.chk-root .B .pg{padding-bottom:120px}

/* Cart Upsell / Order Bump */
.chk-root .ob{margin-top:16px;background:#fff8f6;border:1.5px dashed var(--rose);border-radius:18px;padding:14px 16px;box-shadow:0 4px 14px rgba(138,58,70,0.04)}
.chk-root .ob-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.chk-root .ob-hd b{font-family:var(--hand);font-size:1.15rem;color:var(--wd);display:flex;align-items:center;gap:6px}
.chk-root .ob-hd span{font-size:0.75rem;color:var(--wa);font-weight:700;background:rgba(47,168,102,0.1);padding:3px 8px;border-radius:99px}
.chk-root .ob-ls{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:600px){.chk-root .ob-ls{grid-template-columns:1fr 1fr}}
.chk-root .ob-it{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:8px 10px;transition:transform .2s ease,border-color .2s ease}
.chk-root .ob-it:hover{transform:translateY(-1px);border-color:var(--rose)}
.chk-root .ob-im{width:48px;height:48px;border-radius:10px;background:#fbeee9;background-size:cover;background-position:center;flex-shrink:0}
.chk-root .ob-dt{flex:1;min-width:0}
.chk-root .ob-nm{font-size:0.86rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chk-root .ob-pr{font-size:0.82rem;font-weight:800;color:var(--w);margin-top:2px}
.chk-root .ob-btn{background:var(--w);color:#fff;border:none;border-radius:20px;padding:6px 12px;font-size:0.78rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .2s ease;flex-shrink:0}
.chk-root .ob-btn:hover{background:var(--wd);transform:scale(1.03)}

@media(max-width:900px){.chk-root .fg{grid-template-columns:1fr}.chk-root h1{font-size:2rem}.chk-root .st .s span{display:none}.chk-root .st .s.on span{display:inline}.chk-root .pg{padding:20px 14px 30px}}
@media(max-width:520px){.chk-root .it{flex-wrap:wrap}.chk-root .it .im{width:72px;height:72px}.chk-root .B .card{padding:20px 16px}}
@media(prefers-reduced-motion:reduce){.chk-root *{animation-duration:.01s!important;animation-iteration-count:1!important;transition-duration:.01s!important}.chk-root .pt{display:none}}
`;

declare global {
  interface Window {
    LUBNEL_CHECKOUT?: {
      whatsapp?: string;
      shipping?: number;
      freeFrom?: number;
      currency?: string;
      coupons?: Record<string, unknown>;
      onSubmit?: (order: unknown) => Promise<unknown>;
      autoRedirect?: boolean;
      demo?: boolean;
    };
  }
}

export function CartView({ initialSettings, whatsapp }: CartViewProps) {
  const router = useRouter();
  const rawItems = useCart((s) => s.items);
  const addItem = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.remove);
  const clearCart = useCart((s) => s.clear);

  // Settings
  const storeWhatsapp = (whatsapp || initialSettings?.whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '');
  const shippingFee = initialSettings?.shipping ?? SHIPPING_FEE;
  const freeThreshold = initialSettings?.freeFrom ?? FREE_SHIPPING_THRESHOLD;
  const currency = initialSettings?.currency || 'ج.م';
  const whatsappGreeting = initialSettings?.whatsappMessage || 'مرحبًا LUBNÉL 🌸';

  // Step state (1: Bag, 2: Delivery, 3: Review)
  const [step, setStep] = useState<number>(1);
  const [done, setDone] = useState<boolean>(false);
  const [orderModal, setOrderModal] = useState<{
    id: string;
    waUrl: string;
    copied: boolean;
  } | null>(null);

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Form values
  const [vals, setVals] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    addr: '',
    note: '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const modalCloseBtnRef = useRef<HTMLButtonElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  // Upsell items state (Feature 1: Cart Upsell / Order Bump)
  const [upsellProducts, setUpsellProducts] = useState<{
    id: string;
    slug: string;
    nameAr: string;
    price: number;
    image: string;
  }[]>([]);

  useEffect(() => {
    fetch('/api/products?take=12')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.products)) {
          setUpsellProducts(
            data.products
              .filter((p: { stock?: number }) => (p.stock == null || p.stock > 0))
              .map((p: { id: string; slug: string; nameAr: string; price: number; image: string }) => ({
                id: p.id,
                slug: p.slug,
                nameAr: p.nameAr,
                price: p.price,
                image: p.image,
              }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Auto-fill delivery details from draft or saved customer profile (Feature 3)
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('lubnel_checkout_draft');
      const savedProfile = localStorage.getItem('lubnel_customer_profile');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          setVals((prev) => ({ ...prev, ...parsed }));
          return;
        }
      }
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed && typeof parsed === 'object') {
          setVals((prev) => ({
            ...prev,
            name: parsed.name || prev.name,
            phone: parsed.phone || prev.phone,
            city: parsed.city || prev.city,
            addr: parsed.addr || prev.addr,
            email: parsed.email || prev.email,
          }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist draft changes
  useEffect(() => {
    if (vals.name || vals.phone || vals.city || vals.addr || vals.email || vals.note) {
      try {
        localStorage.setItem('lubnel_checkout_draft', JSON.stringify(vals));
      } catch {
        // ignore
      }
    }
  }, [vals]);

  // Map cart items
  const items = rawItems.map((i) => {
    const key = i.key || i.id;
    const name = i.nameAr + (i.variant ? ` (${i.variant})` : '');
    return {
      key,
      id: key,
      slug: i.slug,
      name,
      price: i.price,
      qty: i.qty,
      img: i.image,
      variant: i.variant,
    };
  });

  // Calculate totals
  const subtotal = items.reduce((acc, i) => acc + i.price * i.qty, 0);
  const isFreeShipping = items.length > 0 && subtotal >= freeThreshold;
  // Shipping fees are NOT added to the order total.
  // Delivery price & method are determined directly with the store agent on WhatsApp,
  // unless the order reaches the free shipping threshold.
  const shipping = 0;
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const total = Math.max(0, subtotal - discount);
  const totalQty = items.reduce((acc, i) => acc + i.qty, 0);
  const remainingForFree = Math.max(0, freeThreshold - subtotal);
  const freeProgressPct = Math.min(100, (subtotal / freeThreshold) * 100);
  const availableUpsells = useMemo(() => {
    return upsellProducts
      .filter((p) => !items.some((it) => it.slug === p.slug || it.id === p.id))
      .slice(0, 3);
  }, [upsellProducts, items]);

  // Form validation
  const validateForm = useCallback(() => {
    const e: Record<string, string> = {};
    const nameTrimmed = vals.name.trim();
    if (nameTrimmed.length < 3 || nameTrimmed.split(/\s+/).filter(Boolean).length < 2) {
      e.name = 'اكتبي الاسم بالكامل (اسمين على الأقل).';
    }
    const cleanPhone = vals.phone.replace(/[\s-]/g, '');
    if (!/^01[0125]\d{8}$/.test(cleanPhone)) {
      e.phone = 'اكتبي رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).';
    }
    if (vals.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(vals.email.trim())) {
      e.email = 'صيغة الإيميل غير صحيحة.';
    }
    if (vals.city.trim().length < 2) {
      e.city = 'اختاري أو اكتبي المدينة.';
    }
    if (vals.addr.trim().length < 8) {
      e.addr = 'اكتبي عنوان أوضح (الشارع ورقم العمارة - 8 حروف على الأقل).';
    }
    return { ok: Object.keys(e).length === 0, errors: e };
  }, [vals]);

  // Expose window.LUBNEL_CHECKOUT
  useEffect(() => {
    window.LUBNEL_CHECKOUT = {
      whatsapp: storeWhatsapp,
      shipping: shippingFee,
      freeFrom: freeThreshold,
      currency,
      coupons: {},
      autoRedirect: true,
      demo: false,
    };
  }, [storeWhatsapp, shippingFee, freeThreshold, currency]);

  // Modal Esc key & focus trap
  useEffect(() => {
    if (!orderModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOrderModal(null);
        clearCart();
        if (lastActiveElementRef.current) {
          lastActiveElementRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    if (modalCloseBtnRef.current) {
      modalCloseBtnRef.current.focus();
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderModal]);

  // Step change helper
  const goToStep = (s: number) => {
    if (s === 2 && items.length === 0) return;
    setStep(s);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Shake animation trigger
  const shakeForm = () => {
    const fm = document.getElementById('fm');
    if (fm) {
      fm.classList.remove('shk');
      void fm.offsetWidth;
      fm.classList.add('shk');
    }
  };

  // Focus first invalid field
  const focusFirstError = (errors: Record<string, string>) => {
    const keys: (keyof typeof vals)[] = ['name', 'phone', 'email', 'city', 'addr'];
    const firstKey = keys.find((k) => errors[k]);
    if (firstKey) {
      const el = document.getElementById(`f_${firstKey}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Handle coupon apply
  const handleApplyCoupon = async () => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponCodeInput('');
      setCouponMsg(null);
      return;
    }
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) {
      setCouponMsg({ text: 'اكتبي كود الخصم أولًا.', isError: true });
      return;
    }
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      const c = data?.coupon;
      if (c?.valid) {
        setAppliedCoupon({ code: c.code, discount: c.discount });
        setCouponMsg({ text: `تم تطبيق كود الخصم (${c.code}).`, isError: false });
      } else {
        setAppliedCoupon(null);
        setCouponMsg({ text: c?.message || 'كود الخصم غير صحيح أو منتهي.', isError: true });
      }
    } catch {
      setCouponMsg({ text: 'تعذر التحقق من كود الخصم، تأكدي من الاتصال.', isError: true });
    }
  };

  // Compose WhatsApp text
  const composeWhatsAppText = (orderId: string) => {
    const lines = [
      whatsappGreeting.trim(),
      'طلب جديد من لوبنيل',
      `رقم الطلب: ${orderId}`,
      '',
    ];
    items.forEach((i) => {
      lines.push(`• ${i.name} × ${i.qty} = ${formatNumber(i.price * i.qty)} ${currency}`);
    });
    lines.push('');
    lines.push(`المجموع الفرعي: ${formatNumber(subtotal)} ${currency}`);
    if (discount > 0) {
      lines.push(`الخصم: -${formatNumber(discount)} ${currency}`);
    }
    if (isFreeShipping) {
      lines.push(`الشحن وطريقة التوصيل: مجاني (تجاوز حد الشحن المجاني) 🌸`);
    } else {
      lines.push(`سعر وطريقة التوصيل: يُحدد مع المسؤولة عبر واتساب`);
    }
    lines.push(`الإجمالي: ${formatNumber(total)} ${currency}`);
    lines.push('');
    lines.push(`بيانات التوصيل:`);
    lines.push(`الاسم: ${vals.name}`);
    lines.push(`الموبايل: ${vals.phone}`);
    lines.push(`العنوان: ${vals.city}، ${vals.addr}`);
    if (vals.note) {
      lines.push(`ملاحظات: ${vals.note}`);
    }
    lines.push('طريقة الدفع: الدفع عند الاستلام');
    return lines.join('\n');
  };

  // Handle final submission
  const handleSubmitOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (items.length === 0 || submitting) return;

    // Validate form
    setTouched({ name: true, phone: true, email: true, city: true, addr: true });
    const { ok, errors } = validateForm();
    if (!ok) {
      goToStep(2);
      setTimeout(() => {
        shakeForm();
        focusFirstError(errors);
      }, 50);
      return;
    }

    setSubmitting(true);
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;

    try {
      const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: vals.name,
          phone: vals.phone,
          email: vals.email || undefined,
          city: vals.city,
          address: vals.addr,
          notes: vals.note || undefined,
          couponCode: appliedCoupon?.code,
          idempotencyKey,
          items: items.map((i) => ({ slug: i.slug, qty: i.qty, variant: i.variant })),
        }),
      });

      const data = await res.json();
      if (!data?.ok || !data?.order) {
        alert(data?.error || 'حصلت مشكلة في إرسال الطلب، جربي تاني.');
        setSubmitting(false);
        return;
      }

      const realOrderId = data.order.orderNumber || `LN-${data.order.id.slice(-6).toUpperCase()}`;
      setDone(true);
      trackVisit('order_placed', data.order.id);

      // Save customer profile for future visits & clear draft (Feature 3)
      try {
        localStorage.setItem(
          'lubnel_customer_profile',
          JSON.stringify({
            name: vals.name,
            phone: vals.phone,
            email: vals.email,
            city: vals.city,
            addr: vals.addr,
          })
        );
        localStorage.removeItem('lubnel_checkout_draft');
      } catch {
        // ignore
      }

      const msgText = composeWhatsAppText(realOrderId);
      const waUrl = `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(msgText)}`;

      setOrderModal({
        id: realOrderId,
        waUrl,
        copied: false,
      });

      // Auto redirect to WhatsApp after ~1.5s (per requirement 3)
      setTimeout(() => {
        try {
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        } catch {}
      }, 1500);
    } catch {
      alert('خطأ في الاتصال بالشبكة، تأكدي من اتصالكِ وجربي ثانية.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for input validation state
  const { errors } = validateForm();

  return (
    <div className={`chk-root ${ruqaa.variable} ${cairo.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: CHECKOUT_CSS }} />

      {/* SVG hand-drawn noise filter */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="rf">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
          </filter>
        </defs>
      </svg>

      <main className="pg B" id="pg">
        {/* Floating floral graphic */}
        <svg
          className="dc"
          viewBox="0 0 64 64"
          style={{ width: '130px', height: '130px', insetInlineStart: '-30px', top: '30px', '--r': '-10deg' } as React.CSSProperties}
        >
          <circle cx="32" cy="30" r="5" />
          <path d="M32 25c-7-8-3-18 0-18s7 10 0 18zM32 35c-7 8-3 18 0 18s7-10 0-18zM27 30c-8-7-18-3-18 0s10 7 18 0zM37 30c8 7 18 3 18 0s-10-7-18 0z" />
        </svg>

        {/* Title with hand-drawn pink underline */}
        <h1>
          إتمام الطلب
          <svg viewBox="0 0 100 12" preserveAspectRatio="none">
            <path pathLength="1" d="M2 8 C 25 2, 55 11, 98 4" />
          </svg>
        </h1>

        {/* Steps indicator */}
        <div className="st" id="st">
          <div className={`s ${done || step > 1 ? 'dn' : step === 1 ? 'on' : ''}`}>
            <b>
              {done || step > 1 ? (
                <span dangerouslySetInnerHTML={{ __html: renderIcon('check', 16) }} />
              ) : (
                1
              )}
            </b>
            <span>الحقيبة</span>
          </div>

          <span className={`l ${done || step >= 2 ? 'dn' : ''}`}>
            <i />
          </span>

          <div className={`s ${done || step > 2 ? 'dn' : step === 2 ? 'on' : ''}`}>
            <b>
              {done || step > 2 ? (
                <span dangerouslySetInnerHTML={{ __html: renderIcon('check', 16) }} />
              ) : (
                2
              )}
            </b>
            <span>بيانات التوصيل</span>
          </div>

          <span className={`l ${done || step >= 3 ? 'dn' : ''}`}>
            <i />
          </span>

          <div className={`s ${done ? 'dn' : step === 3 ? 'on' : ''}`}>
            <b>
              {done ? (
                <span dangerouslySetInnerHTML={{ __html: renderIcon('check', 16) }} />
              ) : (
                3
              )}
            </b>
            <span>تأكيد واتساب</span>
          </div>
        </div>

        {/* 3-Step Card */}
        <div className="card">
          {/* Top Vine Progress Bar with moving flower */}
          <div className="vine">
            <i id="vi" style={{ width: `${step * 33.34}%` }} />
            <svg
              className="d"
              viewBox="0 0 24 24"
              style={{
                width: '30px',
                height: '30px',
                insetInlineStart: `${step * 33.34}%`,
              }}
              dangerouslySetInnerHTML={{ __html: ICONS.flower }}
            />
          </div>

          {/* PANEL 1: الحقيبة (Bag) */}
          <section className={`pan ${step === 1 ? 'on' : ''}`} data-p="1">
            {/* Free shipping bar */}
            {items.length > 0 && (
              <div className={`fb ${isFreeShipping ? 'ok' : ''}`}>
                {isFreeShipping ? (
                  <p>
                    <span dangerouslySetInnerHTML={{ __html: renderIcon('gift', 26) }} />
                    <span>
                      مبروك! <b>شحن طلبك مجاني</b>
                    </span>
                  </p>
                ) : (
                  <p>
                    <span dangerouslySetInnerHTML={{ __html: renderIcon('truck', 26) }} />
                    <span>
                      أضيفي بمنتجات بقيمة <b>{formatNumber(remainingForFree)} {currency}</b> واحصلي على شحن مجاني!
                    </span>
                  </p>
                )}
                <div className="tr">
                  <i style={{ width: `${freeProgressPct}%` }} />
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div style={{ marginTop: '14px' }}>
              {items.length === 0 ? (
                <div className="emp">
                  <b>الحقيبة فاضية</b>
                  اختاري منتجاتك وارجعي تكملي طلبك.
                  <div style={{ marginTop: '16px' }}>
                    <Link
                      href="/"
                      className="go"
                      style={{ maxWidth: '220px', margin: '0 auto', textDecoration: 'none' }}
                    >
                      ابدئي التسوق الآن
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {items.map((i) => (
                    <div className="it" key={i.key} data-id={i.key}>
                      <div
                        className="im"
                        style={{
                          backgroundImage: i.img ? `url(${i.img})` : undefined,
                        }}
                      >
                        {!i.img && (
                          <span dangerouslySetInnerHTML={{ __html: renderIcon('bag', 40) }} />
                        )}
                      </div>
                      <div className="tx">
                        <div className="nm">{i.name}</div>
                        <div className="pr">
                          {formatNumber(i.price)} {currency}
                        </div>
                        <div className="qt">
                          <button
                            type="button"
                            aria-label="تقليل"
                            onClick={() => {
                              if (i.qty > 1) setQty(i.key, i.qty - 1);
                              else removeItem(i.key);
                            }}
                          >
                            −
                          </button>
                          <span>{i.qty}</span>
                          <button
                            type="button"
                            aria-label="زيادة"
                            onClick={() => {
                              if (i.qty < 20) setQty(i.key, i.qty + 1);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rm"
                        aria-label={`حذف ${i.name}`}
                        onClick={() => removeItem(i.key)}
                        dangerouslySetInnerHTML={{ __html: renderIcon('trash', 18) }}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className="clr"
                    onClick={() => clearCart()}
                  >
                    <span dangerouslySetInnerHTML={{ __html: renderIcon('trash', 16) }} />
                    إفراغ الحقيبة
                  </button>
                </>
              )}
            </div>

            {/* Cart Upsell / Order Bump (Feature 1) */}
            {items.length > 0 && availableUpsells.length > 0 && (
              <div className="ob">
                <div className="ob-hd">
                  <b>
                    <span dangerouslySetInnerHTML={{ __html: renderIcon('gift', 18) }} />
                    أضيفي لطلبكِ بسعر خاص 🌸
                  </b>
                  <span>زيادة سريعة</span>
                </div>
                <div className="ob-ls">
                  {availableUpsells.map((up) => (
                    <div key={up.id} className="ob-it">
                      <div
                        className="ob-im"
                        style={{
                          backgroundImage: up.image ? `url(${up.image})` : undefined,
                        }}
                      />
                      <div className="ob-dt">
                        <div className="ob-nm" title={up.nameAr}>{up.nameAr}</div>
                        <div className="ob-pr">{formatNumber(up.price)} {currency}</div>
                      </div>
                      <button
                        type="button"
                        className="ob-btn"
                        onClick={() => {
                          addItem({
                            id: up.id,
                            slug: up.slug,
                            nameAr: up.nameAr,
                            price: up.price,
                            image: up.image,
                          }, 1);
                        }}
                      >
                        + أضيفي
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel 1 Navigation */}
            {items.length > 0 && (
              <div className="nav">
                <button
                  className="go"
                  type="button"
                  onClick={() => goToStep(2)}
                >
                  التالي: بيانات التوصيل
                </button>
              </div>
            )}
          </section>

          {/* PANEL 2: بيانات التوصيل (Delivery Details) */}
          <section className={`pan ${step === 2 ? 'on' : ''}`} data-p="2">
            <form className="fm" id="fm" noValidate onSubmit={(e) => e.preventDefault()}>
              <h3>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('pin', 28) }} />
                بيانات التوصيل
              </h3>

              <div className="fg">
                {/* الاسم */}
                <div
                  className={`f w ${
                    touched.name && errors.name ? 'bad' : touched.name && !errors.name ? 'good' : ''
                  }`}
                  data-f="name"
                >
                  <label htmlFor="f_name">
                    <span>الاسم بالكامل</span>
                  </label>
                  <div className="vw">
                    <input
                      id="f_name"
                      name="name"
                      type="text"
                      placeholder="مثال: سارة أحمد"
                      autoComplete="name"
                      value={vals.name}
                      onChange={(e) => setVals((v) => ({ ...v, name: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    />
                  </div>
                  <div className="er" role="alert">
                    {touched.name ? errors.name : ''}
                  </div>
                </div>

                {/* رقم الهاتف */}
                <div
                  className={`f ${
                    touched.phone && errors.phone ? 'bad' : touched.phone && !errors.phone ? 'good' : ''
                  }`}
                  data-f="phone"
                >
                  <label htmlFor="f_phone">
                    <span>رقم الهاتف</span>
                  </label>
                  <div className="vw">
                    <input
                      id="f_phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="01012345678"
                      autoComplete="tel"
                      value={vals.phone}
                      onChange={(e) => setVals((v) => ({ ...v, phone: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    />
                  </div>
                  <div className="er" role="alert">
                    {touched.phone ? errors.phone : ''}
                  </div>
                </div>

                {/* الإيميل */}
                <div
                  className={`f ${
                    touched.email && errors.email ? 'bad' : touched.email && vals.email ? 'good' : ''
                  }`}
                  data-f="email"
                >
                  <label htmlFor="f_email">
                    <span>الإيميل (اختياري)</span>
                    <em>لتصلكِ تأكيدات الطلب</em>
                  </label>
                  <div className="vw">
                    <input
                      id="f_email"
                      name="email"
                      type="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={vals.email}
                      onChange={(e) => setVals((v) => ({ ...v, email: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    />
                  </div>
                  <div className="er" role="alert">
                    {touched.email ? errors.email : ''}
                  </div>
                </div>

                {/* المدينة */}
                <div
                  className={`f ${
                    touched.city && errors.city ? 'bad' : touched.city && !errors.city ? 'good' : ''
                  }`}
                  data-f="city"
                >
                  <label htmlFor="f_city">
                    <span>المدينة</span>
                  </label>
                  <div className="vw">
                    <input
                      id="f_city"
                      name="city"
                      type="text"
                      list="gov"
                      placeholder="مثال: القاهرة"
                      autoComplete="address-level1"
                      value={vals.city}
                      onChange={(e) => setVals((v) => ({ ...v, city: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                    />
                  </div>
                  <div className="er" role="alert">
                    {touched.city ? errors.city : ''}
                  </div>
                </div>

                {/* العنوان */}
                <div
                  className={`f w ${
                    touched.addr && errors.addr ? 'bad' : touched.addr && !errors.addr ? 'good' : ''
                  }`}
                  data-f="addr"
                >
                  <label htmlFor="f_addr">
                    <span>العنوان بالتفصيل</span>
                  </label>
                  <div className="vw">
                    <textarea
                      id="f_addr"
                      name="addr"
                      placeholder="الشارع، رقم العمارة، الدور، علامة مميزة..."
                      autoComplete="street-address"
                      value={vals.addr}
                      onChange={(e) => setVals((v) => ({ ...v, addr: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, addr: true }))}
                    />
                  </div>
                  <div className="er" role="alert">
                    {touched.addr ? errors.addr : ''}
                  </div>
                </div>

                {/* ملاحظات */}
                <div className="f w" data-f="note">
                  <label htmlFor="f_note">
                    <span>ملاحظات (اختياري)</span>
                  </label>
                  <div className="vw">
                    <textarea
                      id="f_note"
                      name="note"
                      placeholder="مثال: تغليف هدية لعيد ميلاد"
                      value={vals.note}
                      onChange={(e) => setVals((v) => ({ ...v, note: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <datalist id="gov">
                {EG_GOVERNORATES.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </form>

            {/* Value chips */}
            <div className="tc">
              <span>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('ret', 15) }} />
                إرجاع خلال 14 يوم
              </span>
              <span>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('cash', 15) }} />
                الدفع عند الاستلام
              </span>
              <span>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('truck', 15) }} />
                شحن مجاني فوق {formatNumber(freeThreshold)} {currency}
              </span>
            </div>

            {/* Panel 2 Navigation */}
            <div className="nav">
              <button
                className="bk"
                type="button"
                onClick={() => goToStep(1)}
              >
                رجوع
              </button>
              <button
                className="go"
                type="button"
                onClick={() => {
                  setTouched({ name: true, phone: true, email: true, city: true, addr: true });
                  const { ok, errors } = validateForm();
                  if (!ok) {
                    shakeForm();
                    focusFirstError(errors);
                    return;
                  }
                  goToStep(3);
                }}
              >
                التالي: مراجعة الطلب
              </button>
            </div>
          </section>

          {/* PANEL 3: المراجعة والتأكيد (Review & WhatsApp Confirm) */}
          <section className={`pan ${step === 3 ? 'on' : ''}`} data-p="3">
            {/* Review summary box */}
            <div className="rv">
              <div>
                <b>الاسم:</b> {vals.name}
              </div>
              <div>
                <b>الموبايل:</b> {vals.phone}
              </div>
              <div>
                <b>العنوان:</b> {vals.city}، {vals.addr}
              </div>
              {vals.note && (
                <div>
                  <b>ملاحظات:</b> {vals.note}
                </div>
              )}
            </div>

            {/* Totals Lines */}
            <div className="ln">
              <span>الإجمالي الفرعي</span>
              <b>
                {formatNumber(subtotal)} {currency}
              </b>
            </div>
            <div className="ln sh">
              <span>الشحن</span>
              {isFreeShipping ? (
                <b className="fr">مجاني</b>
              ) : (
                <b style={{ fontSize: '0.85rem', color: 'var(--wd)' }}>
                  يُحدد مع المسؤولة عبر واتساب
                </b>
              )}
            </div>
            {discount > 0 && (
              <div className="ln ds">
                <span>خصم {appliedCoupon?.code}</span>
                <b>
                  − {formatNumber(discount)} {currency}
                </b>
              </div>
            )}
            <div className="tot">
              <span>الإجمالي</span>
              <b data-tot>{formatNumber(total)} {currency}</b>
            </div>

            {/* Coupon input */}
            <div className="cp">
              <input
                id="cpi"
                placeholder="كود الخصم"
                aria-label="كود الخصم"
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value)}
                disabled={!!appliedCoupon}
              />
              <button type="button" id="cpb" onClick={handleApplyCoupon}>
                {appliedCoupon ? 'إلغاء' : 'تطبيق'}
              </button>
            </div>
            {couponMsg && (
              <div className={`cpm ${couponMsg.isError ? 'er' : 'ok'}`}>
                {couponMsg.text}
              </div>
            )}

            {/* Value chips */}
            <div className="tc">
              <span>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('ret', 15) }} />
                إرجاع خلال 14 يوم
              </span>
              <span>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('cash', 15) }} />
                الدفع عند الاستلام
              </span>
              <span>
                <span dangerouslySetInnerHTML={{ __html: renderIcon('truck', 15) }} />
                شحن مجاني فوق {formatNumber(freeThreshold)} {currency}
              </span>
            </div>

            {/* Main CTA: Confirm & send to WhatsApp */}
            <button
              className={`go ${submitting ? 'ld' : ''}`}
              type="button"
              onClick={handleSubmitOrder}
              disabled={submitting || items.length === 0}
            >
              <span dangerouslySetInnerHTML={{ __html: renderIcon('wa', 22) }} />
              <span>
                تأكيد الطلب — <b>{formatNumber(total)}</b> {currency}
              </span>
            </button>

            <p className="nt">
              الدفع عند الاستلام متاح لجميع المحافظات
              <br />
              لا يلزم إنشاء حساب — الطلب كضيفة في أقل من دقيقة
            </p>

            <div className="nav" style={{ marginTop: '6px' }}>
              <button
                className="bk"
                type="button"
                onClick={() => goToStep(2)}
              >
                رجوع للتعديل
              </button>
            </div>
          </section>
        </div>

        {/* Mobile Sticky Bar: fixed at bottom on small viewports */}
        {items.length > 0 && (
          <div className="mb">
            <span>
              الإجمالي <small>({totalQty} منتج)</small>
            </span>
            <b>
              {formatNumber(total)} {currency}
            </b>
          </div>
        )}
      </main>

      {/* Success Modal */}
      <div
        className={`md ${orderModal ? 'on' : ''}`}
        id="md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mt"
        onClick={(e) => {
          if (e.target === e.currentTarget) setOrderModal(null);
        }}
      >
        <div className="bx" id="bx">
          {/* Falling petals */}
          {Array.from({ length: 9 }).map((_, i) => (
            <svg
              key={i}
              className="pt"
              viewBox="0 0 24 24"
              style={{
                left: `${6 + i * 11}%`,
                animationDuration: `${5 + (i % 4)}s`,
                animationDelay: `${i * 0.4}s`,
              }}
              dangerouslySetInnerHTML={{ __html: ICONS.flower }}
            />
          ))}

          {/* Close button */}
          <button
            className="cx"
            ref={modalCloseBtnRef}
            aria-label="إغلاق"
            type="button"
            onClick={() => {
              setOrderModal(null);
              clearCart();
              if (lastActiveElementRef.current) {
                lastActiveElementRef.current.focus();
              }
            }}
            dangerouslySetInnerHTML={{ __html: renderIcon('x', 18) }}
          />

          <div
            className="ba"
            dangerouslySetInnerHTML={{ __html: renderIcon('party', 46) }}
          />

          <h2 id="mt">تم استلام طلبك بنجاح!</h2>
          <p>شكرًا لثقتكِ بلوبنيل، رقم طلبك:</p>

          <div className="no">
            <span>{orderModal?.id}</span>
            <button
              type="button"
              id="cpy"
              onClick={() => {
                if (orderModal?.id && navigator.clipboard) {
                  navigator.clipboard.writeText(orderModal.id);
                  setOrderModal((m) => (m ? { ...m, copied: true } : null));
                }
              }}
            >
              {orderModal?.copied ? 'اتنسخ' : 'نسخ'}
            </button>
          </div>

          <p>جهّزنا رسالة واتساب بتفاصيل طلبك. لو ما اتفتحتش لوحدها اضغطي الزر تحت.</p>

          <div className="acts">
            <a
              className="wa"
              href={orderModal?.waUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span dangerouslySetInnerHTML={{ __html: renderIcon('wa', 22) }} />
              فتح واتساب وإرسال الطلب
            </a>
            <button
              className="ct"
              type="button"
              onClick={() => {
                setOrderModal(null);
                clearCart();
                router.push('/');
              }}
            >
              متابعة التسوق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
