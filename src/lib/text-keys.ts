// U51-GLOBAL-TEXTS — «وسعلي بقا الصلاحيات ف النصوص يكون ليا صلاحيه اعدل اي نص
// وجود ف الموقع بالكامل» — the single registry of every storefront string the
// owner can override from Studio → «كل النصوص».
//
// Layering (no duplication):
//   • DICT (src/lib/i18n.ts) stays the source of truth for DEFAULT values.
//   • This module is server-safe (no 'use client') and holds ONLY the key
//     list + admin metadata, so API routes can whitelist keys while the admin
//     UI groups/labels them.
//   • Overrides live in StoreSettings key "uitexts" as { key: {ar,en} };
//     empty string = clear override (fall back to DICT default).
//   • (store)/layout.tsx loads the bag per request and feeds <TextsProvider>,
//     so SSR and hydration render the same text (no flash, no mismatch).

export const TEXT_GROUPS = [
  { id: 'topbar', title: 'شريط الإعلان والتنقل' },
  { id: 'home', title: 'الصفحة الرئيسية' },
  { id: 'catalog', title: 'الكتالوج والبحث' },
  { id: 'pdp', title: 'صفحة المنتج' },
  { id: 'cart', title: 'السلة والدفع' },
  { id: 'club', title: 'نادي لوبنيل' },
  { id: 'footer', title: 'الفوتر والمساعد' },
] as const;

export type TextGroupId = (typeof TEXT_GROUPS)[number]['id'];

