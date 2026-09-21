// SETTINGS-FONTS — complete site-wide font catalog for Studio → «الإعدادات» →
// «الهوية البصرية». Each entry is production-ready: a Google Fonts stylesheet
// href (exact weights the family actually ships), a full CSS fallback chain
// (Arabic-capable fonts flow into Latin display fonts and vice-versa so mixed
// AR/EN copy never breaks), and a category so the picker reads naturally in
// Arabic.
//
// HUB-FONTS-2 — expanded to a full curated library (31 families): safe Arabic
// workhorses, kufi/naskh/ruqaa personalities, elegant fashion-display Latins
// for a beauty brand, and clean Latin UI sans. All are prewired and previewed
// live in the picker — the owner picks, saves, and the whole site changes.
//
// Applied in src/app/layout.tsx: the selected font's stylesheet is injected
// and `--site-font-family` / `--font-sans` / `--default-font-family` are set
// on :root — the whole site (storefront AND studio) inherits it.

export type FontEntry = {
  /** Google Fonts family name — also the stored settings value */
  id: string;
  label: string;
  /** ar | latin | dual — helps the owner scan the picker */
  category: 'arabic' | 'latin' | 'dual';
  /** ready-to-use css2 stylesheet href with the family's real weights */
  href: string;
  /** full CSS font-family chain applied site-wide */
  stack: string;
  /** vibe description shown under the picker card */
  note: string;
};

const gf = (family: string, weights: string) =>
  `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weights}&display=swap`;

const sans = (family: string, latinFallback = 'Jost') =>
  `'${family}','${latinFallback}',ui-sans-serif,system-ui,sans-serif`;
const serif = (family: string, arabicFallback = 'Cairo') =>
  `'${family}','${arabicFallback}',ui-serif,Georgia,serif`;

