// U2 (task 2-a) — built-in storefront info pages. Every footer/policy link
// (about, contact, faq, shipping, returns, privacy, terms) lands on a real,
// professionally-written page even on a cold/empty database.
//
// Layering (identical philosophy to site-texts.ts):
//   1. Admin override — Studio → «الصفحات» (StoreSettings key "pages") wins.
//   2. These shipped defaults render when the slug has no admin entry.
//
// The admin Pages section can seed this whole set into the settings via the
// `seed-defaults` action of /api/admin/pages, then edit freely (AR + EN).

export type InfoSlug =
  | 'about'
  | 'contact'
  | 'faq'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms';

export const INFO_SLUGS: readonly InfoSlug[] = [
  'about',
  'contact',
  'faq',
  'shipping',
  'returns',
  'privacy',
  'terms',
];

export function isInfoSlug(slug: string): slug is InfoSlug {
  return (INFO_SLUGS as readonly string[]).includes(slug);
}

/** Arabic labels for the built-in slugs (used by admin UI + storefront). */
export const INFO_SLUG_LABELS: Record<InfoSlug, string> = {
  about: 'عن لوبنيل',
  contact: 'تواصل',
  faq: 'الأسئلة الشائعة',
  shipping: 'الشحن',
  returns: 'الاستبدال والإرجاع',
  privacy: 'الخصوصية',
  terms: 'الشروط',
};

export type FaqPair = { q: string; a: string };

export type ShippingRegion = {
  nameAr: string;
  nameEn: string;
  timeAr: string;
  timeEn: string;
};

