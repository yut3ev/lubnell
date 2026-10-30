'use client';

// LU-ASSISTANT-2026-10 — «اسألي لُو» gift-finder card.
//
// DESIGN SOURCE: the official reference lu-assistant.html — the markup, CSS,
// palette (#6a2430/#3d1119/#f4ece1/#b48d52/#d9bb86), fonts (Amiri + Cairo),
// motion (typewriter lines, swinging gift card, floating ornaments) and the
// container-query responsive behavior are ported 1:1 from it. The only edits,
// all invisible to the eye:
//   1. fonts resolve through next/font variables (--font-lu-amiri is the
//      card's own Amiri 700; --font-cairo is the store's Cairo) because the
//      site loads its fonts through next/font and literal family names would
//      never match — same rendered fonts as the reference;
//   2. the motion pauses (animation-play-state) while the card is off-screen;
//   3. the gift card gets a :focus-visible outline when it is a link (keyboard
//      access, same treatment as the CTA).
//
// DATA CONTRACT (window.LU_CONFIG — every key optional):
//   endpoint         JSON products URL (default '/api/lu-products', 4s timeout)
//   map(raw)         store product → {name, price, occasions[], url}
//   items            manual array fallback when the endpoint is null/failed
//   demo             preview data switch — FALSE in production (default false)
//   chatUrl          assistant page/window URL; gets ?occasion&budget&item
//   cycleMs          how long each card stays filled (default 6500)
//   title            gift-card headline (default «إلى مَن تحبين»)
//   currency         default «جنيه»
// Failed or empty data → generic occasions («على قد ميزانيتك») — real names
// and prices only, never placeholders.

import { useEffect, useRef } from 'react';
import { Amiri } from 'next/font/google';

const amiri = Amiri({ weight: '700', subsets: ['arabic', 'latin'], variable: '--font-lu-amiri', display: 'swap' });

type LuItem = { name: string; price: number; occasions: string[]; url: string };

type LuRaw = {
  nameAr?: string;
  nameEn?: string;
  name?: string;
  title?: string;
  price?: number;
  sale_price?: number;
  occasions?: string[];
  tags?: string[];
  slug?: string;
  url?: string;
  link?: string;
  badgeAr?: string;
  category?: { nameAr?: string; nameEn?: string } | null;
};

type LuCard = { o: string; b: string; p: string; u: string; q: { occasion: string; budget?: number; item?: string } };

type LuConfig = {
  endpoint: string | null;
  items: LuRaw[] | null;
  demo: boolean;
  chatUrl: string;
  cycleMs: number;
  title: string;
  currency: string;
  map: (r: LuRaw) => LuItem;
  fallbackOccasions: string[];
};

export type LuCardProps = Partial<Omit<LuConfig, 'map' | 'fallbackOccasions'>> & {
  map?: (r: LuRaw) => LuItem;
  fallbackOccasions?: string[];
};

/* المناسبة = أول تصنيف/وسم «مناسباتي» على المنتج (بوكسات عرايس، هدايا عيد الأم…).
   الأقسام الحالية (عناية/مكياج/عطور…) مش مناسبات فتسيب المصفوفة فاضية عشان
   الكارت يعرض «هدية مميزة» بدل ما يلفّ قسم تجميل كأنه مناسبة. */
const LU_OCCASION_RE = /ميلاد|خطوبة|زفاف|عرايس|عروس|تخرج|عيد ?الأم|زواج|ذكرى|نجاح|عيد/;

function defaultStoreMap(r: LuRaw): LuItem {
  const cat = r.category?.nameAr || '';
  const badge = typeof r.badgeAr === 'string' ? r.badgeAr : '';
  return {
    name: String(r.nameAr || r.nameEn || r.name || r.title || ''),
    price: Number(r.price ?? r.sale_price) || 0,
    occasions: [cat, badge].filter((t) => !!t && LU_OCCASION_RE.test(t)),
    url: r.slug ? `/p/${r.slug}` : String(r.url || r.link || ''),
  };
}

/* بيانات المعاينة فقط — demo:false في الإنتاج فمش بتظهر أبدًا. */
const DEMO: LuRaw[] = [
  { name: 'بوكس عناية بالبشرة', price: 390, occasions: ['عيد ميلاد', 'عيد الأم'] },
  { name: 'طقم إكسسوار فضة', price: 880, occasions: ['خطوبة', 'ذكرى زواج'] },
  { name: 'ألبوم صور مطبوع', price: 240, occasions: ['عيد الأم', 'عيد ميلاد'] },
  { name: 'بوكيه ورد فاخر', price: 450, occasions: ['خطوبة', 'تخرج'] },
  { name: 'ساعة كلاسيك', price: 1400, occasions: ['تخرج', 'نجاح'] },
];