export const FONT_CATALOG: FontEntry[] = [
  /* ---------- اللاتيني الحالي + الكلاسيكيات ---------- */
  {
    id: 'Jost',
    label: 'جوست — Jost',
    category: 'latin',
    href: gf('Jost', '300;400;500;600;700;800'),
    stack: sans('Jost', 'Cairo'),
    note: 'الخط الحالي — هندسي أنيق للاتينية (العربي يسقط على Cairo)',
  },
  {
    id: 'Playfair Display',
    label: 'بلايفير — Playfair',
    category: 'latin',
    href: gf('Playfair Display', '400;500;600;700;800'),
    stack: serif('Playfair Display'),
    note: 'سيريف لاتيني فخم للبراند (العربي يسقط على Cairo)',
  },
  {
    id: 'Italiana',
    label: 'إيتاليانا — Italiana',
    category: 'latin',
    href: gf('Italiana', '400'),
    stack: serif('Italiana'),
    note: 'ديسبلاي فاشيوني راقٍ جدًا — توقيع براندات التجميل',
  },
  {
    id: 'Tenor Sans',
    label: 'تينور — Tenor Sans',
    category: 'latin',
    href: gf('Tenor Sans', '400'),
    stack: sans('Tenor Sans', 'Cairo'),
    note: 'أنيق هادئ بروح بوتيك الجمال',
  },
  {
    id: 'Prata',
    label: 'براتا — Prata',
    category: 'latin',
    href: gf('Prata', '400'),
    stack: serif('Prata'),
    note: 'ديديون سيريف فخم للعناوين اللامعة',
  },
  {
    id: 'Cormorant Garamond',
    label: 'كورمورانت — Cormorant',
    category: 'latin',
    href: gf('Cormorant Garamond', '300;400;500;600;700'),
    stack: serif('Cormorant Garamond'),
    note: 'جاراموند راقٍ خفيف الظل — فخامة كلاسيكية',
  },
  {
    id: 'Marcellus',
    label: 'مارشيلوس — Marcellus',
    category: 'latin',
    href: gf('Marcellus', '400'),
    stack: serif('Marcellus'),
    note: 'روماني كلاسيكي بهدوء ملكي',
  },
  {
    id: 'Bodoni Moda',
    label: 'بودوني — Bodoni Moda',
    category: 'latin',
    href: gf('Bodoni Moda', '400;500;600;700'),
    stack: serif('Bodoni Moda'),
    note: 'بودوني عصري — خط مجلات الموضة',
  },

  /* ---------- لاتيني نظيف للواجهات ---------- */
  {
    id: 'Inter',
    label: 'انتر — Inter',
    category: 'latin',
    href: gf('Inter', '400;500;600;700;800'),
    stack: sans('Inter', 'Cairo'),
    note: 'لاتيني محايد احترافي — الأكثر أمانًا للواجهات',
  },
  {
    id: 'Manrope',
    label: 'مانروب — Manrope',
    category: 'latin',
    href: gf('Manrope', '400;500;600;700;800'),
    stack: sans('Manrope', 'Cairo'),
    note: 'هندسي دافئ بمساحات مريحة',
  },
  {
    id: 'DM Sans',
    label: 'دي إم — DM Sans',
    category: 'latin',
    href: gf('DM Sans', '400;500;600;700'),
    stack: sans('DM Sans', 'Cairo'),
    note: 'مستدير نظيف بلمسة عصرية',
  },
  {
    id: 'Poppins',
    label: 'بوبينز — Poppins',
    category: 'latin',
    href: gf('Poppins', '300;400;500;600;700;800'),
    stack: sans('Poppins', 'Cairo'),
    note: 'هندسي دائري ودود وأنيق',
  },
  {
    id: 'Montserrat',
    label: 'مونتسيرات — Montserrat',
    category: 'latin',
    href: gf('Montserrat', '400;500;600;700;800'),
    stack: sans('Montserrat', 'Cairo'),
    note: 'كلاسيكي حضري متعدد الاستخدامات',
  },

  /* ---------- العربي الآمن للمتاجر ---------- */
  {
    id: 'Cairo',
    label: 'القاهرة — Cairo',
    category: 'arabic',
    href: gf('Cairo', '400;500;600;700;800;900'),
    stack: sans('Cairo'),
    note: 'عصري واضح للعربية واللاتينية — الاختيار الأكثر أمانًا',
  },
  {
    id: 'Tajawal',
    label: 'تجوال — Tajawal',
    category: 'arabic',
    href: gf('Tajawal', '400;500;700;800'),
    stack: sans('Tajawal'),
    note: 'عربي نظيف بمزاج هندسي خفيف',
  },
  {
    id: 'Almarai',
    label: 'المراعي — Almarai',
    category: 'arabic',
    href: gf('Almarai', '300;400;700;800'),
    stack: sans('Almarai'),
    note: 'عربي ناعم مقروء جدًا للمتاجر',
  },
  {
    id: 'Alexandria',
    label: 'إسكندرية — Alexandria',
    category: 'arabic',
    href: gf('Alexandria', '300;400;500;600;700'),
    stack: sans('Alexandria'),
    note: 'عربي معاصر هندسي — توازن ممتاز مع اللاتيني',
  },
  {
    id: 'IBM Plex Sans Arabic',
    label: 'IBM بلكس عربي',
    category: 'arabic',
    href: gf('IBM Plex Sans Arabic', '400;500;600;700'),
    stack: sans('IBM Plex Sans Arabic'),
    note: 'تقني راقي بلمسة مؤسسية',
  },
  {
    id: 'Mada',
    label: 'مدى — Mada',
    category: 'arabic',
    href: gf('Mada', '400;500;600;700;800'),
    stack: sans('Mada'),
    note: 'عربي حديث نظيف بثقل متوازن',
  },
  {
    id: 'Vazirmatn',
    label: 'وزيرمتن — Vazirmatn',
    category: 'arabic',
    href: gf('Vazirmatn', '400;500;600;700'),
    stack: sans('Vazirmatn'),
    note: 'عربي فسيح مريح للقراءة — حديث جدًا',
  },
  {
    id: 'Changa',
    label: 'شنجا — Changa',
    category: 'arabic',
    href: gf('Changa', '400;500;600;700;800'),
    stack: sans('Changa'),
    note: 'عربي مضغوط قوي — ممتاز للعناوين',
  },

  /* ---------- عربي بشخصية أقوى ---------- */
  {
    id: 'Noto Kufi Arabic',
    label: 'نوتو كوفي — Noto Kufi',
    category: 'arabic',
    href: gf('Noto Kufi Arabic', '400;500;600;700;800'),
    stack: sans('Noto Kufi Arabic'),
    note: 'كوفي حديث — شخصية قوية للعناوين',
  },
  {
    id: 'Reem Kufi',
    label: 'ريم كوفي — Reem Kufi',
    category: 'arabic',
    href: gf('Reem Kufi', '400;500;600;700'),
    stack: sans('Reem Kufi'),
    note: 'كوفي هندسي راقٍ — مثالي للشعارات',
  },
  {
    id: 'El Messiri',
    label: 'المسيري — El Messiri',
    category: 'arabic',
    href: gf('El Messiri', '400;500;600;700'),
    stack: sans('El Messiri', 'Cairo'),
    note: 'عربي أنيق بحواف راقية',
  },
  {
    id: 'Baloo Bhaijaan 2',
    label: 'بالو — Baloo Bhaijaan 2',
    category: 'dual',
    href: gf('Baloo Bhaijaan 2', '400;500;600;700;800'),
    stack: sans('Baloo Bhaijaan 2', 'Cairo'),
    note: 'مستدير مرح بلمسة تجميلية (عربي + لاتيني)',
  },

  /* ---------- مزدوج عربي/لاتيني ---------- */
  {
    id: 'Readex Pro',
    label: 'ريدكس برو — Readex Pro',
    category: 'dual',
    href: gf('Readex Pro', '400;500;600;700'),
    stack: sans('Readex Pro'),
    note: 'مزدوج (عربي/لاتيني) بعصارة تجميلية',
  },
  {
    id: 'Rubik',
    label: 'روبيك — Rubik',
    category: 'dual',
    href: gf('Rubik', '400;500;600;700;800'),
    stack: sans('Rubik', 'Cairo'),
    note: 'مزدوج مستدير ودود',
  },

  /* ---------- نسخي/خطي كلاسيكي ---------- */
  {
    id: 'Amiri',
    label: 'أميري — Amiri',
    category: 'arabic',
    href: gf('Amiri', '400;700'),
    stack: serif('Amiri'),
    note: 'نسخي كلاسيكي فخم (Serif)',
  },
  {
    id: 'Scheherazade New',
    label: 'شهرزاد — Scheherazade',
    category: 'arabic',
    href: gf('Scheherazade New', '400;500;600;700'),
    stack: serif('Scheherazade New'),
    note: 'نسخ كلاسيكي فسيح للقراءة الطويلة',
  },
  {
    id: 'Aref Ruqaa',
    label: 'عارف رقعة — Aref Ruqaa',
    category: 'arabic',
    href: gf('Aref Ruqaa', '400;700'),
    stack: serif('Aref Ruqaa', 'Amiri'),
    note: 'رقعة خطية أصيلة بروح الخط العربي',
  },
  {
    id: 'Lalezar',
    label: 'لاله زار — Lalezar',
    category: 'arabic',
    href: gf('Lalezar', '400'),
    stack: sans('Lalezar', 'Cairo'),
    note: 'عربي عرضي سميك — إعلانات وعناوين بارزة',
  },
];