export type ShippingStep = {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

export type InfoPageSeed = {
  slug: InfoSlug;
  titleAr: string;
  titleEn: string;
  /** short meta description (Arabic) used by generateMetadata */
  descAr: string;
  /** optional English mirror of descAr (documented for the EN toggle) */
  descEn?: string;
  /** paragraphs separated by a blank line; lines starting with «•» render as bullet lists */
  contentAr: string;
  contentEn: string;
};

/* ------------------------------------------------------------------ */
/* FAQ — 8 questions covering the store facts                          */
/* ------------------------------------------------------------------ */

export const DEFAULT_FAQ_ITEMS: { qAr: string; aAr: string; qEn: string; aEn: string }[] = [
  {
    qAr: 'كم تستغرق مدة الشحن؟',
    aAr: 'نجهّز طلبك في نفس اليوم إذا وصلنا قبل 4 عصرًا، ويصلك خلال 2–5 أيام عمل حسب المحافظة (القاهرة الكبرى عادة 1–2 يوم). تفاصيل كل المناطق في صفحة «الشحن».',
    qEn: 'How long does shipping take?',
    aEn: 'Orders placed before 4 PM are prepared the same day and arrive within 2–5 business days depending on the governorate (Greater Cairo usually 1–2 days). Full details on the Shipping page.',
  },
  {
    qAr: 'كم رسوم الشحن؟ وهل يوجد شحن مجاني؟',
    aAr: 'رسوم الشحن 60 ج.م لكل المحافظات، ومجانية تمامًا للطلبات التي تتجاوز 900 ج.م — يُحسب الخصم تلقائيًا في الحقيبة.',
    qEn: 'What is the shipping fee? Is there free shipping?',
    aEn: 'Shipping is 60 EGP nationwide and completely free for orders above 900 EGP — the discount is applied automatically in your bag.',
  },
  {
    qAr: 'هل الدفع عند الاستلام متاح؟',
    aAr: 'نعم — الدفع عند الاستلام (كاش للمندوب) متاح لجميع محافظات مصر، إضافة إلى فودافون كاش والبطاقات (فيزا/ماستركارد).',
    qEn: 'Is cash on delivery available?',
    aEn: 'Yes — cash on delivery is available in every Egyptian governorate, along with Vodafone Cash and card payments (Visa/Mastercard).',
  },
  {
    qAr: 'كيف أتابع طلبي؟',
    aAr: 'بعد التأكيد يصلك رقم طلب مثل LN-XXXXXX. راسلينا به على واتساب في أي وقت وسنخبرك بحالة الطلب، ونوافيك بالتحديثات حتى باب منزلك.',
    qEn: 'How do I track my order?',
    aEn: 'After confirmation you receive an order number like LN-XXXXXX. Send it to us on WhatsApp anytime and we will update you until your order reaches your door.',
  },
  {
    qAr: 'هل أحتاج إلى إنشاء حساب للطلب؟',
    aAr: 'لا إطلاقًا. الطلب كضيفة بالكامل — يكفي اسمك ورقم هاتفك وعنوانك، ونؤكد الطلب معك عبر واتساب.',
    qEn: 'Do I need an account to order?',
    aEn: 'Not at all. Checkout is fully guest-based — just your name, phone number and address, and we confirm the order with you over WhatsApp.',
  },
  {
    qAr: 'هل المنتجات أصلية؟',
    aAr: 'نعم — كل منتجاتنا أصلية 100% ومصدرها موزعون معتمدون. أي منتج يتبين عدم أصالته نستبدله فورًا ونتحمل كامل التكلفة.',
    qEn: 'Are the products original?',
    aEn: 'Yes — every product is 100% original, sourced from authorized distributors. If anything proves otherwise, we replace it immediately at our full expense.',
  },
  {
    qAr: 'ما سياسة الاستبدال والإرجاع؟',
    aAr: 'لديك 14 يومًا من تاريخ الاستلام للاستبدال أو الإرجاع، بشرط أن يكون المنتج بتغليفه الأصلي وغير مستخدم. إذا وصلك منتج تالف أو مختلف نتحمل نحن كل الرسوم — التفاصيل في صفحة «الاستبدال والإرجاع».',
    qEn: 'What is your return & exchange policy?',
    aEn: 'You have 14 days from delivery to exchange or return, provided the product is in its original unopened packaging. If an item arrives damaged or wrong, we cover all costs — details on the Returns page.',
  },
  {
    qAr: 'هل لديكم كوبونات خصم أو عروض؟',
    aAr: 'نعم! كوبون ترحيبي لأول طلب، وعروض موسمية على المجموعات. أدخلي الكود في الحقيبة قبل إتمام الطلب وسيُطبَّق الخصم فورًا.',
    qEn: 'Do you offer coupons or deals?',
    aEn: 'Yes! A welcome coupon for your first order plus seasonal offers on our sets. Enter the code in the bag before checkout and the discount applies instantly.',
  },
];

/** AR/EN render-ready pairs for the shipped FAQ (used until the owner edits). */
export const DEFAULT_FAQ_PAIRS_AR: FaqPair[] = DEFAULT_FAQ_ITEMS.map((i) => ({ q: i.qAr, a: i.aAr }));
export const DEFAULT_FAQ_PAIRS_EN: FaqPair[] = DEFAULT_FAQ_ITEMS.map((i) => ({ q: i.qEn, a: i.aEn }));

/**
 * Parse admin-written FAQ text ("سؤال\\nجواب" blocks separated by a blank
 * line) into Q/A pairs. Returns fewer than 2 pairs for freeform prose —
 * callers should fall back to plain paragraph rendering then.
 */
export function faqPairsFromText(text: string): FaqPair[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length >= 2)
    .map((lines) => ({ q: lines[0], a: lines.slice(1).join('\n') }));
}

/* ------------------------------------------------------------------ */
/* Shipping — regions table + processing steps                         */
/* ------------------------------------------------------------------ */

export const SHIPPING_FEE_EGP = 60;
export const FREE_SHIPPING_EGP = 900;

export const SHIPPING_REGIONS: ShippingRegion[] = [
  { nameAr: 'القاهرة والجيزة الكبرى', nameEn: 'Greater Cairo (Cairo & Giza)', timeAr: '1–2 يوم عمل', timeEn: '1–2 business days' },
  { nameAr: 'الإسكندرية والدلتا', nameEn: 'Alexandria & Delta', timeAr: '2–3 أيام عمل', timeEn: '2–3 business days' },
  { nameAr: 'المدن الجديدة والساحل الشمالي', nameEn: 'New cities & North Coast', timeAr: '2–4 أيام عمل', timeEn: '2–4 business days' },
  { nameAr: 'مدن القناة وسيناء', nameEn: 'Canal cities & Sinai', timeAr: '2–4 أيام عمل', timeEn: '2–4 business days' },
  { nameAr: 'الصعيد ومحافظات الوجه القبلي', nameEn: 'Upper Egypt', timeAr: '3–5 أيام عمل', timeEn: '3–5 business days' },
];