const DEFAULTS: LuConfig = {
  endpoint: '/api/lu-products',
  items: null,
  demo: false,
  chatUrl: '#',
  cycleMs: 6500,
  title: 'إلى مَن تحبين',
  currency: 'جنيه',
  map: defaultStoreMap,
  fallbackOccasions: ['عيد ميلاد', 'خطوبة', 'تخرج', 'عيد الأم'],
};

declare global {
  interface Window {
    LU_CONFIG?: Partial<LuConfig>;
    LuAssistant?: { reload: () => Promise<void> };
  }
}

/* ===== مرجع lu-assistant.html — الـ CSS منقول حرفيًا (مع بادئة .lu للعزل) ===== */
const LU_CSS = `
.lu{--w:#6a2430;--wd:#3d1119;--iv:#f4ece1;--pp:#fbf7f0;--gold:#b48d52;--gl:#d9bb86;--ink:#26171b;--mut:#7d6469;--ease:cubic-bezier(.2,.8,.2,1);--serif:var(--font-lu-amiri,Amiri),'Noto Naskh Arabic',serif;--body-font:var(--font-cairo,Cairo),system-ui,sans-serif;container-type:inline-size;max-width:760px;margin-inline:auto;font-family:var(--body-font)}
.lu-wrap{padding:32px 16px}
.lu .c{position:relative;overflow:hidden;background:var(--wd);color:var(--iv);display:grid;grid-template-columns:1fr 280px;gap:10px;padding:48px 24px 48px 44px;min-height:440px;align-items:center;border-radius:4px}
.lu .c::before{content:"";position:absolute;inset:0;background:radial-gradient(70% 90% at 15% 50%,#6a243066,transparent 70%)}
.lu .dc{position:absolute;inset:0;pointer-events:none;color:var(--gl)}
.lu .dc svg{position:absolute;width:var(--s);height:var(--s);fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;opacity:.17;animation:fl var(--t) ease-in-out infinite alternate}
@keyframes fl{from{transform:translateY(-5px) rotate(var(--r))}to{transform:translateY(6px) rotate(calc(var(--r) + 6deg))}}
.lu .dc svg:nth-child(n+7){display:none}
.lu .tx{position:relative;padding-inline-start:4px}
.lu .c h2{font-family:var(--serif);font-weight:700;margin:0;line-height:1.45;font-size:2.3rem}
.lu .c p{margin:14px 0 26px;color:#dcc7c0;line-height:1.9}
.lu .cta{display:inline-flex;align-items:center;justify-content:center;height:56px;padding:0 34px;border-radius:2px;background:var(--iv);color:var(--wd);font-weight:700;font-size:1rem;font-family:var(--body-font);text-decoration:none;position:relative;overflow:hidden;isolation:isolate}
.lu .cta::before{content:"";position:absolute;inset:0;background:var(--gl);transform:scaleX(0);transform-origin:right;transition:transform .5s var(--ease);z-index:-1}
.lu .cta:hover::before,.lu .cta:focus-visible::before{transform:scaleX(1)}
.lu .cta:focus-visible{outline:2px solid var(--gl);outline-offset:3px}
.lu .note{display:block;margin-top:12px;font-size:.85rem;color:#c9aaa4}
.lu .hg{position:relative;display:flex;justify-content:center;align-self:stretch}
.lu .tg{position:relative;width:240px;margin-top:48px;align-self:flex-start;transform-origin:50% -100px;animation:swing 7s ease-out both,idle 6s 7s ease-in-out infinite alternate;cursor:default}
.lu .tg.lk{cursor:pointer}
@keyframes swing{0%{transform:rotate(14deg)}20%{transform:rotate(-9deg)}40%{transform:rotate(5.5deg)}60%{transform:rotate(-3deg)}80%{transform:rotate(1.4deg)}100%{transform:rotate(0)}}
@keyframes idle{from{transform:rotate(-.8deg)}to{transform:rotate(.8deg)}}
.lu .tg::before{content:"";position:absolute;left:50%;top:-130px;width:2px;height:160px;margin-left:-1px;background:linear-gradient(var(--gl),var(--gold))}
.lu .tg .body{position:relative;background:var(--pp);color:var(--ink);padding:44px 22px 24px;clip-path:polygon(18% 0,82% 0,100% 11%,100% 100%,0 100%,0 11%);filter:drop-shadow(0 24px 30px #0007)}
.lu .tg .body::before{content:"";position:absolute;top:22px;left:50%;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:var(--wd);box-shadow:inset 0 0 0 3px var(--gl)}
.lu .tl{font-family:var(--serif);font-size:1.45rem;color:var(--w);text-align:center;margin-bottom:6px}
.lu .ln span{flex:none;white-space:nowrap}
.lu .ln{display:flex;align-items:baseline;gap:8px;border-bottom:1px dashed #cdbba3;padding:11px 0 7px;font-size:.85rem;color:var(--mut)}
.lu .ln b{font-family:var(--serif);font-size:1.15rem;color:var(--wd);min-height:1.7em;display:inline-block;line-height:1.5}
.lu .ln.act b::after{content:"";display:inline-block;width:1px;height:1em;background:var(--w);margin-inline-start:2px;vertical-align:middle;animation:bk 1s steps(1) infinite}
@keyframes bk{50%{opacity:0}}
.lu .sm{margin-top:16px;display:flex;justify-content:space-between;align-items:center;font-family:var(--serif);color:var(--gold);font-size:.95rem}
.lu .sm i{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--gold);display:grid;place-items:center;font-style:normal;font-size:1.2rem;color:var(--w);transform:rotate(-12deg)}
.lu .tg:focus-visible{outline:2px solid var(--gl);outline-offset:3px}
.lu .c.off .tg,.lu .c.off .dc svg{animation-play-state:paused}
@container (max-width:600px){.lu .c{grid-template-columns:1fr;padding:30px 22px 40px;gap:0;min-height:0}.lu .hg{order:-1;padding:70px 0 34px}.lu .tg{margin-top:0}.lu .tx{padding:0}.lu .c h2{font-size:1.75rem}.lu .cta{width:100%}.lu .note{text-align:center}.lu .dc svg:nth-child(n+5){display:none}}
@container (min-width:601px){.lu .dc svg:nth-child(n+7){display:block}}
@media(prefers-reduced-motion:reduce){.lu .tg,.lu .dc svg{animation:none!important}}
`;

