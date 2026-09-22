'use client';

// U2 (task 2-a) — client panels for the storefront info pages.
// Language (AR/EN) is a client-side toggle (useT), so every content block
// that needs bilingual rendering lives here and receives plain serializable
// props from the server page. All content defaults come from lib/info-pages.

import Link from 'next/link';
import {
  MessageCircle,
  Mail,
  Clock,
  MapPin,
  Banknote,
  Truck,
  Gift,
  ChevronLeft,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { TrustVideo } from '@/components/store/animated-icon-video'; // U67-YOUTUBE-SOCIAL
import {
  FacebookGlyph,
  InstagramGlyph,
  TikTokGlyph,
  WhatsAppGlyph,
  INSTAGRAM_GRADIENT,
} from '@/components/store/brand-icons';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import type { FaqPair, ShippingRegion, ShippingStep } from '@/lib/info-pages';

/* ------------------------------------------------------------------ */
/* Breadcrumb + page title (lang aware)                                */
/* ------------------------------------------------------------------ */

export function InfoHeader({ titleAr, titleEn }: { titleAr: string; titleEn?: string }) {
  const { t, ar } = useT();
  const title = ar ? titleAr : titleEn?.trim() || titleAr;

  return (
    <div>
      <nav aria-label="مسار التنقل / Breadcrumb" className="mb-3.5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="min-h-[44px] inline-flex items-center transition-colors hover:text-primary">
          {t.home}
        </Link>
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        <span className="font-semibold text-foreground" aria-current="page">
          {title}
        </span>
      </nav>

      {/* U62-CONTACT-COMPACT — owner: «فيه فراغ كبير… صغر الكلام شويه علشان
          سكرول المستخدم ميطلاعش لتحت». Hero shrunk: py-9→py-5 mobile,
          title 2xl→xl mobile so the contact block starts high on screen. */}
      <header className="rounded-2xl border border-border/60 bg-secondary/40 px-5 py-5 sm:rounded-3xl sm:px-10 sm:py-9">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          LUBNÉL
        </p>
        <h1 className="mt-1.5 text-xl font-extrabold text-primary sm:mt-2 sm:text-3xl">{title}</h1>
      </header>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prose renderer — paragraphs, bullet lists and numbered steps        */
/* ------------------------------------------------------------------ */

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

function parseBlocks(content: string): Block[] {
  return content
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map<Block>((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const bullets = lines.filter((l) => /^[•\-–]\s*/.test(l));
      if (bullets.length > 0 && bullets.length === lines.length) {
        return { kind: 'ul', items: bullets.map((l) => l.replace(/^[•\-–]\s*/, '')) };
      }
      const numbered = lines.filter((l) => /^\d{1,2}[.)]\s*/.test(l));
      if (numbered.length > 0 && numbered.length === lines.length) {
        return { kind: 'ol', items: numbered.map((l) => l.replace(/^\d{1,2}[.)]\s*/, '')) };
      }
      return { kind: 'p', text: lines.join('\n') };
    });
}

export function InfoProse({ ar, en }: { ar: string; en?: string }) {
  const { ar: isAr } = useT();
  const content = isAr || !en?.trim() ? ar : en;
  const blocks = parseBlocks(content);

  return (
    <article dir={isAr ? 'rtl' : 'ltr'} className={isAr ? '' : 'text-left'}>
      <div className="space-y-4">
        {blocks.map((block, i) => {
          if (block.kind === 'p') {
            return (
              <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {block.text}
              </p>
            );
          }
          if (block.kind === 'ul') {
            return (
              <ul key={i} className="space-y-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                    <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span className="whitespace-pre-line">{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <ol key={i} className="space-y-2.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden>
                    {j + 1}
                  </span>
                  <span className="whitespace-pre-line pt-0.5">{item}</span>
                </li>
              ))}
            </ol>
          );
        })}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ — shadcn Accordion, 8 Q&A                                       */
/* ------------------------------------------------------------------ */

export function FaqAccordion({ itemsAr, itemsEn }: { itemsAr: FaqPair[]; itemsEn?: FaqPair[] }) {
  const { ar: isAr } = useT();
  const items = isAr || !itemsEn?.length ? itemsAr : itemsEn;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={isAr ? '' : 'text-left'}>
      <Accordion type="single" collapsible className="rounded-2xl border border-border/60 bg-card px-5">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
            {/* U33-HYDRA — same Radix useId/aria-controls class as the header
                sheet trigger: the id is server-process-bound, so a reload
                raced across a restart diffs here first on info pages.
                suppressHydrationWarning silences only that internal attr. */}
            <AccordionTrigger
              suppressHydrationWarning
              className="min-h-[44px] py-4 text-right text-[15px] font-bold hover:no-underline [&>svg]:text-primary"
            >
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm leading-loose text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contact — WhatsApp CTA + channels grid                              */
/* ------------------------------------------------------------------ */

export function ContactPanel({
  waDigits,
  email,
  hoursAr,
  hoursEn,
  locationAr,
  locationEn,
  instagramUrl,
  facebookUrl,
  whatsappChannelUrl,
  tiktokUrl,
  youtubeUrl,
}: {
  waDigits: string;
  email: string;
  hoursAr: string;
  hoursEn: string;
  locationAr: string;
  locationEn: string;
  instagramUrl?: string;
  facebookUrl?: string;
  whatsappChannelUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
}) {
  const { ar, t } = useT();
  // U57-TEXTS-COMPLETE — the WhatsApp prefill line is owner-editable
  // (Studio → كل النصوص → صفحة تواصلي معنا).
  const waText = encodeURIComponent(t.cpWaPrefill);

  const channels = [
    { Icon: Mail, label: t.cpEmailLabel, value: email, href: `mailto:${email}`, ltr: true },
    { Icon: Clock, label: t.cpHoursLabel, value: ar ? hoursAr : hoursEn },
    { Icon: MapPin, label: t.cpAddressLabel, value: ar ? locationAr : locationEn },
  ];

  // U52-CONTACT-SOCIAL + owner follow-up: «خلي قناة الواتس والتيك توك متاحين
  // برضو بس انا هبقا احط بيانات اللينكات بعدين» — NO «قريبًا» state anymore;
  // all four slots are live links the moment the page ships. Until she pastes
  // the real URLs from the admin, WA channel falls back to the store's own
  // WhatsApp chat and TikTok to the platform home (same fallback doctrine the
  // footer has used since U8). The admin URL always wins when present.
  // U67-YOUTUBE-SOCIAL — owner: «ضيف معاهم ايقون لليوتيوب يدوس عليه تفتح
  // القناه» + the animated «Youtube Logo Effect.webm». The card uses the
  // owner's clip (transparent VP8+alpha) instead of a static glyph circle,
  // spans the full row on phones (5th card would orphan at half width)
  // and sits as an equal 5th column on lg.
  const socials: {
    key: string;
    Glyph: typeof WhatsAppGlyph;
    video?: string;
    fullRowOnMobile?: boolean;
    chip: { background: string };
    labelAr: string;
    labelEn: string;
    href: string;
    badgeAr: string;
    badgeEn: string;
  }[] = [
    {
      key: 'wa-channel',
      Glyph: WhatsAppGlyph,
      chip: { background: '#25D366' },
      labelAr: t.cpWaChannel,
      labelEn: 'WhatsApp channel',
      href: whatsappChannelUrl || `https://wa.me/${waDigits}`,
      badgeAr: whatsappChannelUrl ? t.cpJoinChannel : t.cpFollowBadge,
      badgeEn: whatsappChannelUrl ? 'Join the channel' : 'Follow us',
    },
    {
      key: 'facebook',
      Glyph: FacebookGlyph,
      chip: { background: '#1877F2' },
      labelAr: t.cpFbPage,
      labelEn: 'Facebook page',
      href: facebookUrl || 'https://www.facebook.com',
      badgeAr: t.cpFollowBadge,
      badgeEn: 'Follow us',
    },
    {
      key: 'instagram',
      Glyph: InstagramGlyph,
      chip: { background: INSTAGRAM_GRADIENT },
      labelAr: t.cpIgPage,
      labelEn: 'Instagram page',
      href: instagramUrl || 'https://www.instagram.com',
      badgeAr: t.cpFollowBadge,
      badgeEn: 'Follow us',
    },
    {
      key: 'tiktok',
      Glyph: TikTokGlyph,
      chip: { background: '#010101' },
      labelAr: t.cpTtPage,
      labelEn: 'TikTok page',
      href: tiktokUrl || 'https://www.tiktok.com',
      badgeAr: t.cpFollowBadge,
      badgeEn: 'Follow us',
    },
    {
      key: 'youtube',
      Glyph: WhatsAppGlyph, // unused when `video` is set (render guard)
      video: '/icons/youtube.webm',
      fullRowOnMobile: true,
      chip: { background: '#FF0000' },
      labelAr: t.cpYtChannel,
      labelEn: 'YouTube channel',
      href: youtubeUrl || 'https://youtube.com/@lubnel9606?si=dBLevXM5C-gjipd8',
      badgeAr: t.cpFollowBadge,
      badgeEn: 'Follow us',
    },
  ];

  return (
    <div className="mt-4 space-y-2.5">
      <a
        href={`https://wa.me/${waDigits}?text=${waText}`}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-3 text-[15px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 active:scale-[0.99]"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        {t.cpWaCta}
      </a>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {channels.map(({ Icon, label, value, href, ltr }) => {
          const inner = (
            <>
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
                <span className="block truncate text-sm font-bold" dir={ltr ? 'ltr' : undefined}>
                  {value}
                </span>
              </span>
            </>
          );
          const cls =
            'flex min-h-[56px] items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary/40';
          return href ? (
            <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cls}>
              {inner}
            </a>
          ) : (
            <div key={label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* U52 — «تابعينا على»: the four official-brand slots (WhatsApp channel
          / Facebook / Instagram / TikTok) — ALL live links (owner: «خليهم
          متاحين برضو»); unset URLs fall back instead of showing قريبًا, and
          the admin URL always wins when she adds it.
          U67 — the YouTube channel joins as a fifth slot rendered with the
          owner's animated webm logo; grid opens to lg:grid-cols-5. */}
      <section aria-label={t.cpSocialAria} className="pt-2.5">
        <h2 className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-primary">
          {t.cpSocialTitle}
          <span className="h-px flex-1 bg-border" aria-hidden />
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {socials.map(({ key, Glyph, video, fullRowOnMobile, chip, labelAr, labelEn, href, badgeAr, badgeEn }) => {
            const label = ar ? labelAr : labelEn;
            const cls =
              'group flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-card px-3 py-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md' +
              (fullRowOnMobile ? ' col-span-2 lg:col-span-1' : '');
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${label} — LUBNÉL`}
                className={cls}
              >
                {video ? (
                  // the YT clip's canvas carries baked-in padding (~40%) —
                  // h-16 optically matches the h-11 brand circles beside it
                  <TrustVideo src={video} className="h-16 w-16" />
                ) : (
                  <span
                    className="grid h-11 w-11 place-items-center rounded-full text-white shadow-md transition-transform duration-200 group-hover:scale-105"
                    style={chip}
                    aria-hidden
                  >
                    <Glyph className="h-5.5 w-5.5" />
                  </span>
                )}
                <span className="text-[13px] font-bold leading-tight">{label}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {ar ? badgeAr : badgeEn}
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shipping — fees chips + regions table + processing steps            */
/* ------------------------------------------------------------------ */

export function ShippingPanel({
  regions,
  steps,
  fee,
  freeThreshold,
}: {
  regions: ShippingRegion[];
  steps: ShippingStep[];
  fee: number;
  freeThreshold: number;
}) {
  const { ar, t } = useT();

  // U57-TEXTS-COMPLETE — fee chips are templates ({fee}/{threshold}) the
  // owner can reword from كل النصوص → صفحة تواصلي معنا.
  const chips = [
    { Icon: Truck, label: t.cpShipFee.split('{fee}').join(String(fee)) },
    { Icon: Gift, label: t.cpShipFree.split('{threshold}').join(String(freeThreshold)) },
    { Icon: Banknote, label: t.cpCod },
  ];

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className={ar ? '' : 'text-left'}>
      {/* fees */}
      <div className="grid gap-3 sm:grid-cols-3">
        {chips.map(({ Icon, label }) => (
          <div key={label} className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
            <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-bold leading-snug">{label}</span>
          </div>
        ))}
      </div>

      {/* regions table */}
      <Card className="mt-6 overflow-hidden rounded-2xl border-border/60">
        <CardContent className="p-0">
          <p className="border-b border-border/60 px-5 py-3.5 text-sm font-bold text-primary">
            {t.cpDeliveryTitle}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/40 text-xs font-bold text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-right font-bold">
                    {t.cpZoneCol}
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-bold">
                    {t.cpTimeCol}
                  </th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.nameEn} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-3 font-semibold text-foreground/90">{ar ? r.nameAr : r.nameEn}</td>
                    <td className="px-5 py-3 text-muted-foreground">{ar ? r.timeAr : r.timeEn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* processing steps */}
      <p className="mt-8 text-sm font-bold uppercase tracking-widest text-primary">
        {t.cpJourneyTitle}
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.titleEn} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{ar ? s.titleAr : s.titleEn}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{ar ? s.bodyAr : s.bodyEn}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
