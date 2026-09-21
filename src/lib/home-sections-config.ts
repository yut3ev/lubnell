// U17-HOME-EDITOR — the «محرر السلايدر» sections registry.
// Shared between the admin editor (Studio → الصفحة الرئيسية → أقسام الصفحة),
// the persistence API (StoreSettings key "home_sections") and the storefront
// home page, so visibility + template choices stay honest — every template
// listed here has a real renderer on the storefront.

export type SectionKey = 'hero' | 'offers' | 'categories' | 'featured' | 'arrivals' | 'whatsapp';

// U19-SLIDER — slide size control for the hero (حجم وابعاد الشرائح)
// U22 — «ملئ تقريبًا» preset + per-device px heights / text position /
// gradient strength, all from her screenshots (الأبعاد والمُظهر).
export type HeroHeight = 'short' | 'default' | 'tall' | 'fill';

export type HeroTextPos = 'center' | 'start';

export type SectionTemplateMap = {
  hero: 'slider' | 'banner';
  offers: 'grid' | 'rail';
  // U24-CATS-EDITORIAL — «إديتوريال»: صور كبيرة غير متماثلة لكل تصنيف
  categories: 'grid' | 'rail' | 'editorial';
  featured: 'grid' | 'rail';
  arrivals: 'grid' | 'rail';
  whatsapp: 'banner' | 'strip';
};

export type SectionState<K extends SectionKey = SectionKey> = {
  visible: boolean;
  template: SectionTemplateMap[K];
  /** hero only — slider height preset */
  height?: HeroHeight;
  /** U22 — hero only: per-device heights in px (كمبيوتر / تابلت / موبايل) */
  heightDesktop?: number;
  heightTablet?: number;
  heightMobile?: number;
  /** U22 — hero only: text block vertical placement */
  textPos?: HeroTextPos;
  /** U22 — hero only: gradient strength 0–90 (قوة التدرج اللوني) */
  overlay?: number;
  /** U22 — whatsapp CTA banner only: media behind the gradient (وسائط بانر الدعوة) */
  bannerImage?: string;
  bannerVideo?: string;
};

export type HomeSectionsConfig = Record<SectionKey, SectionState>;

export const HOME_SECTION_ORDER: SectionKey[] = ['hero', 'offers', 'categories', 'featured', 'arrivals', 'whatsapp'];

export const HOME_SECTION_META: Record<SectionKey, { labelAr: string; labelEn: string; num: string; templates: { value: SectionTemplateMap[SectionKey]; labelAr: string }[] }> = {
  hero: {
    labelAr: 'Hero / Slider', labelEn: 'Hero / Slider', num: '01',
    templates: [
      { value: 'slider', labelAr: 'سلايدر متحرك' },
      { value: 'banner', labelAr: 'بانر ثابت' },
    ],
  },
  offers: {
    labelAr: 'العروض', labelEn: 'Offers', num: '02',
    templates: [
      { value: 'grid', labelAr: 'بطاقات كبيرة' },
      { value: 'rail', labelAr: 'شريط أفقي' },
    ],
  },
  categories: {
    labelAr: 'التصنيفات', labelEn: 'Categories', num: '03',
    templates: [
      { value: 'editorial', labelAr: 'إديتوريال — صور كبيرة' },
      { value: 'grid', labelAr: 'شبكة بطاقات' },
      { value: 'rail', labelAr: 'شريط أفقي' },
    ],
  },
  featured: {
    labelAr: 'المنتجات المميزة', labelEn: 'Featured Product', num: '04',
    templates: [
      { value: 'grid', labelAr: 'شبكة منتجات' },
      { value: 'rail', labelAr: 'شريط أفقي' },
    ],
  },
  arrivals: {
    labelAr: 'وصل حديثًا', labelEn: 'Horizontal Scroll', num: '05',
    templates: [
      { value: 'grid', labelAr: 'شبكة مع فلاتر' },
      { value: 'rail', labelAr: 'شريط أفقي' },
    ],
  },
  whatsapp: {
    labelAr: 'بانر اسألي لُو', labelEn: 'Ask Lou CTA', num: '06',
    templates: [
      { value: 'banner', labelAr: 'بانر كبير' },
      { value: 'strip', labelAr: 'شريط بسيط' },
    ],
  },
};

export const DEFAULT_HOME_SECTIONS: HomeSectionsConfig = {
  hero: { visible: true, template: 'slider' },
  offers: { visible: true, template: 'grid' },
  categories: { visible: true, template: 'grid' },
  // U27-HIDE-FEATURED — the owner: «شيل قسم الاكثر رواجًا من الصفحة الرئيسية».
  // Hidden by default everywhere; Studio → الصفحة الرئيسية keeps the toggle
  // so she can bring it back herself (the renderer stays wired).
  featured: { visible: false, template: 'grid' },
  arrivals: { visible: true, template: 'grid' },
  whatsapp: { visible: true, template: 'banner' },
};

/** Merge stored (partial/unknown) values over the shipped defaults — never throws. */
export function resolveHomeSections(raw: unknown): HomeSectionsConfig {
  const out = JSON.parse(JSON.stringify(DEFAULT_HOME_SECTIONS)) as HomeSectionsConfig;
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const key of HOME_SECTION_ORDER) {
    const val = obj[key];
    if (!val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    if (typeof v.visible === 'boolean') out[key].visible = v.visible;
    const templates = HOME_SECTION_META[key].templates.map((t) => t.value);
    if (typeof v.template === 'string' && (templates as string[]).includes(v.template)) {
      out[key].template = v.template as SectionTemplateMap[SectionKey];
    }
    if (key === 'hero') {
      if (['short', 'default', 'tall', 'fill'].includes(String(v.height))) {
        out.hero.height = v.height as HeroHeight;
      }
      // U22 — per-device px heights (clamped to sane bounds)
      const px = (val: unknown, lo: number, hi: number) => {
        const n = Number(val);
        return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined;
      };
      const hd = px(v.heightDesktop, 320, 1100);
      if (hd) out.hero.heightDesktop = hd;
      const ht = px(v.heightTablet, 280, 1100);
      if (ht) out.hero.heightTablet = ht;
      const hm = px(v.heightMobile, 260, 900);
      if (hm) out.hero.heightMobile = hm;
      if (v.textPos === 'center' || v.textPos === 'start') out.hero.textPos = v.textPos;
      const ov = Number(v.overlay);
      if (Number.isFinite(ov) && ov >= 0) out.hero.overlay = Math.min(90, Math.max(0, Math.round(ov)));
    }
    if (key === 'whatsapp') {
      // U22 — CTA banner media (image / video behind the gradient)
      if (typeof v.bannerImage === 'string') out.whatsapp.bannerImage = v.bannerImage.slice(0, 500);
      if (typeof v.bannerVideo === 'string') out.whatsapp.bannerVideo = v.bannerVideo.slice(0, 500);
    }
  }
  return out;
}
