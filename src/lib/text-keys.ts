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
  { id: 'menus', title: 'القوائم والروابط' },
  { id: 'home', title: 'الصفحة الرئيسية' },
  { id: 'catalog', title: 'الكتالوج والبحث' },
  { id: 'search', title: 'نافذة البحث السريع' },
  { id: 'pdp', title: 'صفحة المنتج' },
  { id: 'reviews', title: 'تقييمات العميلات' },
  { id: 'cart', title: 'السلة والدفع' },
  { id: 'club', title: 'نادي لوبنيل' },
  { id: 'contact', title: 'صفحة تواصلي معنا' },
  { id: 'misc', title: 'صفحات ومكونات عامة' },
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
  galleryTitle: { label: 'شريط صور القسم — العنوان', group: 'catalog' },
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
  // U58-GALLERY
  gallerySwipeHint: { label: 'تلميح «اسحبي لمشاهدة المزيد من الصور»', group: 'pdp' },
  lbCloseAria: { label: 'زر إغلاق عرض الصور (لتمييز القارئ)', group: 'pdp' },
  lbPrevAria: { label: 'زر الصورة السابقة (لتمييز القارئ)', group: 'pdp' },
  lbNextAria: { label: 'زر الصورة التالية (لتمييز القارئ)', group: 'pdp' },
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
  // U57-TEXTS-COMPLETE — every remaining storefront string joins the
  // registry so the owner can edit literally any visible text.
  // menus — القوائم والروابط
  navSets: { label: 'قائمة المتجر — المجموعات', group: 'menus' },
  navMakeup: { label: 'قائمة المتجر — مكياج', group: 'menus' },
  navSkincare: { label: 'قائمة المتجر — عناية بالبشرة', group: 'menus' },
  navBodyCare: { label: 'قائمة المتجر — عناية بالجسم', group: 'menus' },
  navAbout: { label: 'قائمة المعلومات — عن لوبنيل', group: 'menus' },
  navShipping: { label: 'قائمة المعلومات — الشحن والتسليم', group: 'menus' },
  navReturns: { label: 'قائمة المعلومات — الاستبدال والإرجاع', group: 'menus' },
  navFaq: { label: 'قائمة المعلومات — الأسئلة الشائعة', group: 'menus' },
  navContact: { label: 'قائمة المعلومات — تواصلي معنا', group: 'menus' },
  navAdmin: { label: 'قائمة المزيد — لوحة الإدارة', group: 'menus' },
  navOffers: { label: 'قائمة المزيد — عروض اليوم', group: 'menus' },
  navMainAria: { label: 'قائمة الديسكتوب — نص لقارئ الشاشة', group: 'menus' },
  navBottomAria: { label: 'شريط التنقل السفلي — نص لقارئ الشاشة', group: 'menus' },
  menuAria: { label: 'زر فتح القائمة (لتمييز القارئ)', group: 'menus' },
  menuCloseAria: { label: 'زر إغلاق القائمة (لتمييز القارئ)', group: 'menus' },
  menuMobileAria: { label: 'قائمة الموبايل — نص لقارئ الشاشة', group: 'menus' },
  menuShopLabel: { label: 'قائمة الموبايل — عنوان قسم تسوّقي', group: 'menus' },
  menuInfoLabel: { label: 'قائمة الموبايل — عنوان قسم معلومات', group: 'menus' },
  menuLangAria: { label: 'زر تبديل اللغة (لتمييز القارئ)', group: 'menus' },
  menuSearchAria: { label: 'زر البحث السريع (لتمييز القارئ)', group: 'menus' },
  // search — نافذة البحث
  searchTitle: { label: 'نافذة البحث — العنوان', group: 'search' },
  searchHintAria: { label: 'نافذة البحث — الوصف (لقارئ الشاشة)', group: 'search' },
  searchPlaceholder: { label: 'نافذة البحث — Placeholder الحقل', group: 'search' },
  searchNoResults: { label: 'لا توجد نتائج — النص ({q} = كلمة البحث)', group: 'search' },
  searchTrending: { label: 'الأكثر بحثًا — العنوان', group: 'search' },
  searchTrends: { label: 'كلمات الأكثر بحثًا (افصليها بفاصلة)', group: 'search' },
  // reviews — التقييمات
  rvTitle: { label: 'قسم التقييمات — العنوان', group: 'reviews' },
  rvSectionAria: { label: 'قسم التقييمات — النص الداخلي', group: 'reviews' },
  rvWrite: { label: 'زر اكتبي تقييمكِ', group: 'reviews' },
  rvShare: { label: 'نموذج التقييم — العنوان', group: 'reviews' },
  rvYourRating: { label: 'تقييمكِ — سطر النجوم', group: 'reviews' },
  rvStarsAria: { label: 'مجموعة النجوم (لتمييز القارئ)', group: 'reviews' },
  rvName: { label: 'حقل الاسم', group: 'reviews' },
  rvOpinion: { label: 'حقل الرأي — العنوان', group: 'reviews' },
  rvOpinionPh: { label: 'حقل الرأي — Placeholder', group: 'reviews' },
  rvPhotoLabel: { label: 'إرفاق صورة — العنوان', group: 'reviews' },
  rvPhotoAlt: { label: 'وصف صورة المعاينة', group: 'reviews' },
  rvPhotoRemoveAria: { label: 'زر إزالة الصورة', group: 'reviews' },
  rvUploading: { label: 'جاري رفع الصورة — النص', group: 'reviews' },
  rvPickPhoto: { label: 'زر اختيار صورة من الجهاز', group: 'reviews' },
  rvSubmit: { label: 'زر نشر التقييم', group: 'reviews' },
  rvYoursBadge: { label: 'شارة «تقييمكِ» على المراجعة', group: 'reviews' },
  rvPhotoCustomerAlt: { label: 'وصف صور العميلات', group: 'reviews' },
  rvEmpty: { label: 'لا توجد تقييمات — النص', group: 'reviews' },
  rvOkTitle: { label: 'رسالة نجاح النشر — العنوان', group: 'reviews' },
  rvOkDesc: { label: 'رسالة نجاح النشر — الوصف', group: 'reviews' },
  rvErrSave: { label: 'خطأ حفظ التقييم', group: 'reviews' },
  rvErrConn: { label: 'خطأ الاتصال', group: 'reviews' },
  rvErrImage: { label: 'خطأ الملف ليس صورة', group: 'reviews' },
  rvErrUpload: { label: 'خطأ رفع الصورة', group: 'reviews' },
  rvErrUploadNet: { label: 'خطأ رفع الصورة — الشبكة', group: 'reviews' },
  rvErrMissing: { label: 'خطأ بيانات ناقصة — العنوان', group: 'reviews' },
  rvErrMissingDesc: { label: 'خطأ بيانات ناقصة — الوصف', group: 'reviews' },
  // contact — صفحة التواصل
  cpEmailLabel: { label: 'بطاقة البريد الإلكتروني — العنوان', group: 'contact' },
  cpHoursLabel: { label: 'بطاقة ساعات الدعم — العنوان', group: 'contact' },
  cpAddressLabel: { label: 'بطاقة العنوان — العنوان', group: 'contact' },
  cpWaPrefill: { label: 'رسالة واتساب الجاهزة', group: 'contact' },
  cpWaCta: { label: 'زر واتساب الرئيسي', group: 'contact' },
  cpWaChannel: { label: 'بطاقة قناة الواتساب', group: 'contact' },
  cpJoinChannel: { label: 'شارة انضمي للقناة', group: 'contact' },
  cpFollowBadge: { label: 'شارة تابعينا', group: 'contact' },
  cpFbPage: { label: 'بطاقة صفحة فيسبوك', group: 'contact' },
  cpIgPage: { label: 'بطاقة صفحة إنستجرام', group: 'contact' },
  cpTtPage: { label: 'بطاقة صفحة تيك توك', group: 'contact' },
  cpSocialTitle: { label: 'قسم تابعينا على — العنوان', group: 'contact' },
  cpSocialAria: { label: 'قسم تابعينا — النص الداخلي', group: 'contact' },
  cpShipFee: { label: 'شريحة رسوم الشحن ({fee} = الرسوم)', group: 'contact' },
  cpShipFree: { label: 'شريحة الشحن المجاني ({threshold} = الحد)', group: 'contact' },
  cpCod: { label: 'شريحة الدفع عند الاستلام', group: 'contact' },
  cpDeliveryTitle: { label: 'جدول التوصيل — العنوان', group: 'contact' },
  cpZoneCol: { label: 'جدول التوصيل — عمود المنطقة', group: 'contact' },
  cpTimeCol: { label: 'جدول التوصيل — عمود المدة', group: 'contact' },
  cpJourneyTitle: { label: 'رحلة طلبك — العنوان', group: 'contact' },
  // misc — عامة
  nfTitleProduct: { label: 'صفحة 404 — عنوان منتج مفقود', group: 'misc' },
  nfTitleRoute: { label: 'صفحة 404 — عنوان رابط خاطئ', group: 'misc' },
  nfSubProduct: { label: 'صفحة 404 — وصف منتج مفقود', group: 'misc' },
  nfSubRoute: { label: 'صفحة 404 — وصف رابط خاطئ', group: 'misc' },
  nfCtaShop: { label: 'صفحة 404 — زر تسوّقي المجموعة', group: 'misc' },
  nfCtaHome: { label: 'صفحة 404 — زر العودة للرئيسية', group: 'misc' },
  nfCtaSearch: { label: 'صفحة 404 — زر البحث', group: 'misc' },
  nfTrustGift: { label: 'صفحة 404 — شارة تغليف الهدايا', group: 'misc' },
  nfTrustCod: { label: 'صفحة 404 — شارة الدفع عند الاستلام', group: 'misc' },
  nfTrustShip: { label: 'صفحة 404 — شارة التوصيل السريع', group: 'misc' },
  nfClosestBadge: { label: 'رف 404 — شارة أقرب البدائل', group: 'misc' },
  nfVisitorsBadge: { label: 'رف 404 — شارة اختيارات الزوار', group: 'misc' },
  nfTryThese: { label: 'رف 404 — عنوان جرّبي هذه', group: 'misc' },
  nfStartHere: { label: 'رف 404 — عنوان ابدئي من هنا', group: 'misc' },
  fbtTitle: { label: 'اشتريهم مع بعض — العنوان', group: 'misc' },
  fbtTotal: { label: 'إجمالي المجموعة ({n} = العدد)', group: 'misc' },
  fbtSaving: { label: 'شارة التوفير', group: 'misc' },
  fbtAdd: { label: 'زر أضيفي المجموعة للسلة', group: 'misc' },
  fbtToast: { label: 'تنبيه إضافة المجموعة — العنوان', group: 'misc' },
  fbtToastSub: { label: 'تنبيه إضافة المجموعة — الوصف ({n} = العدد)', group: 'misc' },
  viewAll: { label: 'زر عرض الكل', group: 'misc' },
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