export const TEXT_META: Record<string, { label: string; group: TextGroupId }> = {
  // topbar
  announcement: { label: 'شريط الإعلان (الرسالة الأولى)', group: 'topbar' },
  announceWelcome: { label: 'شريط الإعلان — رسالة الترحيب', group: 'topbar' },
  announceAuthentic: { label: 'شريط الإعلان — رسالة الأصالة', group: 'topbar' },
  home: { label: 'تبويب الرئيسية', group: 'topbar' },
  navCategories: { label: 'تبويب التصنيفات', group: 'topbar' },
  search: { label: 'تبويب البحث', group: 'topbar' },
  cart: { label: 'تبويب السلة', group: 'topbar' },
  bag: { label: 'كلمة «الحقيبة»', group: 'topbar' },
  navMore: { label: 'تبويب المزيد', group: 'topbar' },
  navMoreTitle: { label: 'قائمة المزيد — العنوان', group: 'topbar' },
  navMoreTagline: { label: 'قائمة المزيد — الجملة الختامية', group: 'topbar' },
  wishlist: { label: 'المفضلة', group: 'topbar' },
  account: { label: 'حسابي', group: 'topbar' },
  // home
  shopNow: { label: 'زر «تسوّقي الآن»', group: 'home' },
  discoverSkin: { label: 'زر «اكتشفي العناية»', group: 'home' },
  exploreEdit: { label: 'زر «شاهدي المختارات»', group: 'home' },
  shopByCat: { label: 'قسم الفئات — العنوان', group: 'home' },
  shopByCatSub: { label: 'قسم الفئات — الوصف', group: 'home' },
  bestSellers: { label: 'الأكثر رواجًا — العنوان', group: 'home' },
  bestSellersSub: { label: 'الأكثر رواجًا — الوصف', group: 'home' },
  reviewsTitle: { label: 'قسم التقييمات — العنوان', group: 'home' },
  reviewsSub: { label: 'قسم التقييمات — الوصف', group: 'home' },
  verifiedBuyer: { label: 'شارة «عميلة موثّقة»', group: 'home' },
  askLou: { label: 'بانر لُو — العنوان', group: 'home' },
  askLouSub: { label: 'بانر لُو — الوصف', group: 'home' },
  // catalog
  allProducts: { label: 'كل المنتجات', group: 'catalog' },
  catalogSub: { label: 'وصف صفحة الكتالوج', group: 'catalog' },
  allCat: { label: 'فئة «الكل»', group: 'catalog' },
  products: { label: 'كلمة «منتجًا متاحًا»', group: 'catalog' },
  noProducts: { label: 'لا توجد منتجات — النص', group: 'catalog' },
  back: { label: 'زر العودة للتسوّق', group: 'catalog' },
  // pdp
  addToBag: { label: 'زر أضيفي إلى السلة', group: 'pdp' },
  buyNow: { label: 'زر اشتري الآن', group: 'pdp' },
  quantity: { label: 'كلمة «الكمية»', group: 'pdp' },
  reviews: { label: 'كلمة «تقييم»', group: 'pdp' },
  limited: { label: 'شارة «كمية محدودة»', group: 'pdp' },
  mightLike: { label: '«قد يعجبك أيضًا»', group: 'pdp' },
  details: { label: 'تبويب التفاصيل', group: 'pdp' },
  shipReturns: { label: 'تبويب الشحن والإرجاع', group: 'pdp' },
  shipReturnsBody: { label: 'نص الشحن والإرجاع', group: 'pdp' },
  addToCartTitle: { label: 'تنبيه الإضافة للسلة — العنوان', group: 'pdp' },
  // cart
  emptyCart: { label: 'السلة الفارغة — العنوان', group: 'cart' },
  emptyCartSub: { label: 'السلة الفارغة — الوصف', group: 'cart' },
  startShopping: { label: 'زر ابدئي التسوق', group: 'cart' },
  subtotal: { label: 'الإجمالي الفرعي', group: 'cart' },
  shipping: { label: 'الشحن', group: 'cart' },
  total: { label: 'الإجمالي', group: 'cart' },
  free: { label: 'كلمة «مجاني»', group: 'cart' },
  egp: { label: 'رمز العملة (ج.م)', group: 'cart' },
  deliveryInfo: { label: 'بيانات التوصيل — العنوان', group: 'cart' },
  confirmOrder: { label: 'زر تأكيد الطلب', group: 'cart' },
  cod: { label: 'سطر الدفع عند الاستلام', group: 'cart' },
  checkoutTitle: { label: 'إتمام الطلب — العنوان', group: 'cart' },
  orderViaWa: { label: 'زر الطلب عبر واتساب', group: 'cart' },
  fullDetails: { label: 'بيانات التوصيل كاملة', group: 'cart' },
  name: { label: 'حقل الاسم', group: 'cart' },
  phone: { label: 'حقل الهاتف', group: 'cart' },
  city: { label: 'حقل المدينة', group: 'cart' },
  address: { label: 'حقل العنوان', group: 'cart' },
  notes: { label: 'حقل الملاحظات', group: 'cart' },
  notesPh: { label: 'مثال الملاحظات (Placeholder)', group: 'cart' },
  // club
  newsletterTitle: { label: 'النشرة — العنوان', group: 'club' },
  newsletterSub: { label: 'النشرة — الوصف الافتراضي', group: 'club' },
  newsletterPh: { label: 'النشرة — Placeholder البريد', group: 'club' },
  newsletterBtn: { label: 'النشرة — زر الاشتراك', group: 'club' },
  newsletterOk: { label: 'النشرة — رسالة النجاح', group: 'club' },
  newsletterErr: { label: 'النشرة — رسالة الخطأ', group: 'club' },
  perkFirst: { label: 'ميزة 1 — خصم أول طلب', group: 'club' },
  perkEarly: { label: 'ميزة 2 — وصول مبكر', group: 'club' },
  perkExclusive: { label: 'ميزة 3 — عروض حصرية', group: 'club' },
  privacyLine: { label: 'سطر الخصوصية', group: 'club' },
  // footer
  footerShop: { label: 'عمود «تسوّقي»', group: 'footer' },
  footerHelp: { label: 'عمود «خدمة العملاء»', group: 'footer' },
  footerContact: { label: 'عمود «تواصلي معنا»', group: 'footer' },
  footerHours: { label: 'سطر مواعيد العمل', group: 'footer' },
  footerLocation: { label: 'سطر الموقع الجغرافي', group: 'footer' },
  footerPayments: { label: 'سطر طرق الدفع', group: 'footer' },
  codBadge: { label: 'شارة الدفع عند الاستلام', group: 'footer' },
  returnsBadge: { label: 'شارة الإرجاع 14 يوم', group: 'footer' },
  louChip: { label: 'بانر لُو — الشارة العلوية', group: 'footer' },
  louTitle: { label: 'بانر لُو — العنوان', group: 'footer' },
  louDesc: { label: 'بانر لُو — الوصف', group: 'footer' },
  louCta: { label: 'بانر لُو — زر الاسأل', group: 'footer' },
  louSub: { label: 'بانر لُو — السطر السفلي', group: 'footer' },
  loadingAria: { label: 'نص تحميل الشاشة (لقارئ الشاشة)', group: 'footer' },
};

export const TEXT_KEYS = Object.keys(TEXT_META);

export type TextOverride = { ar?: string; en?: string };
export type TextOverrideBag = Record<string, TextOverride>;

/** Validate + clamp a stored bag (server-side). Unknown keys and non-string
 *  values are dropped; every value is capped to keep the DB row sane. */
export function sanitizeTextBag(input: unknown): TextOverrideBag {
  const out: TextOverrideBag = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(TEXT_META, k)) continue;
    if (!v || typeof v !== 'object') continue;
    const pair = v as Record<string, unknown>;
    const ar = typeof pair.ar === 'string' ? pair.ar.slice(0, 1000) : undefined;
    const en = typeof pair.en === 'string' ? pair.en.slice(0, 1000) : undefined;
    if (ar !== undefined || en !== undefined) out[k] = { ...(ar !== undefined ? { ar } : {}), ...(en !== undefined ? { en } : {}) };
  }
  return out;
}
