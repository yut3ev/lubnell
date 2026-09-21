// U22-ADMIN-FULL — the brand font gallery for Studio → الإعدادات →
// الهوية البصرية (الخط الأساسي — جادر لكل الموقع). Every entry is a Google
// Font loaded on demand: the admin gallery previews all of them with one
// combined stylesheet, and the storefront loads ONLY the chosen family.
// tag = 'ar' Arabic-first design, 'both' Arabic+Latin, 'lat' Latin-only.

export type BrandFontTag = 'ar' | 'both' | 'lat';

export type BrandFont = {
  id: string; // exact Google Fonts family name (css2 API)
  labelAr: string; // Arabic display name like her reference
  note: string;
  tag: BrandFontTag;
  weights: string; // css2 wght list
};

export const BRAND_FONTS: BrandFont[] = [
  { id: 'Cairo', labelAr: 'القاهرة — Cairo', note: 'الخط الحالي — عربي واضح متوازن يناسب كل الأسطح', tag: 'both', weights: '400;500;600;700;800' },
  { id: 'Tajawal', labelAr: 'تجوال — Tajawal', note: 'عربي هندسي عصري وخط عريض نظيف', tag: 'both', weights: '400;500;700;800' },
  { id: 'Almarai', labelAr: 'المراعي — Almarai', note: 'عربي ناعم تهم تنسيق النصوص الطويلة', tag: 'both', weights: '300;400;700;800' },
  { id: 'IBM Plex Sans Arabic', labelAr: 'IBM بلكس عربي', note: 'تقني راقٍ بنسخة هندسية مؤسسية', tag: 'both', weights: '400;500;600;700' },
  { id: 'El Messiri', labelAr: 'المسيري — El Messiri', note: 'لمسة عربية أنيقة للعناوين', tag: 'both', weights: '400;500;600;700' },
  { id: 'Changa', labelAr: 'شنجا — Changa', note: 'حديث بعناوين قوية الوزن', tag: 'both', weights: '400;500;600;700;800' },
  { id: 'Amiri', labelAr: 'أميري — Amiri', note: 'نسخ كلاسيكي فخم بطابع تراثي', tag: 'ar', weights: '400;700' },
  { id: 'Reem Kufi', labelAr: 'ريم كوفي — Reem Kufi', note: 'كوفي هندسي لعلامات مميزة', tag: 'ar', weights: '400;500;600;700' },
  { id: 'Aref Ruqaa', labelAr: 'عارف رقعة — Aref Ruqaa', note: 'رقعة أنيقة للعناوين المميزة', tag: 'ar', weights: '400;700' },
  { id: 'Markazi Text', labelAr: 'مركزي — Markazi Text', note: 'نص عربي مريح للقراءة الطويلة', tag: 'ar', weights: '400;500;600;700' },
  { id: 'Jost', labelAr: 'جوست — Jost', note: 'لاتيني هندسي بسيط يقترن بـ Cairo', tag: 'lat', weights: '400;500;600;700' },
  { id: 'Playfair Display', labelAr: 'بلايفير — Playfair', note: 'سيريف فخم للعناوين', tag: 'lat', weights: '400;500;600;700;800' },
  { id: 'Italiana', labelAr: 'إيتاليانا — Italiana', note: 'خط رفيع سينمائي للعناوين', tag: 'lat', weights: '400' },
  { id: 'Cormorant Garamond', labelAr: 'كورمورانت — Cormorant', note: 'سيريف رفيع بروح المجلات', tag: 'lat', weights: '400;500;600;700' },
  { id: 'Prata', labelAr: 'براتا — Prata', note: 'ديديون سيريف فخم للعناوين اللاتينية', tag: 'lat', weights: '400' },
  { id: 'Tenor Sans', labelAr: 'تينتور — Tenor Sans', note: 'أنيق هادئ يبدو بجانب Cairo', tag: 'lat', weights: '400' },
  { id: 'Inter', labelAr: 'انتر — Inter', note: 'لاتيني محايد بأحجام صغيرة واضحة', tag: 'lat', weights: '400;500;600;700;800' },
  { id: 'Bodoni Moda', labelAr: 'بودوني — Bodoni Moda', note: 'حداد عمودي — خط مجلات الموضة', tag: 'lat', weights: '400;500;600;700' },
  { id: 'Marcellus', labelAr: 'ماركيلوس — Marcellus', note: 'كلاسيكي بروح الماركات الكبيرة', tag: 'lat', weights: '400' },
  { id: 'Poppins', labelAr: 'بوبينز — Poppins', note: 'جيومتري ودود بأوزان متعددة', tag: 'lat', weights: '400;500;600;700' },
  { id: 'DM Sans', labelAr: 'دي إم — DM Sans', note: 'مستدير نظيف يعمل مع العربية', tag: 'lat', weights: '400;500;600;700' },
  { id: 'Manrope', labelAr: 'مانروب — Manrope', note: 'هندسي دافئ بمساحات مريحة', tag: 'lat', weights: '400;500;600;700;800' },
  { id: 'Montserrat', labelAr: 'مونتسرات — Montserrat', note: 'كلاسيكي حضري متعدد الاستخدامات', tag: 'lat', weights: '400;500;600;700;800' },
];

export const BRAND_FONT_TAGS: { key: '' | BrandFontTag; label: string }[] = [
  { key: '', label: 'الكل' },
  { key: 'lat', label: 'لاتيني' },
  { key: 'both', label: 'عربي + لاتيني' },
  { key: 'ar', label: 'عربي' },
];

export function brandFontById(id: string | undefined | null): BrandFont | null {
  if (!id) return null;
  return BRAND_FONTS.find((f) => f.id === id) ?? null;
}

/** css2 stylesheet URL for one or more families (used for previews + store). */
export function googleFontsHref(families: string[]): string {
  const qs = families
    .map((fam) => {
      const meta = BRAND_FONTS.find((f) => f.id === fam);
      return `family=${fam.replace(/ /g, '+')}:wght@${meta?.weights || '400;700'}`;
    })
    .join('&');
  return `https://fonts.googleapis.com/css2?${qs}&display=swap`;
}
