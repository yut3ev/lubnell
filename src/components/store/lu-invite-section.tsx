'use client';

// NV-INVITE-2026-10 — «انضمي إلى نادي لوبنيل» newsletter invite panel.
//
// DESIGN SOURCE: the official reference lubnel-invite.html — variant B (the
// invitation envelope). The markup, CSS, palette (#3d1119/#6a2430/#f4ece1/
// #b48d52/#d9bb86), fonts (Amiri 400+700 + Cairo), the envelope open/close +
// wax-seal animation, the underline-only fields with the sharp rectangle
// button, the float ornaments and the container-query responsive behavior are
// ported 1:1. Invisible technical deltas only:
//   1. fonts resolve through next/font variables (--font-nv-amiri is this
//      card's own Amiri 400+700; --font-cairo is the store's Cairo);
//   2. keyframes are renamed nv-* so they can never collide with the site's;
//   3. the prefers-reduced-motion kill-switch is scoped to this panel
//      instead of the whole page;
//   4. a visually-hidden honeypot input (spam trap) sits inside the form —
//      zero design impact.
//
// BINDING (window.LUBNEL_CONFIG — optional): { onSubmit({email,name}) } may
// override the default store action, which POSTs /api/store/subscribe
// (validated server-side; duplicate emails resolve as plain success; the
// welcome email carries the one-time discount code + unsubscribe link).
// Resolve = success flow (letter slides in, flap closes, wax seal stamps,
// form swaps to the success message); reject = «حصلت مشكلة…» and the form
// stays open.

import { useEffect, useRef, useState } from 'react';
import { Amiri } from 'next/font/google';

const amiriNV = Amiri({ weight: ['400', '700'], subsets: ['arabic', 'latin'], variable: '--font-nv-amiri', display: 'swap' });

type LuSubmit = (d: { email: string; name: string }) => Promise<void>;

export type LuInviteProps = { onSubmit?: LuSubmit };

declare global {
  interface Window {
    LUBNEL_CONFIG?: { onSubmit?: LuSubmit };
  }
}

async function defaultSubmit(d: { email: string; name: string }, hp: string): Promise<void> {
  const res = await fetch('/api/store/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: d.email, name: d.name, lang: 'ar', website: hp }),
  });
  if (!res.ok) throw new Error(String(res.status));
}

