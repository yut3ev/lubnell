// SUP-9 — section-level storefront copy. Every string here is overridable
// from Studio → «أقسام الموقع» (StoreSettings key "sections") by anyone
// holding the sections.write permission (owner, or granted staff).
// The storefront falls back to these defaults so a missing/partial DB row
// can never break rendering.

export type SectionTexts = {
  // home trust strip (3 items)
  trust1TitleAr?: string; trust1SubAr?: string; trust1TitleEn?: string; trust1SubEn?: string;
  trust2TitleAr?: string; trust2SubAr?: string; trust2TitleEn?: string; trust2SubEn?: string;
  trust3TitleAr?: string; trust3SubAr?: string; trust3TitleEn?: string; trust3SubEn?: string;
  // home categories section
  categoriesTitleAr?: string; categoriesTitleEn?: string;
  categoriesSubAr?: string; categoriesSubEn?: string;
  // home featured section
  featuredTitleAr?: string; featuredTitleEn?: string;
  featuredSubAr?: string; featuredSubEn?: string;
  // home CTA banner
  ctaTitleAr?: string; ctaTitleEn?: string;
  ctaSubAr?: string; ctaSubEn?: string;
  // PDP related products heading
  relatedAr?: string; relatedEn?: string;
  // section images (media library URLs)
  ctaImageAr?: string;
  categoriesBannerImage?: string;
};

export const DEFAULT_SECTION_TEXTS: Required<SectionTexts> = {
  trust1TitleAr: 'شحن مجاني', trust1SubAr: 'للطلبات فوق 900 ج.م', trust1TitleEn: 'Free shipping', trust1SubEn: 'over 900 EGP',
  trust2TitleAr: 'منتجات أصلية', trust2SubAr: 'مصادر موثوقة 100%', trust2TitleEn: 'Authentic products', trust2SubEn: '100% trusted sources',
  trust3TitleAr: 'بوكسات جاهزة للإهداء', trust3SubAr: 'تغليف أنيق لكل طلب', trust3TitleEn: 'Gift-ready boxes', trust3SubEn: 'elegant packaging',
  categoriesTitleAr: 'تسوّقي حسب الفئة', categoriesTitleEn: 'Shop by category',
  categoriesSubAr: 'كل ما تحتاجينه لطقسكِ اليومي في مكان واحد', categoriesSubEn: 'Everything for your daily ritual in one place',
  featuredTitleAr: 'الأكثر رواجًا', featuredTitleEn: 'Best sellers',
  featuredSubAr: 'المفضّلة عند عميلاتنا هذا الشهر', featuredSubEn: 'Customer favorites this month',
  ctaTitleAr: 'محتارة في اختيار هدية؟ اسألي لُو', ctaTitleEn: 'Not sure what to gift? Ask Lou',
  ctaSubAr: 'مساعدتنا الذكية تقترح الهدايا والمجموعات المناسبة حسب المناسبة والميزانية.', ctaSubEn: 'Our AI assistant suggests the right gift or set for any occasion and budget.',
  relatedAr: 'كمّلي طقسكِ', relatedEn: 'Complete the ritual.',
  ctaImageAr: '',
  categoriesBannerImage: '',
};

/** Merge stored section texts over the shipped defaults. */
export function resolveSectionTexts(stored: unknown): Required<SectionTexts> {
  if (!stored || typeof stored !== 'object') return DEFAULT_SECTION_TEXTS;
  return { ...DEFAULT_SECTION_TEXTS, ...(stored as SectionTexts) };
}