export const SHIPPING_STEPS: ShippingStep[] = [
  {
    titleAr: 'تأكيد الطلب',
    titleEn: 'Order confirmation',
    bodyAr: 'يصلك رقم طلب مثل LN-XXXXXX، ويؤكد فريقنا التفاصيل معك عبر واتساب أو اتصال سريع.',
    bodyEn: 'You receive an order number like LN-XXXXXX and our team confirms the details with you over WhatsApp or a quick call.',
  },
  {
    titleAr: 'التجهيز والتغليف',
    titleEn: 'Packing & gift wrap',
    bodyAr: 'نجهّز طلبك ونغلّفه بعناية في علب فاخرة — نفس اليوم للطلبات قبل 4 عصرًا.',
    bodyEn: 'We prepare and carefully wrap your order in luxury boxes — same day for orders placed before 4 PM.',
  },
  {
    titleAr: 'الشحن والتتبع',
    titleEn: 'Shipping & tracking',
    bodyAr: 'يسلّم الطلب لشركة شحن موثوقة، ونوافيك بحالة الشحنة عبر واتساب حتى وصولها.',
    bodyEn: 'The parcel is handed to a trusted courier and we keep you updated on WhatsApp until it arrives.',
  },
  {
    titleAr: 'التوصيل والدفع',
    titleEn: 'Delivery & payment',
    bodyAr: 'تدفعين عند الاستلام (كاش) أو مسبقًا بفودافون كاش/بطاقة — وتستلمين طلبك بتغليف هدية مجاني.',
    bodyEn: 'Pay on delivery (cash) or beforehand via Vodafone Cash/card — and receive your order with free gift wrapping.',
  },
];