export const DEFAULT_FONT_ID = 'Jost';

export function resolveFont(id: unknown): FontEntry {
  return FONT_CATALOG.find((f) => f.id === id) ?? FONT_CATALOG[0];
}

/** Visual identity — Studio settings key "identity" */
export type BrandIdentity = {
  brandName?: string; // displayed logo word — structure stays LUBNÉL-shaped
  brandTagline?: string; // small line under/next the logo
  instagramHandle?: string; // "@lubnel.eg"
  baseFont?: string; // FONT_CATALOG id
  faviconUrl?: string; // /favicon.png or external URL
};

export const DEFAULT_IDENTITY: Required<Pick<BrandIdentity, 'brandName' | 'brandTagline'>> & BrandIdentity = {
  brandName: 'LUBNÉL',
  brandTagline: 'BEAUTY RITUALS',
};

export function resolveIdentity(stored: unknown): BrandIdentity {
  if (!stored || typeof stored !== 'object') return DEFAULT_IDENTITY;
  const s = stored as BrandIdentity;
  return {
    ...DEFAULT_IDENTITY,
    ...s,
    brandName: (s.brandName || '').trim() || DEFAULT_IDENTITY.brandName,
    brandTagline: (s.brandTagline || '').trim() || DEFAULT_IDENTITY.brandTagline,
  };
}

/** SEO & sharing — Studio settings key "seo" */
export type SiteSeo = {
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  keywords?: string;
  ogImage?: string;
};

export function resolveSeo(stored: unknown): SiteSeo {
  if (!stored || typeof stored !== 'object') return {};
  return stored as SiteSeo;
}