/* ===== مرجع lubnel-invite.html — الـ CSS منقول حرفيًا (variant B، مع بادئة .nv) ===== */
const NV_CSS = `
.nv{--w:#6a2430;--wd:#3d1119;--wdd:#2a0b11;--iv:#f4ece1;--pp:#fbf7f0;--gold:#b48d52;--gl:#d9bb86;--ink:#26171b;--mut:#7d6469;--ease:cubic-bezier(.2,.8,.2,1);--serif:var(--font-nv-amiri,Amiri),'Noto Naskh Arabic',serif;--body-font:var(--font-cairo,Cairo),system-ui,sans-serif;container-type:inline-size;font-family:var(--body-font);color:var(--ink)}
.nv-stage{width:100%;max-width:960px;margin:36px auto;padding:0 16px}
.nv .pn{position:relative;overflow:hidden;background:var(--wd);color:var(--iv);border-radius:4px}
.nv .pn::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 80% at 20% 30%,#6a243070,transparent 70%);pointer-events:none}
.nv h2{font-family:var(--serif);font-weight:700;margin:0;line-height:1.4}
.nv .dc{position:absolute;inset:0;pointer-events:none;color:var(--gl)}
.nv .dc svg{position:absolute;width:var(--s);height:var(--s);fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;opacity:.15;animation:nv-fl var(--t) ease-in-out infinite alternate}
@keyframes nv-fl{from{transform:translateY(-5px) rotate(var(--r))}to{transform:translateY(6px) rotate(calc(var(--r) + 6deg))}}
.nv .fm{--fg:var(--iv);--ln:#d9bb8688;--bb:var(--iv);--bf:var(--wd);position:relative;display:grid;gap:16px;color:var(--fg)}
.nv .fl{display:block}
.nv .fl span{display:block;font-size:.82rem;opacity:.75;margin-bottom:2px}
.nv .fl input{width:100%;height:46px;border:0;border-bottom:1.5px solid var(--ln);background:transparent;color:inherit;font:600 1.02rem var(--body-font);outline:0;border-radius:0;unicode-bidi:plaintext;transition:border-color .3s}
.nv .fl input::placeholder{color:inherit;opacity:.35}
.nv .fl input:focus{border-color:var(--gold)}
.nv .sb{position:relative;overflow:hidden;isolation:isolate;height:56px;border:0;border-radius:2px;background:var(--bb);color:var(--bf);font:700 1.02rem var(--body-font);cursor:pointer;margin-top:6px}
.nv .sb::before{content:"";position:absolute;inset:0;background:var(--gl);transform:scaleX(0);transform-origin:right;transition:transform .5s var(--ease);z-index:-1}
.nv .sb:hover::before,.nv .sb:focus-visible::before{transform:scaleX(1)}
.nv .sb:focus-visible{outline:2px solid var(--gl);outline-offset:3px}
.nv .sb.ld{pointer-events:none}
.nv .sb.ld::after{content:"";position:absolute;inset-inline:0;bottom:0;height:3px;background:var(--w);animation:nv-ldb 1s linear infinite;transform-origin:right}
@keyframes nv-ldb{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.nv .er{margin:0;min-height:1.2em;font-size:.84rem;color:#ffb9b0}
.nv .pv{margin:0;font-size:.82rem;opacity:.7}
.nv .fm.sh{animation:nv-shk .4s}
@keyframes nv-shk{20%,60%{transform:translateX(7px)}40%,80%{transform:translateX(-7px)}}
.nv .ok{display:none;position:relative}
.nv .ok.on{display:block;animation:nv-rise .8s var(--ease) both}
@keyframes nv-rise{from{opacity:0;transform:translateY(18px)}}
.nv .ok h3{font:700 1.7rem var(--serif);margin:0 0 6px}
.nv .ok p{margin:0;line-height:1.9;opacity:.85}
.nv .fm.done{display:none}
.nv .b{display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:56px 52px 56px;align-items:center}
.nv .b>:not(.dc){position:relative}
.nv .ev{height:360px;display:grid;align-items:end;justify-items:center}
.nv .env{position:relative;width:min(100%,340px);height:216px;perspective:900px}
.nv .env .bk,.nv .env .ft,.nv .env .fp{position:absolute;inset:0}
.nv .env .bk{background:#d8c5a8;border-radius:4px}
.nv .env .lt{position:absolute;inset:12px 18px auto;height:190px;background:var(--pp);color:var(--wd);padding:20px 22px;transform:translateY(0);transition:transform 1.1s var(--ease) .5s;z-index:2;box-shadow:0 6px 14px #0003}
.nv .env.open .lt{transform:translateY(-124px)}
.nv .lt h4{font:700 1.15rem var(--serif);margin:0 0 8px;text-align:center}
.nv .lt i{display:block;height:1px;background:#e2d6c4;margin:9px 0}
.nv .lt p{margin:0;font-size:.8rem;color:var(--mut);display:flex;gap:8px}
.nv .lt p b{font-family:var(--serif);color:var(--gold)}
.nv .env .ft{z-index:3;background:linear-gradient(#e6d6bb,#dcc9ab);clip-path:polygon(0 0,50% 56%,100% 0,100% 100%,0 100%);border-radius:4px}
.nv .env .fp{height:56%;bottom:auto;background:linear-gradient(#cdb893,#dcc9ab);clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top;transition:transform .8s var(--ease),z-index 0s .35s;z-index:4;border-radius:4px 4px 0 0}
.nv .env.open .fp{transform:rotateX(180deg);z-index:1}
.nv .env .sl{position:absolute;left:50%;top:56%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#a53f4a,#6a2430);z-index:5;display:grid;place-items:center;color:#e8c9bf;font:700 1.7rem var(--serif);box-shadow:0 4px 10px #0006,inset 0 0 0 4px #ffffff18;opacity:0;transform:scale(2.2);transition:opacity .4s,transform .6s var(--ease)}
.nv .env:not(.open) .sl{opacity:1;transform:none}
.nv .b h2{font-size:2.4rem}
.nv .b .sub{margin:12px 0 26px;color:#dcc7c0;line-height:1.9}
@container (max-width:700px){.nv .b{grid-template-columns:1fr;gap:26px;padding:34px 22px}.nv .b h2{font-size:1.9rem}.nv .ev{height:350px;order:-1}.nv .dc svg:nth-child(n+5){display:none}}
@media(prefers-reduced-motion:reduce){.nv *,.nv *::before,.nv *::after{animation-duration:.01s!important;animation-iteration-count:1!important;transition-duration:.01s!important}}
`;

