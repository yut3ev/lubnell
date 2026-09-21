'use client';

// SUP-8 — settings-driven footer. U12-FOOTER: rebuilt to the owner's approved
// target — five columns (brand / عن لوبنيل / خدمة العملاء / تسوّقي / تواصلي
// معنا) and the REAL brand-colored social glyphs (U8 brand-icons).

import Link from 'next/link';
import { Mail, Clock, MapPin, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { resolveSiteTexts, type SiteTexts } from '@/lib/site-texts';
import { FacebookGlyph, InstagramGlyph, WhatsAppGlyph, LinkedInGlyph, TikTokGlyph, INSTAGRAM_GRADIENT } from '@/components/store/brand-icons';

export function StoreFooter({
  texts,
  whatsapp,
  logoDark,
}: {
  texts?: SiteTexts;
  whatsapp?: string;
  // U16-BRAND — dark-text mark for the light footer surface (owner artwork
  // shipped at /brand/logo-dark.png; Studio-set logoDark wins).
  logoDark?: string;
}) {
  const { ar, t } = useT();
  const copy = resolveSiteTexts(texts);
  const brandLogo = logoDark || '/brand/logo-dark.png';

  const waDigits = (whatsapp || '').replace(/[^0-9]/g, '') || WHATSAPP_NUMBER;

  // Real brand marks, official colors — owner: «الأيقونة الأصلية للواتس
  // والفيس والانستا بالألوان الأصلية وشكلها الحقيقي».
  const socials = [
    {
      href: copy.instagramUrl || 'https://instagram.com',
      label: 'Instagram',
      glyph: <InstagramGlyph className="h-4.5 w-4.5 text-white" />,
      style: { background: INSTAGRAM_GRADIENT },
    },
    {
      href: copy.facebookUrl || 'https://facebook.com',
      label: 'Facebook',
      glyph: <FacebookGlyph className="h-4.5 w-4.5 text-white" />,
      style: { background: '#1877F2' },
    },
    {
      // U22 — «رابط WhatsApp» from Studio wins over the auto wa.me link
      href: copy.whatsappUrl?.trim() || `https://wa.me/${waDigits}`,
      label: 'WhatsApp',
      glyph: <WhatsAppGlyph className="h-4.5 w-4.5 text-white" />,
      style: { background: '#25D366' },
    },
    // U52-CONTACT-SOCIAL — TikTok joins the social row only once the owner
    // sets its URL from the admin (no dead/placeholder chips ever).
    ...(copy.tiktokUrl?.trim()
      ? [
          {
            href: copy.tiktokUrl.trim(),
            label: 'TikTok',
            glyph: <TikTokGlyph className="h-4.5 w-4.5 text-white" />,
            style: { background: '#010101' },
          },
        ]
      : []),
  ];

  return (
    // U29-THEME-STUDIO — the footer surface follows --color-footer;
    // factory fallback mimics bg-secondary/50.
    <footer
      className="mt-auto border-t border-border/70 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
      style={{ background: 'var(--color-footer, color-mix(in srgb, var(--secondary) 50%, transparent))' }}
    >
      {/* thin brand accent line — ties the footer to the header */}
      <div className="h-0.5 w-full bg-gradient-to-l from-primary/60 via-primary/25 to-transparent" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
        {/* U23-MOBILE-FOOTER — mobile is now a COMPACT 2-col grid (owner:
        «ميبقاش بشكل طولي… المستخدم مش هيقعد يسكرول كل ده»): brand full-width,
        then عن لوبنيل | خدمة العملاء and تسوّقي | تواصلي معنا side by side,
        tighter type/spacing. sm+ keeps the approved layout untouched. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-10 lg:grid-cols-[1.35fr_0.85fr_1fr_0.85fr_1.15fr]">
          {/* brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center" aria-label="LUBNÉL — الرئيسية">
              <img
                src={brandLogo}
                alt="LUBNÉL"
                className="h-7 w-auto object-contain sm:h-9"
                draggable={false}
              />
            </Link>
            <p className="mt-2.5 line-clamp-2 max-w-xs text-[13px] leading-snug text-muted-foreground sm:mt-4 sm:line-clamp-none sm:text-sm sm:leading-relaxed">
              {ar ? copy.footerBlurbAr : copy.footerBlurbEn}
            </p>
            <p className="mt-1.5 text-[13px] font-bold text-primary sm:mt-2 sm:text-sm">{ar ? copy.taglineAr : copy.taglineEn}</p>
            <div className="mt-3.5 flex items-center gap-2.5 sm:mt-5">
              {socials.map(({ href, label, glyph, style }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  style={style}
                  className="grid h-9 w-9 place-items-center rounded-full shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:h-10 sm:w-10"
                >
                  {glyph}
                </a>
              ))}
            </div>
          </div>

          {/* about — عن لوبنيل */}
          <nav aria-label={ar ? 'عن لوبنيل' : 'About LUBNÉL'}>
            <h3 className="w-fit border-b border-primary/25 pb-1 text-[13px] font-bold uppercase tracking-wide sm:pb-2 sm:text-sm">{ar ? 'عن لوبنيل' : 'About LUBNÉL'}</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground sm:mt-4 sm:space-y-2.5 sm:text-sm">
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/about">
                  {ar ? 'عن لوبنيل' : 'About us'}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/contact">
                  {ar ? 'تواصلي معنا' : 'Contact us'}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/faq">
                  {ar ? 'الأسئلة الشائعة' : 'FAQ'}
                </Link>
              </li>
            </ul>
          </nav>

          {/* customer care — خدمة العملاء */}
          <nav aria-label={t.footerHelp}>
            <h3 className="w-fit border-b border-primary/25 pb-1 text-[13px] font-bold uppercase tracking-wide sm:pb-2 sm:text-sm">{t.footerHelp}</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground sm:mt-4 sm:space-y-2.5 sm:text-sm">
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/shipping">
                  {ar ? 'الشحن والتوصيل' : 'Shipping & delivery'}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/returns">
                  {ar ? 'الاستبدال والإرجاع' : 'Exchange & returns'}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/privacy">
                  {ar ? 'سياسة الخصوصية' : 'Privacy policy'}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/info/terms">
                  {ar ? 'الشروط والأحكام' : 'Terms & conditions'}
                </Link>
              </li>
            </ul>
          </nav>

          {/* shop — تسوّقي */}
          <nav aria-label={t.footerShop}>
            <h3 className="w-fit border-b border-primary/25 pb-1 text-[13px] font-bold uppercase tracking-wide sm:pb-2 sm:text-sm">{t.footerShop}</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground sm:mt-4 sm:space-y-2.5 sm:text-sm">
              {copy.footerLinks.map((l) => (
                <li key={l.href + l.labelEn}>
                  <Link className="transition-colors hover:text-primary" href={l.href}>
                    {ar ? l.labelAr || l.labelEn : l.labelEn || l.labelAr}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* contact — تواصلي معنا */}
          <div>
            <h3 className="w-fit border-b border-primary/25 pb-1 text-[13px] font-bold uppercase tracking-wide sm:pb-2 sm:text-sm">{t.footerContact}</h3>
            <ul className="mt-3 space-y-2.5 text-[13px] text-muted-foreground sm:mt-4 sm:space-y-3 sm:text-sm">
              <li>
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 transition-colors hover:text-primary sm:gap-2.5"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-primary sm:h-4.5 sm:w-4.5" aria-hidden />
                  <span dir="ltr">+{waDigits}</span>
                </a>
              </li>
              <li className="flex items-center gap-2 sm:gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-primary sm:h-4.5 sm:w-4.5" aria-hidden />
                <a href={`mailto:${copy.contactEmail}`} dir="ltr" className="transition-colors hover:text-primary">
                  {copy.contactEmail}
                </a>
              </li>
              <li className="flex items-center gap-2 sm:gap-2.5">
                <Clock className="h-4 w-4 shrink-0 text-primary sm:h-4.5 sm:w-4.5" aria-hidden />
                <span>{ar ? copy.hoursAr : copy.hoursEn}</span>
              </li>
              <li className="flex items-center gap-2 sm:gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-primary sm:h-4.5 sm:w-4.5" aria-hidden />
                <span>{ar ? copy.locationAr : copy.locationEn}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* bottom bar — U45-FOOTER-CREDIT: the owner replaced «صُنع بحب في
            القاهرة 🤍» with her/his own brand credit «BY YUTAEV» and asked for
            3 ORIGINAL icons under it (LinkedIn / Facebook / Instagram) that
            take the visitor straight to the owner's accounts:
            linkedin.com/in/muhammed-ashraff · facebook.com/m0ashr3f ·
            instagram.com/moashr3f. Official brand treatments: LinkedIn blue
            mark on a white chip, Facebook white-on-blue, Instagram white on
            the official gradient — same hover-lift language as the socials
            above. The Studio «صُنع بحب» fields still feed the credit text. */}
        <div className="mt-7 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-4 sm:mt-10 sm:flex-row sm:gap-3 sm:pt-6">
          <span className="text-[11px] text-muted-foreground sm:text-xs">{ar ? copy.copyrightAr : copy.copyrightEn}</span>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-5">
            {/* U45-R2 — owner: «كبر النص دا شويه وخليه احترافي» — the credit
                got a designer lockup: larger type, deeper ink, wider luxury
                tracking, and fading hairline rules on both sides. */}
            <div className="flex flex-col items-center gap-2">
              <span dir="ltr" className="flex items-center gap-2.5 sm:gap-3">
                <span aria-hidden className="h-px w-7 bg-gradient-to-r from-transparent to-foreground/35 sm:w-10" />
                <span className="text-[13px] font-black uppercase tracking-[0.3em] text-foreground/90 sm:text-[15px] sm:tracking-[0.32em]">
                  {ar ? copy.madeWithAr : copy.madeWithEn}
                </span>
                <span aria-hidden className="h-px w-7 bg-gradient-to-l from-transparent to-foreground/35 sm:w-10" />
              </span>
              <div className="flex items-center gap-2">
                {[
                  {
                    href: 'https://www.linkedin.com/in/muhammed-ashraff',
                    label: 'LinkedIn',
                    glyph: <LinkedInGlyph className="h-4.5 w-4.5 text-[#0A66C2]" />,
                    style: { background: '#ffffff' },
                    ring: true,
                  },
                  {
                    href: 'https://facebook.com/m0ashr3f',
                    label: 'Facebook',
                    glyph: <FacebookGlyph className="h-4.5 w-4.5 text-white" />,
                    style: { background: '#1877F2' },
                    ring: false,
                  },
                  {
                    href: 'https://instagram.com/moashr3f',
                    label: 'Instagram',
                    glyph: <InstagramGlyph className="h-4.5 w-4.5 text-white" />,
                    style: { background: INSTAGRAM_GRADIENT },
                    ring: false,
                  },
                ].map(({ href, label, glyph, style, ring }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    style={style}
                    className={`grid h-9 w-9 place-items-center rounded-full shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${ring ? 'ring-1 ring-black/10' : ''}`}
                  >
                    {glyph}
                  </a>
                ))}
              </div>
            </div>
            <Link
              href="/admin"
              className="text-[11px] opacity-60 transition-opacity hover:text-primary hover:opacity-100"
              aria-label={ar ? 'لوحة الإدارة' : 'Admin dashboard'}
            >
              {ar ? 'لوحة الإدارة' : 'Admin'}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