/* ------------------------------------------------------------------ */
/* The default pages — rich AR copy + full EN mirror                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_INFO_PAGES: Record<InfoSlug, InfoPageSeed> = {
  about: {
    slug: 'about',
    titleAr: 'عن لوبنيل',
    titleEn: 'About LUBNÉL',
    descAr:
      'تعرّفي على لوبنيل (Lubnel) — متجر إلكتروني مصري لبيع مستحضرات التجميل والعناية والعطور الأصلية أونلاين، مع صناديق هدايا فاخرة وتوصيل لكل محافظات مصر.',
    contentAr: `لوبنيل (Lubnel) هو متجر إلكتروني مصري لبيع مستحضرات التجميل والعناية والعطور الأصلية أونلاين.

وُلدت لوبنيل LUBNÉL في القاهرة من فكرة بسيطة: الجمال هدية تستحق أن تُقدَّم بإتقان. بدأنا كعلامة مصرية شغوفة بالتفاصيل — من اختيار المنتج قطعةً قطعة، إلى التغليف الذي يليق بمن تحبين — وحولنا طقوس الجمال اليومية إلى لحظات فاخرة تصلك أينما كنتِ في مصر.

نختار كل منتج بعناية من موزعين معتمدين فقط: مكياج أصلي، عناية بالبشرة والجسم، وعطور مختارة، وصناديق هدايا تُجمَّع يدويًا حسب المناسبة. لا نبيع أي شيء لا نستخدمه ونحبه بأنفسنا.

• منتجات أصلية 100% من موزعين معتمدين — والثقة خط أحمر لا نحيد عنه.
• تسوّق بسيط بدون حساب: اختاري من الموقع وأكملي الطلب معنا عبر واتساب خلال دقائق.
• الدفع عند الاستلام متاح لكل المحافظات — تدفعين فقط عندما يصل الطلب إلى يديكِ.
• تغليف هدايا مجاني مع كل طلب، وبطاقة إهداء بلمستنا الخاصة.
• شحن سريع لكل محافظات مصر خلال 2–5 أيام عمل، ومجاني للطلبات فوق 900 ج.م.

فريقنا متاح يوميًا من 10 صباحًا حتى 10 مساءً لمساعدتك في اختيار الهدية المثالية أو الإجابة عن أي استفسار. رسالتنا بسيطة ومكتوبة على شعارنا: جمالٌ يُهدى بكل حب.`,
    descEn:
      'Discover Lubnel (لوبنيل) — an Egyptian online store for original makeup, skincare, and fragrances online, with luxury gift boxes delivered across Egypt.',
    contentEn: `Lubnel (لوبنيل) is an Egyptian online store selling original makeup, skincare, and fragrances online — beauty gifted with love, delivered across Egypt.

LUBNÉL was born in Cairo from a simple idea: beauty is a gift that deserves to be given perfectly. We started as an Egyptian brand obsessed with detail — from choosing every product piece by piece, to packaging worthy of the person you love — turning daily beauty rituals into luxurious moments delivered anywhere in Egypt.

Every item is handpicked from authorized distributors only: original makeup, skin & body care, curated fragrances, and gift boxes assembled by hand for each occasion. We never sell anything we would not use and love ourselves.

• 100% original products from authorized distributors — trust is our non-negotiable line.
• Effortless shopping with no account: pick your favorites and complete the order with us on WhatsApp in minutes.
• Cash on delivery in every governorate — you pay only when the order is in your hands.
• Free gift wrapping with every order, plus a personal gift card.
• Fast nationwide shipping in 2–5 business days, free for orders above 900 EGP.

Our team is available daily from 10 AM to 10 PM to help you pick the perfect gift or answer any question. Our mission is simple, and it is written in our logo: beauty, gifted with love.`,
  },

  contact: {
    slug: 'contact',
    titleAr: 'تواصلي معنا',
    titleEn: 'Contact us',
    descAr:
      'فريق لوبنيل في خدمتك يوميًا من 10 صباحًا حتى 10 مساءً — واتساب، بريد إلكتروني، إنستغرام وفيسبوك. رد سريع على كل الاستفسارات.',
    contentAr: `يسعدنا أن نسمع منك! فريق لوبنيل متاح يوميًا من 10 صباحًا حتى 10 مساءً للإجابة عن استفساراتك، مساعدتك في اختيار الهدية المناسبة، أو متابعة طلبك.

• واتساب: أسرع طريقة للوصول إلينا — افتحي بطاقة «قناة الواتساب» من قسم «تابعينا على» بالأعلى وسيصلك رد سريع خلال ساعات الدعم.
• البريد الإلكتروني: hello@lubnel.com — للطلبات الرسمية والتعاونات.
• العنوان: القاهرة، مصر — ونوصل لكل المحافظات.
• إنستغرام وفيسبوك: تابعينا ليوميات لوبنيل وأفكار الهدايا والعروض أولًا بأول.

لطلبات الهدايا الكبيرة، الشركات، أو التعاون مع صنّاع المحتوى — راسلينا مع تفاصيل طلبك وسنعود إليك خلال 24 ساعة.`,
    contentEn: `We would love to hear from you! The LUBNÉL team is available daily from 10 AM to 10 PM to answer your questions, help you pick the right gift, or follow up on your order.

• WhatsApp: the fastest way to reach us — open the “WhatsApp channel” card from the “Follow us” section above and get a quick reply during support hours.
• Email: hello@lubnel.com — for official requests and collaborations.
• Location: Cairo, Egypt — delivering to every governorate.
• Instagram & Facebook: follow us for LUBNÉL diaries, gift ideas and early access to offers.

For bulk corporate gifting or creator collaborations — message us with your request details and we will get back to you within 24 hours.`,
  },

  faq: {
    slug: 'faq',
    titleAr: 'الأسئلة الشائعة',
    titleEn: 'Frequently asked questions',
    descAr:
      'أجوبة سريعة عن الشحن (2–5 أيام)، رسوم الشحن 60 ج.م والشحن المجاني فوق 900 ج.م، الدفع عند الاستلام، الإرجاع خلال 14 يومًا، وأصالة المنتجات.',
    contentAr: `كم تستغرق مدة الشحن؟
نجهّز طلبك في نفس اليوم إذا وصلنا قبل 4 عصرًا، ويصلك خلال 2–5 أيام عمل حسب المحافظة (القاهرة الكبرى عادة 1–2 يوم).

كم رسوم الشحن؟ وهل يوجد شحن مجاني؟
رسوم الشحن 60 ج.م لكل المحافظات، ومجانية تمامًا للطلبات فوق 900 ج.م.

هل الدفع عند الاستلام متاح؟
نعم — كاش للمندوب في جميع محافظات مصر، إضافة إلى فودافون كاش والبطاقات.

كيف أتابع طلبي؟
يصلك رقم طلب مثل LN-XXXXXX بعد التأكيد؛ راسلينا به على واتساب وسنخبرك بحالة الطلب فورًا.

هل أحتاج إلى إنشاء حساب للطلب؟
لا — الطلب كضيفة بالكامل: الاسم ورقم الهاتف والعنوان فقط، والتأكيد عبر واتساب.

هل المنتجات أصلية؟
نعم، أصلية 100% من موزعين معتمدين — وإن ثبت غير ذلك نستبدل المنتج فورًا على حسابنا.

ما سياسة الاستبدال والإرجاع؟
14 يومًا من الاستلام بشرط سلامة المنتج وتغليفه الأصلي؛ المنتجات التالفة أو المختلفة نستبدلها برسوم علينا.

هل لديكم كوبونات خصم؟
نعم — كوبون ترحيبي لأول طلب وعروض موسمية؛ أدخلي الكود في الحقيبة قبل الإتمام.`,
    contentEn: `How long does shipping take?
Orders before 4 PM are prepared same-day and arrive within 2–5 business days by governorate (Greater Cairo usually 1–2 days).

What is the shipping fee? Is there free shipping?
Shipping is 60 EGP nationwide and completely free for orders above 900 EGP.

Is cash on delivery available?
Yes — cash to the courier in all Egyptian governorates, plus Vodafone Cash and cards.

How do I track my order?
You receive an order number like LN-XXXXXX after confirmation; send it to us on WhatsApp for an instant status update.

Do I need an account to order?
No — fully guest checkout: name, phone and address only, confirmed over WhatsApp.

Are the products original?
Yes, 100% original from authorized distributors — otherwise we replace the item at our expense immediately.

What is the return & exchange policy?
14 days from delivery with the product in its original packaging; damaged or wrong items are exchanged at our cost.

Do you offer discount coupons?
Yes — a welcome coupon for your first order plus seasonal offers; enter the code in the bag before checkout.`,
  },

  shipping: {
    slug: 'shipping',
    titleAr: 'الشحن والتوصيل',
    titleEn: 'Shipping & delivery',
    descAr:
      'الشحن لكل محافظات مصر خلال 2–5 أيام عمل برسوم 60 ج.م، ومجاني للطلبات فوق 900 ج.م — مع جدول مناطق وخطوات تجهيز الطلب.',
    contentAr: `نوصل لكل محافظات مصر عبر شركات شحن موثوقة، ونجهّز الطلبات في نفس اليوم للطلبات الواردة قبل 4 عصرًا. أوقات التوصيل أدناه استرشادية تبدأ من لحظة شحن الطلب، وقد تتأثر قليلًا في مواسم الذروة والأعياد — وفريقنا يوافيك بأي تحديث فورًا عبر واتساب.

تُحسب رسوم الشحن تلقائيًا في الحقيبة، ويُطبَّق الشحن المجاني للطلبات فوق 900 ج.م دون أي كود. الدفع عند الاستلام متاح في كل المناطق.

ملاحظة: لا نستطيع الشحن للعناوين التي يتعذر عليها المندوب الوصول إليها هاتفيًا — تأكدي من صحة رقم الهاتف والعنوان عند الإتمام.`,
    contentEn: `We deliver to every Egyptian governorate through trusted couriers, and orders placed before 4 PM are prepared the same day. Delivery times below are estimates starting from dispatch and may shift slightly during peak seasons — our team updates you immediately over WhatsApp.

Shipping fees are calculated automatically in the bag, and free shipping applies to orders above 900 EGP with no code needed. Cash on delivery is available everywhere.

Note: we cannot ship to addresses the courier cannot reach by phone — please double-check your phone number and address at checkout.`,
  },

  returns: {
    slug: 'returns',
    titleAr: 'الاستبدال والإرجاع',
    titleEn: 'Returns & exchange',
    descAr:
      'سياسة الاستبدال والإرجاع في لوبنيل: 14 يومًا من الاستلام، شروط سلامة المنتج، خطوات الاستبدال، وطريقة استرداد المبلغ.',
    contentAr: `رضاكِ هو أولويتنا الأولى. يحق لكِ الاستبدال أو الإرجاع خلال 14 يومًا من تاريخ الاستلام، وفق الشروط التالية:

• أن يكون المنتج بحالته الأصلية، بتغليفه الكامل، وغير مستخدم.
• أدوات العناية الشخصية التي تلامس البشرة (فُرش، إسفنج، أدوات تجميل) لا تُرجع لأسباب صحية إلا إذا كانت متضررة عند الاستلام.
• المنتجات المفتوحة أو المستخدمة أو المخصصة (تغليف باسم) لا تقبل الإرجاع إلا في حالة عيب صناعي.

إذا وصلك منتج تالف أو مختلف عمّا طلبتِه، تواصلي معنا خلال 24 ساعة بصور المنتج عبر واتساب — نتحمل نحن كامل رسوم الاستبدال ونرسل البديل فورًا.

خطوات الاستبدال أو الإرجاع:
1. راسلينا على واتساب برقم الطلب (LN-XXXXXX) وسبب الإرجاع.
2. نرتّب لكِ موعد استلام من نفس العنوان — بلا أي رسوم في حالة العيب أو الخطأ من جهتنا.
3. نفحص القطعة بعد وصولها (خلال 1–2 يوم عمل).
4. نرسل البديل فورًا، أو نعيد المبلغ خلال 3–7 أيام عمل عبر فودافون كاش أو التحويل البنكي حسب طريقة الدفع الأصلية.

للإرجاع لأسباب شخصية تُخصم رسوم الشحن فقط (60 ج.م)، ويعاد باقي المبلغ بالكامل.`,
    contentEn: `Your satisfaction comes first. You may exchange or return any item within 14 days of delivery under the following conditions:

• The product must be in its original condition, complete packaging, and unused.
• Personal-care tools that touch the skin (brushes, sponges, applicators) cannot be returned for hygiene reasons unless damaged on arrival.
• Opened, used, or personalized (name-wrapped) items are not returnable except for manufacturing defects.

If an item arrives damaged or different from what you ordered, contact us within 24 hours with photos on WhatsApp — we cover all exchange costs and ship the replacement immediately.

Exchange & return steps:
1. Message us on WhatsApp with your order number (LN-XXXXXX) and the reason.
2. We schedule a pickup from the same address — free of charge for defects or our mistakes.
3. We inspect the item after it arrives (within 1–2 business days).
4. We ship the replacement right away, or refund within 3–7 business days via Vodafone Cash or bank transfer, matching the original payment method.

For returns for personal reasons only the shipping fee (60 EGP) is deducted; the rest is refunded in full.`,
  },

  privacy: {
    slug: 'privacy',
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy policy',
    descAr:
      'كيف تتعامل لوبنيل مع بياناتك: نجمع الاسم والهاتف والعنوان لتنفيذ الطلبات فقط، لا نشارك بياناتك، ويمكنك طلب حذفها في أي وقت.',
    contentAr: `خصوصيتكِ أمانة. هذه السياسة تشرح بالضبط ما نجمعه وكيف نستخدمه:

ما نجمعه ولماذا:
• الاسم ورقم الهاتف والعنوان — لتحضير طلبك وتوصيله فقط، ولا يُستخدمون لأي غرض تسويقي.
• سجل الطلبات ورقم الطلب — لخدمة ما بعد البيع، الإرجاع، وتتبع الشحنات.
• بيانات تقنية محدودة (نوع المتصفح وعنوان IP) لحماية الموقع من الاستخدام السيء ومحاولات الاختراق.

الكوكيز والتخزين المحلي:
نستخدم تخزينًا محليًا (localStorage) على جهازك فقط لحفظ تفضيل اللغة ومحتويات الحقيبة، حتى تظل بينما تعودين. لا نستخدم أي تتبع إعلاني ولا نبيع البيانات لأي طرف ثالث — البيانات تُشارك فقط مع شركة الشحن (الاسم/الهاتف/العنوان) لتنفيذ التوصيل.

حقوقك:
• يمكنك طلب حذف بياناتك وسجل طلباتك في أي وقت برسالة على واتساب أو بريد إلى hello@lubnel.com — وننفّذ الطلب خلال 72 ساعة.
• يمكنك طلب نسخة من بياناتك المحفوظة لدينا في أي وقت.

باستخدامك موقع لوبنيل فأنت توافقين على هذه السياسة. قد نحدّثها من وقت لآخر، وسنعلن أي تغييرات جوهرية على هذه الصفحة.`,
    contentEn: `Your privacy is a trust. This policy explains exactly what we collect and how we use it:

What we collect and why:
• Name, phone number and address — to prepare and deliver your order only; never used for marketing.
• Order history and order number — for after-sales service, returns, and shipment tracking.
• Limited technical data (browser type and IP address) to protect the site from abuse and attacks.

Cookies & local storage:
We use localStorage on your device only to remember your language preference and bag contents while you shop. No advertising trackers, and we never sell data to third parties — data is shared only with the courier company (name/phone/address) to complete delivery.

Your rights:
• You may request deletion of your data and order history anytime via WhatsApp or email to hello@lubnel.com — executed within 72 hours.
• You may request a copy of the data we hold about you at any time.

By using the LUBNÉL website you agree to this policy. We may update it from time to time and will announce any material changes on this page.`,
  },

  terms: {
    slug: 'terms',
    titleAr: 'الشروط والأحكام',
    titleEn: 'Terms & conditions',
    descAr:
      'شروط استخدام موقع لوبنيل: الأسعار والتوفر، تأكيد الطلبات عبر واتساب، اتفاقية الإرجاع، والملكية الفكرية.',
    contentAr: `باستخدامك موقع لوبنيل وإتمام أي طلب، فأنت توافقين على الشروط التالية:

الأسعار والتوفر:
• جميع الأسعار بالجنيه المصري وتشمل قيمة المنتج فقط؛ تُضاف رسوم الشحن (60 ج.م) عند الإتمام، والشحن مجاني للطلبات فوق 900 ج.م.
• الأسعار والعروض قابلة للتغيير دون إشعار مسبق، والسعر المعتمد هو المعلن لحظة إتمام الطلب في الموقع.
• توفر المنتجات مرتبط بالمخزون الفعلي؛ في حال نفاد قطعة بعد الطلب نتواصل معك فورًا للاستبدال أو الإلغاء الكامل مع استرداد المبلغ.

تأكيد الطلب والإلغاء:
• الطلب يُعتمد رسميًا بعد تأكيده من فريقنا عبر واتساب أو اتصال هاتفي؛ رقم الطلب LN-XXXXXX يصلك بعد الإتمام.
• لكِ الحق في إلغاء الطلب مجانًا قبل شحنه برسالة واتساب إلى فريقنا.
• الطلبات التي يتعذر تأكيدها هاتفيًا بعد 3 محاولات خلال 48 ساعة قد تُلغى تلقائيًا.

الإرجاع والدفع:
• الاستبدال والإرجاع يخضع لاتفاقية صفحة «الاستبدال والإرجاع» (14 يومًا، المنتج بحالته الأصلية).
• طرق الدفع المتاحة: الدفع عند الاستلام، فودافون كاش، والبطاقات (فيزا/ماستركارد) — حسب ما تختارينه عند الإتمام.
• الصور توضيحية وقد تختلف درجات الألوان قليلًا حسب إعدادات شاشتك.

الملكية الفكرية:
• جميع المحتويات — النصوص، الشعار، الصور والتصميم — ملك حصري لـ LUBNÉL ولا يجوز نسخها أو استخدامها تجاريًا دون إذن كتابي.

لأي استفسار حول هذه الشروط: hello@lubnel.com — ونأكّدك أن القانون المصري هو المرجع في أي نزاع.`,
    contentEn: `By using the LUBNÉL website and placing any order, you agree to the following terms:

Pricing & availability:
• All prices are in Egyptian Pounds and cover the product only; shipping (60 EGP) is added at checkout, and shipping is free above 900 EGP.
• Prices and offers may change without prior notice; the binding price is the one shown at the moment the order is placed.
• Availability is tied to actual stock; if an item runs out after ordering we contact you immediately for a replacement or a full cancellation with refund.

Order confirmation & cancellation:
• An order becomes official after our team confirms it via WhatsApp or phone; you receive an LN-XXXXXX order number at checkout.
• You may cancel free of charge before dispatch with a WhatsApp message to our team.
• Orders that cannot be confirmed after 3 attempts within 48 hours may be cancelled automatically.

Returns & payment:
• Exchanges and returns follow the Returns page agreement (14 days, original condition).
• Payment methods: cash on delivery, Vodafone Cash, and cards (Visa/Mastercard) — as chosen at checkout.
• Images are illustrative; colors may vary slightly with your screen settings.

Intellectual property:
• All content — texts, logo, images and design — is the exclusive property of LUBNÉL and may not be copied or used commercially without written permission.

For any question about these terms: hello@lubnel.com — Egyptian law governs any dispute.`,
  },
};