export function LuInviteSection(props: LuInviteProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [doneName, setDoneName] = useState('');

  // المرجع: الظرف بيفتح بعد 300ms من التحميل (وبيبدأ مفتوح في الماركب أصلًا)
  useEffect(() => {
    const t = setTimeout(() => envRef.current?.classList.add('open'), 300);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || done) return;
    const f = formRef.current;
    const emailInput = f?.elements.namedItem('email') as HTMLInputElement | null;
    const nameInput = f?.elements.namedItem('name') as HTMLInputElement | null;
    const email = emailInput?.value.trim() ?? '';
    const name = nameInput?.value.trim() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError('اكتبي بريد إلكتروني صحيح عشان نبعتلك الخصم.');
      if (f) {
        f.classList.remove('sh');
        void f.offsetWidth; // إعادة تشغيل الأنيميشن زي المرجع بالظبط
        f.classList.add('sh');
      }
      emailRef.current?.focus();
      return;
    }
    setError('');
    setBusy(true);
    const cfg = { ...(window.LUBNEL_CONFIG || {}), ...(propsRef.current || {}) };
    const submit: LuSubmit = cfg.onSubmit || ((d) => defaultSubmit(d, hpRef.current?.value || ''));
    try {
      await submit({ email, name });
      setBusy(false);
      setDoneName(name);
      envRef.current?.classList.remove('open'); // الخطاب ينزل، الغطا يقفل، الختم يهبط
      setTimeout(() => setDone(true), 900); // وبعدها الفورم يتبدل برسالة النجاح
    } catch {
      setBusy(false);
      setError('حصلت مشكلة، جربي تاني بعد شوية.');
    }
  }

  return (
    <div className="nv-stage">
      <div className={`nv ${amiriNV.variable}`} ref={rootRef} dir="rtl">
        <style dangerouslySetInnerHTML={{ __html: NV_CSS }} />
        {/* symbols — نفس أشكال المرجع (ورقة، قلب، نجمة) ببادئة nv- للعزل */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <symbol id="nv-i-leaf" viewBox="0 0 64 64">
              <path d="M32 60C32 40 32 22 32 6M32 22c-10 0-16-6-16-12 10 0 16 4 16 12zM32 34c10 0 16-6 16-12-10 0-16 4-16 12zM32 46c-9 0-14-5-14-10 9 0 14 4 14 10z" />
            </symbol>
            <symbol id="nv-i-heart" viewBox="0 0 64 64">
              <path d="M32 54C14 40 8 31 8 22a12 12 0 0124-4 12 12 0 0124 4c0 9-6 18-24 32z" />
            </symbol>
            <symbol id="nv-i-spark" viewBox="0 0 64 64">
              <path d="M32 6c2 14 8 24 26 26-18 2-24 12-26 26-2-14-8-24-26-26 18-2 24-12 26-26z" />
            </symbol>
          </defs>
        </svg>
        <section className="pn b">
          <div className="dc" aria-hidden="true">
            <svg style={{ '--s': '90px', '--r': '-10deg', '--t': '10s', insetInlineEnd: '-14px', top: '-18px' } as React.CSSProperties}><use href="#nv-i-leaf" /></svg>
            <svg style={{ '--s': '70px', '--r': '12deg', '--t': '12s', insetInlineStart: '-10px', bottom: '-8px' } as React.CSSProperties}><use href="#nv-i-heart" /></svg>
            <svg style={{ '--s': '60px', '--r': '8deg', '--t': '9s', insetInlineStart: '44%', top: '20px' } as React.CSSProperties}><use href="#nv-i-spark" /></svg>
          </div>
          <div className="ev" aria-hidden="true">
            <div className="env open" ref={envRef}>
              <div className="bk"></div>
              <div className="lt">
                <h4>دعوة إلى نادي لوبنيل</h4>
                <i></i>
                <p><b>١</b>خصم خاص على أول طلب</p>
                <i></i>
                <p><b>٢</b>وصول مبكر للتشكيلات الجديدة</p>
                <i></i>
                <p><b>٣</b>عروض حصرية للأعضاء</p>
              </div>
              <div className="fp"></div>
              <div className="ft"></div>
              <div className="sl">ل</div>
            </div>
          </div>
          <div>
            <h2>انضمي إلى نادي لوبنيل</h2>
            <p className="sub">خصم خاص على أول طلب، ووصول مبكر للتشكيلات الجديدة والعروض الحصرية.</p>
            <form className={`fm${done ? ' done' : ''}`} noValidate onSubmit={handleSubmit} ref={formRef}>
              {/* honeypot — مصيدة سبام مخفية تمامًا (بدون أي تغيير في التصميم) */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                ref={hpRef}
                style={{ position: 'absolute', insetInlineStart: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
              <label className="fl">
                <span>بريدك الإلكتروني</span>
                <input type="email" name="email" required autoComplete="email" inputMode="email" placeholder="name@email.com" ref={emailRef} onInput={() => setError('')} />
              </label>
              <label className="fl">
                <span>الاسم (اختياري)</span>
                <input type="text" name="name" autoComplete="given-name" placeholder="اسمك" />
              </label>
              <button className={`sb${busy ? ' ld' : ''}`} type="submit">اشتركي</button>
              <p className="er" role="alert" aria-live="polite">{error}</p>
              <p className="pv">نحترم خصوصيتك، وتقدري تلغي الاشتراك في أي وقت.</p>
            </form>
            <div className={`ok${done ? ' on' : ''}`} role="status">
              <h3>{doneName ? `${doneName}، ` : ''}الدعوة اتقفلت وبقت باسمك.</h3>
              <p>هتلاقي رسالة تأكيد على بريدك فيها خصم أول طلب.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
