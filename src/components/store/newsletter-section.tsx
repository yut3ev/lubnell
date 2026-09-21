'use client';

import { useState } from 'react';
import { BadgePercent, BellRing, CheckCircle2, Gift, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Reveal } from '@/components/store/reveal';
import { useT } from '@/lib/i18n';

type Status = 'idle' | 'loading' | 'success' | 'error';

type NewsletterCopy = { ar?: string; en?: string };

// U12-CLUB — rebuilt to the owner's approved design (her target screenshot):
// «LUBNÉL CLUB» pill, three benefit chips, white pill input bar with the
// subscribe button inset at the end side, and a privacy reassurance line.
// U22 — copy now comes from Studio → النصوص والفوتر (نص النشرة) when set.
// U48-CLUB-PRIMARY — owner: «اشتركي لونه بوني اللون مش متناسق مع باقي
// الموقع خليه زي اللون دا وكمان حاول تخلي البار احترافي اكتر من كده»
// → the hardcoded terracotta family (rgb 186,96,64 / 156,74,46 / 180,90,60)
// was the ONLY surface on the site not using the brand wine — every other
// CTA renders bg-primary (oklch 0.47 0.11 18 ≈ #8E3D43). Card gradient,
// chips, pill and the اشتركي button now all derive from var(--primary) /
// --primary-foreground tokens (theme-studio safe), and the email bar got a
// pro pass: Mail glyph, focus-within ring, deeper wine-tinted shadow,
// taller h-11 hit targets, inner hairline ring and crisper chip borders.
export function NewsletterSection({ copy }: { copy?: NewsletterCopy }) {
  const { ar, t } = useT();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const sub = ar ? copy?.ar || 'إشعارات، وصول مبكر وتخفيضات حصرية لأعضاء النادي.' : copy?.en || t.newsletterSub;

  const perks = [
    // U51-GLOBAL-TEXTS — perk chips are owner-editable (كل النصوص → نادي لوبنيل)
    { Icon: Gift, label: t.perkFirst },
    { Icon: BellRing, label: t.perkEarly },
    { Icon: BadgePercent, label: t.perkExclusive },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch('/api/store/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 sm:pb-12">
      <Reveal>
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-l from-primary to-[color-mix(in_oklab,var(--primary)_76%,black)] px-6 py-12 text-primary-foreground shadow-xl shadow-primary/25 ring-1 ring-inset ring-primary-foreground/15 sm:px-10">
        {/* decorative outline circles + soft glow — approved target look */}
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-primary-foreground/15" aria-hidden />
        <span className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full border border-primary-foreground/10" aria-hidden />
        <span className="pointer-events-none absolute left-1/3 -top-10 h-20 w-20 rounded-full border border-primary-foreground/10" aria-hidden />
        <span className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 rounded-full bg-primary-foreground/10 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-2xl text-center">
          <span
            dir="ltr"
            className="inline-block rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.35em] text-primary-foreground/95"
          >
            LUBNÉL CLUB
          </span>

          <h2 className="mt-4 text-balance text-xl font-extrabold tracking-tight sm:text-3xl">{t.newsletterTitle}</h2>
          <p className="mt-2 text-balance text-sm leading-relaxed text-primary-foreground/85">{sub}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {perks.map(({ Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-2 text-xs font-bold text-primary-foreground/95 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {label}
              </span>
            ))}
          </div>

          {status === 'success' ? (
            <p className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/15 px-5 py-3.5 text-sm font-bold">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              {t.newsletterOk}
            </p>
          ) : (
            <form
              onSubmit={submit}
              className="mx-auto mt-6 flex max-w-xl items-center gap-1.5 rounded-full bg-white p-1.5 shadow-lg shadow-black/15 ring-1 ring-black/5 transition-all duration-300 focus-within:shadow-xl focus-within:ring-2 focus-within:ring-primary/40 sm:gap-2"
            >
              <Mail className="ms-3.5 h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder={t.newsletterPh}
                aria-label={t.newsletterPh}
                className="h-11 min-w-0 flex-1 rounded-full border-0 bg-transparent px-2.5 text-sm text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="submit"
                disabled={status === 'loading'}
                className="h-11 shrink-0 rounded-full px-6! text-sm font-bold active:scale-[0.97] sm:px-8!"
              >
                {status === 'loading' ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4 -scale-x-100" aria-hidden />
                )}
                <span>{t.newsletterBtn}</span>
              </Button>
            </form>
          )}

          {status === 'error' && (
            <p className="mt-3 text-xs font-semibold text-primary-foreground" role="alert">
              {t.newsletterErr}
            </p>
          )}

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-primary-foreground/75">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t.privacyLine}
          </p>
        </div>
      </div>
      </Reveal>
    </section>
  );
}
