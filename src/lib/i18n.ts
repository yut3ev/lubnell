'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'ar' | 'en';

interface LangState {
  lang: Lang;
  toggle: () => void;
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: 'ar',
      toggle: () => set((s) => ({ lang: s.lang === 'ar' ? 'en' : 'ar' })),
    }),
    // U23-HYDRA-BOOT — skipHydration: zustand's persist rehydrates
    // SYNCHRONOUSLY from localStorage before React's first client render, so
    // a visitor who last picked EN got a whole tree of text/dir mismatches
    // against the ar-rendered SSR HTML ("A tree hydrated but..." with
    // hundreds of diff lines). The store now stays on the SSR default until
    // <StoreBoot /> rehydrates it after mount — first render always matches
    // the server, the persisted language applies right after.
    { name: 'lubnel-lang', skipHydration: true }
  )
);

const DICT = {
  ar: {
    announcement: 'شحن مجاني للطلبات فوق 900 ج.م · توصيل لكل مصر',
    home: 'الرئيسية',
    bag: 'الحقيبة',
    cart: 'السلة',
    search: 'بحث',
    wishlist: 'المفضلة',
    account: 'حسابي',
    shopNow: 'تسوّقي الآن',
    discoverSkin: 'اكتشفي العناية',
    exploreEdit: 'شاهدي المختارات',
    shopByCat: 'تسوّقي حسب الفئة',
    shopByCatSub: 'عوالم لوبنيل من الجمال، اختاري ما يناسب لحظتك',
    bestSellers: 'الأكثر حبًا لدى عميلاتنا',
    bestSellersSub: 'قطع مميزة حصدت أعلى التقييمات',
    allProducts: 'كل المنتجات',
    addToBag: 'أضيفي إلى السلة',
    buyNow: 'اشتري الآن',
    quantity: 'الكمية',
    egp: 'ج.م',
    free: 'مجاني 🎉',
    subtotal: 'الإجمالي الفرعي',
    shipping: 'الشحن',
    total: 'الإجمالي',
    deliveryInfo: 'بيانات التوصيل',
    confirmOrder: 'تأكيد الطلب',
    confirmWithTotal: (t: string) => `تأكيد الطلب — ${t}`,
    cod: 'الدفع عند الاستلام متاح لجميع المحافظات',
    emptyCart: 'سلتك فارغة',
    emptyCartSub: 'لم تضيفي أي منتجات بعد — تصفحي تشكيلتنا واختاري ما يلمس قلبك 🌸',
    startShopping: 'ابدئي التسوق',
    freeShipLeft: (v: string) => `أضيفي بمنتجات بقيمة ${v} ج.م واحصلي على شحن مجاني!`,
    reviews: 'تقييم',
    limited: 'كمية محدودة',
    checkoutTitle: 'إتمام الطلب',
    orderViaWa: 'اطلبي عبر واتساب',
    fullDetails: 'بيانات التوصيل كاملة',
    name: 'الاسم بالكامل',
    phone: 'رقم الهاتف',
    city: 'المدينة',
    address: 'العنوان بالتفصيل',
    notes: 'ملاحظات (اختياري)',
    notesPh: 'مثال: تغليف هدية لعيد ميلاد 🎁',
    addToCartTitle: 'أُضيف إلى السلة 🛍️',
    addedDesc: (n: string) => `${n} في انتظارك في السلة.`,
    mightLike: 'قد يعجبك أيضًا',
    details: 'التفاصيل',
    shipReturns: 'الشحن والإرجاع',
    shipReturnsBody:
      'توصيل خلال 2–5 أيام عمل لجميع محافظات مصر. رسوم الشحن 60 ج.م، ومجاني للطلبات فوق 900 ج.م. إرجاع المنتجات غير المفتوحة خلال 14 يومًا.',
    products: 'منتجًا متاحًا',
    noProducts: 'لا توجد منتجات في هذه الفئة حاليًا — عودي قريبًا 🌸',
    back: 'العودة للتسوّق',
    askLou: 'محتارة في الهدية المثالية؟',
    askLouSub: 'اسألي "لُو" — مساعدتنا الذكية — وستقترح عليك الهدية الأنسب حسب المناسبة والميزانية.',
    catalogSub: 'تشكيلة لوبنيل كاملة — اختاري الفئة أو تصفحي الكل',
    allCat: 'الكل',
    reviewsTitle: 'آراء عميلاتنا',
    reviewsSub: 'تجارب حقيقية من ناس جرّبوا لوبنيل بحب',
    verifiedBuyer: 'عميلة موثّقة',
    newsletterTitle: 'انضمي إلى نادي لوبنيل',
    newsletterSub: 'خصم خاص على أول طلب + وصول مبكر للتشكيلات الجديدة والعروض الحصرية.',
    newsletterPh: 'بريدك الإلكتروني',
    newsletterBtn: 'اشتركي',
    newsletterOk: 'تم الاشتراك بنجاح! تفقدّي بريدك 🎉',
    newsletterErr: 'تعذّر الاشتراك — تأكدي من البريد وحاولي مجددًا',
    footerShop: 'تسوّقي',
    footerHelp: 'خدمة العملاء',
    footerContact: 'تواصلي معنا',
    footerHours: 'يوميًا من 10 صباحًا حتى 10 مساءً',
    footerLocation: 'القاهرة، مصر — توصيل لكل المحافظات',
    footerPayments: 'طرق دفع آمنة ومتاحة',
    codBadge: 'الدفع عند الاستلام',
    returnsBadge: 'إرجاع خلال 14 يوم',
    loadingAria: 'جارٍ تحميل لوبنيل...',
  },
  en: {
    announcement: 'Complimentary delivery over 900 EGP · Nationwide shipping',
    home: 'Home',
    bag: 'Bag',
    cart: 'Bag',
    search: 'Search',
    wishlist: 'Wishlist',
    account: 'Account',
    shopNow: 'Shop now',
    discoverSkin: 'Discover skincare',
    exploreEdit: 'Explore the edit',
    shopByCat: 'Shop by category',
    shopByCatSub: 'The LUBNÉL worlds of beauty — pick your moment',
    bestSellers: 'Loved by our clients',
    bestSellersSub: 'Pieces with the highest ratings',
    allProducts: 'All products',
    addToBag: 'Add to bag',
    buyNow: 'Buy now',
    quantity: 'Quantity',
    egp: 'EGP',
    free: 'Free 🎉',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    deliveryInfo: 'Delivery details',
    confirmOrder: 'Confirm order',
    confirmWithTotal: (t: string) => `Confirm order — ${t}`,
    cod: 'Cash on delivery available nationwide',
    emptyCart: 'Your bag is empty',
    emptyCartSub: 'No products yet — browse our edit and pick what touches your heart 🌸',
    startShopping: 'Start shopping',
    freeShipLeft: (v: string) => `Add ${v} EGP more to unlock free shipping!`,
    reviews: 'reviews',
    limited: 'Low stock',
    checkoutTitle: 'Checkout',
    orderViaWa: 'Order via WhatsApp',
    fullDetails: 'Full delivery details',
    name: 'Full name',
    phone: 'Phone number',
    city: 'City',
    address: 'Full address',
    notes: 'Notes (optional)',
    notesPh: 'e.g. gift wrapping for a birthday 🎁',
    addToCartTitle: 'Added to bag 🛍️',
    addedDesc: (n: string) => `${n} is waiting in your bag.`,
    mightLike: 'You may also like',
    details: 'Details',
    shipReturns: 'Shipping & returns',
    shipReturnsBody:
      'Delivery in 2–5 business days across Egypt. Shipping fee 60 EGP, free over 900 EGP. Unopened products can be returned within 14 days.',
    products: 'products available',
    noProducts: 'No products in this category yet — check back soon 🌸',
    back: 'Back to shop',
    askLou: 'Can’t pick the perfect gift?',
    askLouSub: 'Ask “Lou” — our smart assistant — for the best pick by occasion and budget.',
    catalogSub: 'The full LUBNÉL edit — filter by category or browse everything',
    allCat: 'All',
    reviewsTitle: 'Loved & reviewed',
    reviewsSub: 'Real experiences from clients who tried LUBNÉL with love',
    verifiedBuyer: 'Verified client',
    newsletterTitle: 'Join the LUBNÉL club',
    newsletterSub: 'A special first-order discount + early access to new drops and exclusive offers.',
    newsletterPh: 'Your email address',
    newsletterBtn: 'Subscribe',
    newsletterOk: 'Subscribed! Check your inbox 🎉',
    newsletterErr: 'Couldn’t subscribe — check the email and try again',
    footerShop: 'Shop',
    footerHelp: 'Customer care',
    footerContact: 'Contact us',
    footerHours: 'Daily from 10 AM to 10 PM',
    footerLocation: 'Cairo, Egypt — nationwide delivery',
    footerPayments: 'Secure payment options',
    codBadge: 'Cash on delivery',
    returnsBadge: '14-day returns',
    loadingAria: 'Loading LUBNÉL...',
  },
} as const;

export type Dict = (typeof DICT)['ar'];

export function useT(): { t: Dict; lang: Lang; ar: boolean } {
  const lang = useLang((s) => s.lang);
  const toggle = useLang((s) => s.toggle);
  void toggle;
  return { t: DICT[lang], lang, ar: lang === 'ar' };
}
