// SUP-8 — default site copy. Everything here is overridable from
// Studio → «النصوص والفوتر» (StoreSettings key "texts"). The storefront
// falls back to these defaults so a missing/partial DB row can never
// break rendering.

export type FooterLink = { href: string; labelAr: string; labelEn: string };

export type SiteTexts = {
  taglineAr?: string;
  taglineEn?: string;
  footerBlurbAr?: string;
  footerBlurbEn?: string;
  footerLinks?: FooterLink[];
  contactEmail?: string;
  hoursAr?: string;
  hoursEn?: string;
  locationAr?: string;
  locationEn?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  whatsappUrl?: string; // U22 — رابط واتساب كرابط سوشيال في الفوتر
  whatsappChannelUrl?: string; // U52-CONTACT-SOCIAL — قناة واتساب (صفحة التواصل)
  tiktokUrl?: string; // U52-CONTACT-SOCIAL — بيدج تيك توك
  newsletterAr?: string; // U22 — نص النشرة البريدية (عربي)
  newsletterEn?: string; // U22 — Newsletter text (English)
  copyrightAr?: string;
  copyrightEn?: string;
  madeWithAr?: string;
  madeWithEn?: string;
  announcementAr?: string;
  announcementEn?: string;
};

export const DEFAULT_SITE_TEXTS: Required<Pick<SiteTexts, 'footerLinks'>> & SiteTexts = {
  taglineAr: 'جمالٌ يُهدى بكل حب',
  taglineEn: 'Beauty, gifted with love',
  footerBlurbAr: 'طقس جمالك، بصياغة مصرية معاصرة — صناديق هدايا فاخرة، مكياج، عناية وعطور أصلية.',
  footerBlurbEn: 'Your beauty ritual, reimagined in Cairo — luxury gift boxes, makeup, skincare and authentic fragrance.',
  footerLinks: [
    { href: '/#catalog', labelAr: 'كل المنتجات', labelEn: 'All products' },
    { href: '/c/sets', labelAr: 'المجموعات', labelEn: 'Sets' },
    { href: '/c/makeup', labelAr: 'مكياج', labelEn: 'Makeup' },
    { href: '/c/skincare', labelAr: 'عناية بالبشرة', labelEn: 'Skincare' },
    { href: '/c/body-care', labelAr: 'عناية بالجسم', labelEn: 'Body care' },
  ],
  contactEmail: 'hello@lubnel.com',
  hoursAr: 'يوميًا من 10 صباحًا حتى 10 مساءً',
  hoursEn: 'Daily 10 AM – 10 PM',
  locationAr: 'القاهرة، مصر',
  locationEn: 'Cairo, Egypt',
  // U45-FOOTER-CREDIT — the owner's own social accounts (were dead placeholder
  // homepages); the footer credit row links to the same accounts.
  instagramUrl: 'https://instagram.com/moashr3f',
  facebookUrl: 'https://facebook.com/m0ashr3f',
  whatsappUrl: '',
  // U52-CONTACT-SOCIAL — owner: «ضيف مكان لقنا وتساب وبيدج فيس وبيدج انستا
  // وبيدج تيك توك وانا هبقا احط الحسابات المطلوبة من الأدمن بعدين»، ثم
  // «خليهم متاحين برضو». Both ship EMPTY: until she pastes the real links,
  // the WA-channel slot falls back to the store's WhatsApp chat and TikTok
  // to the platform home — and the admin URL always wins when present.
  whatsappChannelUrl: '',
  tiktokUrl: '',
  newsletterAr: 'إلهام، وصول مبكر، وطقوس جمال حصرية بعناية.',
  newsletterEn: 'Early access, beauty notes, and considered rituals.',
  copyrightAr: '© 2026 LUBNÉL · جميع الحقوق محفوظة',
  copyrightEn: '© 2026 LUBNÉL · All rights reserved',
  // U45-FOOTER-CREDIT — owner: «BY YUTAEV» replaces «صُنع بحب في القاهرة 🤍»
  // in the footer bottom bar (both languages render the same Latin credit).
  madeWithAr: 'BY YUTAEV',
  madeWithEn: 'BY YUTAEV',
  announcementAr: '',
  announcementEn: '',
};

/** Merge stored texts over defaults (deep for the links list). */
export function resolveSiteTexts(stored: unknown): SiteTexts {
  if (!stored || typeof stored !== 'object') return DEFAULT_SITE_TEXTS;
  const s = stored as SiteTexts;
  return {
    ...DEFAULT_SITE_TEXTS,
    ...s,
    footerLinks:
      Array.isArray(s.footerLinks) && s.footerLinks.length > 0
        ? s.footerLinks.filter((l) => l && typeof l.href === 'string')
        : DEFAULT_SITE_TEXTS.footerLinks,
  };
}