export function LuAssistantCard(props: LuCardProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = (s: string) => root.querySelector<HTMLElement>(s);
    const red = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sl = (t: number) => new Promise<void>((r) => setTimeout(r, t));
    const N = (n: number) => Number(n).toLocaleString('ar-EG');

    let CFG: LuConfig = DEFAULTS;
    let items: LuItem[] = [];
    let vis = true;
    let run = 0;
    let cur: LuCard | null = null;

    function tiers(p: number): number {
      // شرائح الميزانية: أقرب شريحة أعلى من سعر المنتج
      const T = [300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];
      for (const t of T) if (t >= p) return t;
      return Math.ceil(p / 1000) * 1000;
    }

    function clean(list: LuRaw[] | null): LuItem[] {
      return (list || [])
        .map(CFG.map)
        .filter((x) => x && x.name && x.price > 0)
        .map((x) => ({ ...x, occasions: ([] as string[]).concat(x.occasions || []).filter(Boolean) }));
    }

    async function load() {
      CFG = { ...DEFAULTS, ...(window.LU_CONFIG || {}), ...propsRef.current };
      let raw: LuRaw[] | null = null;
      if (CFG.endpoint) {
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 4000);
          const r = await fetch(CFG.endpoint, { signal: c.signal });
          clearTimeout(t);
          if (r.ok) {
            const j: unknown = await r.json();
            if (Array.isArray(j)) raw = j as LuRaw[];
            else {
              const bag = j as { items?: LuRaw[]; products?: LuRaw[] };
              raw = bag.items || bag.products || null;
            }
          }
        } catch {
          /* endpoint فشل أو التايم-أوت → items/demo/fallback */
        }
      }
      if (!raw && CFG.items) raw = CFG.items;
      if (!raw && CFG.demo) raw = DEMO;
      items = clean(raw);
      /* تنويع: مناسبات مختلفة ورا بعض */
      const seen: Record<string, number> = {};
      items.sort((a, b) => (seen[a.occasions[0]] = (seen[a.occasions[0]] || 0) + 1) - (seen[b.occasions[0]] = (seen[b.occasions[0]] || 0) + 1));
    }

    function cards(): LuCard[] {
      if (items.length) {
        return items.map((x) => {
          const occ = x.occasions[0] || 'هدية مميزة';
          return {
            o: occ,
            b: 'حتى ' + N(tiers(x.price)) + ' ' + CFG.currency,
            p: x.name,
            u: x.url,
            q: { occasion: occ, budget: tiers(x.price), item: x.name },
          };
        });
      }
      return CFG.fallbackOccasions.map((o) => ({ o, b: 'على قد ميزانيتك', p: 'هنختارلك الأنسب', u: '', q: { occasion: o } }));
    }

    function setLink(d: LuCard) {
      const q = Object.keys(d.q)
        .map((k) => k + '=' + encodeURIComponent(String(d.q[k])))
        .join('&');
      const u = CFG.chatUrl === '#' ? '#' : CFG.chatUrl + (CFG.chatUrl.indexOf('?') < 0 ? '?' : '&') + q;
      const cta = $('#cta');
      if (cta) {
        cta.setAttribute('href', u);
        cta.dataset.ctx = JSON.stringify(d.q);
      }
      cur = d;
      const tg = $('#tg');
      if (tg) {
        tg.classList.toggle('lk', !!d.u);
        if (d.u) {
          tg.setAttribute('tabindex', '0');
          tg.setAttribute('role', 'link');
          tg.setAttribute('aria-label', 'افتحي صفحة ' + d.p);
        } else {
          tg.removeAttribute('tabindex');
          tg.removeAttribute('role');
          tg.removeAttribute('aria-label');
        }
      }
    }

    async function typ(sel: string, t: string, my: number): Promise<boolean> {
      const el = $(sel);
      const p = el?.parentElement;
      if (!el || !p) return false;
      el.textContent = '';
      p.classList.add('act');
      for (let i = 1; i <= t.length; i++) {
        if (my !== run) return false;
        el.textContent = t.slice(0, i);
        if (!red) await sl(60);
      }
      p.classList.remove('act');
      return true;
    }

    async function loop() {
      const my = ++run;
      const list = cards();
      if (!list.length) return;
      let n = 0;
      const tt = $('#tt');
      if (tt) tt.textContent = CFG.title;
      while (my === run) {
        const d = list[n++ % list.length];
        setLink(d);
        ['#l1', '#l2', '#l3'].forEach((s) => {
          const el = $(s);
          if (el) el.textContent = '';
        });
        while (!vis || document.hidden) {
          await sl(500);
          if (my !== run) return;
        }
        await sl(red ? 0 : 600);
        const v = [d.o, d.b, d.p];
        for (let i = 0; i < 3; i++) {
          if (!(await typ('#l' + (i + 1), v[i], my))) return;
          await sl(red ? 0 : 200);
        }
        if (red && list.length > 1) {
          const l1 = $('#l1');
          if (l1) l1.textContent = d.o;
        }
        await sl(CFG.cycleMs);
      }
    }

    function onCta(e: MouseEvent) {
      const el = e.currentTarget as HTMLAnchorElement | null;
      if (!el) return;
      let ctx: Record<string, unknown> = {};
      try {
        ctx = JSON.parse(el.dataset.ctx || '{}');
      } catch {
        ctx = {};
      }
      const ev = new CustomEvent('lu:open', { bubbles: true, cancelable: true, detail: ctx });
      if (!el.dispatchEvent(ev)) e.preventDefault();
    }

    function onTg() {
      if (cur && cur.u) location.href = cur.u;
    }

    function onTgKey(e: KeyboardEvent) {
      if ((e.key === 'Enter' || e.key === ' ') && cur && cur.u) {
        e.preventDefault();
        location.href = cur.u;
      }
    }

    const cta = $('#cta');
    const tg = $('#tg');
    cta?.addEventListener('click', onCta);
    tg?.addEventListener('click', onTg);
    tg?.addEventListener('keydown', onTgKey);

    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            vis = entries[0].isIntersecting;
            $('.c')?.classList.toggle('off', !vis);
          })
        : null;
    if (io) io.observe(root);

    window.LuAssistant = { reload: () => load().then(loop) };
    load().then(loop);

    return () => {
      run++;
      if (io) io.disconnect();
      cta?.removeEventListener('click', onCta);
      tg?.removeEventListener('click', onTg);
      tg?.removeEventListener('keydown', onTgKey);
      if (window.LuAssistant) delete window.LuAssistant;
    };
  }, []);

  return (
    <div className="lu-wrap">
      <div className={`lu ${amiri.variable}`} ref={rootRef} dir="rtl">
        <style dangerouslySetInnerHTML={{ __html: LU_CSS }} />
        {/* symbols — نفس أشكال المرجع (زهور، هدايا، أوراق، قلوب، لمعة، فيونكة) */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <symbol id="i-flower" viewBox="0 0 64 64">
              <circle cx="32" cy="30" r="5" />
              <path d="M32 25c-6-8-2-17 0-17s6 9 0 17zM32 35c-6 8-2 17 0 17s6-9 0-17zM27 30c-8-6-17-2-17 0s9 6 17 0zM37 30c8 6 17 2 17 0s-9-6-17 0z" />
              <path d="M32 52c0 6 2 9 2 9" />
            </symbol>
            <symbol id="i-gift" viewBox="0 0 64 64">
              <rect x="10" y="26" width="44" height="30" rx="2" />
              <rect x="6" y="18" width="52" height="10" rx="2" />
              <path d="M32 18v38M32 18c-5-9-16-9-14-3s14 3 14 3zM32 18c5-9 16-9 14-3s-14 3-14 3z" />
            </symbol>
            <symbol id="i-leaf" viewBox="0 0 64 64">
              <path d="M32 60C32 40 32 22 32 6M32 22c-10 0-16-6-16-12 10 0 16 4 16 12zM32 34c10 0 16-6 16-12-10 0-16 4-16 12zM32 46c-9 0-14-5-14-10 9 0 14 4 14 10z" />
            </symbol>
            <symbol id="i-heart" viewBox="0 0 64 64">
              <path d="M32 54C14 40 8 31 8 22a12 12 0 0124-4 12 12 0 0124 4c0 9-6 18-24 32z" />
            </symbol>
            <symbol id="i-spark" viewBox="0 0 64 64">
              <path d="M32 6c2 14 8 24 26 26-18 2-24 12-26 26-2-14-8-24-26-26 18-2 24-12 26-26z" />
            </symbol>
            <symbol id="i-bow" viewBox="0 0 64 64">
              <path d="M32 30c-8-14-26-12-24-2s18 8 24 2zM32 30c8-14 26-12 24-2s-18 8-24 2zM32 30l-10 24M32 30l10 24" />
              <circle cx="32" cy="30" r="3" />
            </symbol>
          </defs>
        </svg>
        <div className="c">
          <div className="dc" aria-hidden="true">
            <svg style={{ '--s': '96px', '--r': '-12deg', '--t': '9s', insetInlineStart: '-14px', top: '-18px' } as React.CSSProperties}><use href="#i-flower" /></svg>
            <svg style={{ '--s': '70px', '--r': '10deg', '--t': '11s', insetInlineEnd: '34%', top: '22px' } as React.CSSProperties}><use href="#i-spark" /></svg>
            <svg style={{ '--s': '84px', '--r': '-20deg', '--t': '10s', insetInlineStart: '6%', bottom: '-16px' } as React.CSSProperties}><use href="#i-gift" /></svg>
            <svg style={{ '--s': '64px', '--r': '14deg', '--t': '12s', insetInlineEnd: '4%', bottom: '12px' } as React.CSSProperties}><use href="#i-heart" /></svg>
            <svg style={{ '--s': '110px', '--r': '8deg', '--t': '13s', insetInlineEnd: '-26px', top: '14%' } as React.CSSProperties}><use href="#i-leaf" /></svg>
            <svg style={{ '--s': '56px', '--r': '-8deg', '--t': '9s', insetInlineStart: '30%', bottom: '8px' } as React.CSSProperties}><use href="#i-bow" /></svg>
            <svg style={{ '--s': '60px', '--r': '18deg', '--t': '10s', insetInlineStart: '44%', top: '-10px' } as React.CSSProperties}><use href="#i-heart" /></svg>
            <svg style={{ '--s': '80px', '--r': '-14deg', '--t': '12s', insetInlineStart: '14%', top: '38%' } as React.CSSProperties}><use href="#i-leaf" /></svg>
          </div>
          <div className="tx">
            <h2>محتارة في اختيار هدية؟ اسألي لُو</h2>
            <p>مساعدتنا الذكية تفهم الهدية والمناسبة والميزانية، وتختار لك من منتجات المتجر الأنسب.</p>
            <a className="cta" id="cta" href="#">اسألي لُو الآن</a>
            <span className="note">ترد عليكي خلال لحظات</span>
          </div>
          <div className="hg">
            <div className="tg" id="tg" aria-live="off">
              <div className="body">
                <div className="tl" id="tt">إلى مَن تحبين</div>
                <div className="ln"><span>المناسبة</span><b id="l1" /></div>
                <div className="ln"><span>الميزانية</span><b id="l2" /></div>
                <div className="ln"><span>اقتراح لُو</span><b id="l3" /></div>
                <div className="sm"><span>بكل حب</span><i>لُو</i></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
