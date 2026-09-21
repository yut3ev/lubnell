// LUBNÉL seed data — products, categories, hero slides, coupons
// Catalog = the owner's REAL inventory (9 products, all published).
// Images are the final LUBNÉL-branded set (lb-*.jpg, watermarked).
import type { Product, HeroSlide } from "./lubnel-types";

const img = (file: string) => `/images/${file}`;

export const seedProducts: Product[] = [
  {
    id: "university-box", name: "University Beauty Box", nameAr: "بوكس الجامعة",
    category: "Sets", categoryAr: "مجموعات", price: 200, oldPrice: 260,
    image: img("products/lb-university-box.webp"), images: [img("products/lb-university-box.webp")],
    alt: "بوكس الجامعة للعناية والمكياج",
    description: "مجموعة عناية ومكياج متكاملة تحتوي على كريم صنفرة إيفونا (Evona)، رول أون، طقم قص الأظافر (Jin Da)، توك شعر، وقلم تحديد — كل ما تحتاجينه ليومكِ الجامعي في بوكس واحد أنيق.",
    stock: 12, variants: [], badge: "Limited set", badgeAr: "بوكس محدود", featured: true,
  },
  {
    id: "care-makeup-box", name: "Care & Makeup Box", nameAr: "بوكس العناية والمكياج",
    category: "Sets", categoryAr: "مجموعات", price: 125, oldPrice: 160,
    image: img("products/lb-care-makeup-box.webp"), images: [img("products/lb-care-makeup-box.webp")],
    alt: "بوكس عناية ومكياج",
    description: "مجموعة عناية ومكياج تضم سكراب جسم بالشياباتر (Scrub)، ماسك العسل الملكي (Royal Jelly Mask)، بيوتي بلندر أرنب، وقلمي مكياج (Flormar / Make Up For Ever) — تجربة جمال كاملة بسعر مميز.",
    stock: 10, variants: [], badge: "Best value", badgeAr: "أفضل قيمة", featured: false,
  },
  {
    id: "strawberry-lip-set", name: "Strawberry Lip Set", nameAr: "عرض الفراولة — روج وتحديد",
    category: "Lips", categoryAr: "شفايف", price: 200, oldPrice: 250,
    image: img("products/lb-strawberry-lip-set.webp"), images: [img("products/lb-strawberry-lip-set.webp")],
    alt: "عرض روج وقلم تحديد شفاه",
    description: "عرض الفراولة: أحمر شفاه (روج) باللون الأحمر القاسي مع قلم تحديد شفاه من فلورمار (Flormar) وبرّاية — إطلالة شفاه مثالية بلمسة الفراولة.",
    stock: 10, variants: [{ label: "اللون", value: "أحمر كلاسيك — Classic Red" }],
    badge: "Limited offer", badgeAr: "عرض محدود", featured: true,
  },
  {
    id: "strawberry-body-mist", name: "The Body Shop Strawberry Mist", nameAr: "عرض الفراولة — معطر جسم",
    category: "Fragrance", categoryAr: "عطور", price: 200, oldPrice: 240,
    image: img("products/lb-strawberry-body-mist.webp"), images: [img("products/lb-strawberry-body-mist.webp")],
    alt: "معطر جسم برائحة الفراولة",
    description: "سبلاش ومعطر جسم برائحة الفراولة من ذا بادي شوب (The Body Shop Fragrance Mist — Strawberry) — انتعاش يدوم معكِ طوال اليوم.",
    stock: 10, variants: [{ label: "الحجم", value: "100ml" }],
    badge: "Limited offer", badgeAr: "عرض محدود", featured: false,
  },
  {
    id: "vaseline-hair-tonic", name: "Vaseline Hair Tonic Set", nameAr: "تونك وفازلين الشعر",
    category: "Body Care", categoryAr: "عناية بالجسم", price: 150,
    image: img("products/lb-vaseline-tonic.webp"), images: [img("products/lb-vaseline-tonic.webp"), img("products/lb-vaseline-tonic-blue.webp")],
    alt: "فازلين هير تونيك",
    description: "كريم وتونك الشعر بفازلين (Vaseline Hair Tonic) لتقوية الشعر وتغذيته من الجذور — متوفر بنسختي التونك الأزرق والتونك الداكن.",
    stock: 14, variants: [
      { label: "الحجم", value: "200ml" },
      { label: "النوع", value: "تونك أزرق — Blue" },
      { label: "النوع", value: "تونك داكن — Dark" },
    ],
    badge: "Best seller", badgeAr: "الأكثر طلبًا", featured: false,
  },
  {
    id: "avocado-cucumber-box", name: "Avocado & Cucumber Care Box", nameAr: "بوكس العناية بالأفوكادو والخيار",
    category: "Sets", categoryAr: "مجموعات", price: 180, oldPrice: 220,
    image: img("products/lb-avocado-box.webp"), images: [img("products/lb-avocado-box.webp")],
    alt: "بوكس العناية بالأفوكادو والخيار",
    description: "بوكس شامل يضم ماسك الأفوكادو (Avocado Mask)، سكراب الخيار من ستاركي (Starky Cucumber Scrub)، غسول إيفا بالزبادي والخيار (Eva Facial Wash Yogurt & Cucumber)، بيوتي بلندر، وتوك شعر — روتين عناية أخضر كامل.",
    stock: 9, variants: [], badge: "Limited set", badgeAr: "بوكس محدود", featured: false,
  },
  {
    id: "starky-eva-set", name: "Starky & Eva Cucumber Set", nameAr: "مجموعة ستاركي وإيفا",
    category: "Sets", categoryAr: "مجموعات", price: 130,
    image: img("products/lb-starky-eva-set.webp"), images: [img("products/lb-starky-eva-set.webp")],
    alt: "مجموعة ستاركي وإيفا بالخيار",
    description: "كريم مقشر الخيار من ستاركي (Starky Cucumber Scrub) مع غسول الوجه ومزيل المكياج بالزبادي والخيار من إيفا (Eva) — ثنائي تنظيف وترطيب بخلاصة الخيار الطبيعي.",
    stock: 12, variants: [], badge: "Best value", badgeAr: "أفضل قيمة", featured: false,
  },
  {
    id: "care-more-body-lotion", name: "Care & More Body Lotion", nameAr: "لوشن الجسم كير أند مور",
    category: "Body Care", categoryAr: "عناية بالجسم", price: 85,
    image: img("products/lb-care-more-lotion.webp"), images: [img("products/lb-care-more-lotion.webp"), img("products/lb-care-more-trio.webp")],
    alt: "لوشن الجسم كير أند مور",
    description: "مرطب لوشن للجسم من كير أند مور (Care & More) برائحة التوت المشكل (Mixed Berries) والفراولة (Strawberry) وجوز الهند (Coconut) والتروبيكال (Tropical) — ترطيب ناعم برائحتكِ المفضلة.",
    stock: 18, variants: [
      { label: "الرائحة", value: "توت مشكل — Mixed Berries" },
      { label: "الرائحة", value: "فراولة — Strawberry" },
      { label: "الرائحة", value: "جوز هند — Coconut" },
      { label: "الرائحة", value: "تروبيكال — Tropical" },
      { label: "الحجم", value: "200ml" },
    ],
    badge: "Under 90 EGP", badgeAr: "تحت 90 ج.م", featured: false,
  },
  {
    id: "stainless-star-necklaces", name: "Stainless Star Necklaces", nameAr: "سلاسل ستانلس ستيل بنجمة",
    category: "Sets", categoryAr: "مجموعات", price: 95, oldPrice: 130,
    image: img("products/lb-star-necklaces.webp"), images: [img("products/lb-star-necklaces.webp")],
    alt: "قلادات نسائية من الستانلس ستيل",
    description: "قلادات وسلاسل نسائية بأشكال نجمة مرصعة من الستانلس ستيل (Stainless Steel) — لا تتأكسد، متوفرة باللون الفضي والذهبي والروز جولد.",
    stock: 15, variants: [
      { label: "اللون", value: "فضي — Silver" },
      { label: "اللون", value: "ذهبي — Gold" },
      { label: "اللون", value: "روز جولد — Rose Gold" },
    ],
    badge: "Under 100 EGP", badgeAr: "تحت 100 ج.م", featured: false,
  },
];

export const seedCategories = [
  { slug: "makeup", name: "Makeup", nameAr: "مكياج", imageUrl: img("cat-makeup.webp"), sortOrder: 1 },
  { slug: "skincare", name: "Skincare", nameAr: "عناية بالبشرة", imageUrl: img("cat-skincare.webp"), sortOrder: 2 },
  { slug: "fragrance", name: "Fragrance", nameAr: "عطور", imageUrl: img("cat-fragrance.webp"), sortOrder: 3 },
  { slug: "body-care", name: "Body Care", nameAr: "عناية بالجسم", imageUrl: img("cat-bodycare.webp"), sortOrder: 4 },
  { slug: "lips", name: "Lips", nameAr: "شفايف", imageUrl: img("cat-lips.webp"), sortOrder: 5 },
  { slug: "sets", name: "Sets", nameAr: "مجموعات", imageUrl: img("cat-sets.webp"), sortOrder: 6 },
];

export const seedSlides: HeroSlide[] = [
  { id: "soft-ritual", eyebrow: "LUBNÉL / NEW COLLECTION", titleAr: "جمالكِ\nبطريقتكِ.", titleEn: "Beauty\nyour way.", bodyAr: "اكتشفي اختياراتنا الجديدة من المكياج والعناية والعطور، مصممة لتناسب طقسك اليومي.", bodyEn: "Discover a considered edit of makeup, skincare and fragrance, made for your everyday ritual.", ctaAr: "تسوّقي الآن", ctaEn: "Shop now", image: img("hero-1.webp"), active: true, sortOrder: 1 },
  { id: "skin-edit", eyebrow: "LUBNÉL / THE SKIN EDIT", titleAr: "بشرة\nتشعرين بها.", titleEn: "Skin\nthat feels like you.", bodyAr: "روتينات بسيطة، ملمس ناعم، واختيارات تناسب يومك الحقيقي.", bodyEn: "Simple routines, soft textures, and essentials for real everyday skin.", ctaAr: "اكتشفي العناية", ctaEn: "Discover skincare", image: img("hero-2.png"), active: true, sortOrder: 2 },
  { id: "soft-glow", eyebrow: "LUBNÉL / SOFT GLOW", titleAr: "ضوءكِ\nالخاص.", titleEn: "Your\nsoft glow.", bodyAr: "لمسات مختارة تمنحكِ إحساسًا أجمل، لا مظهرًا مختلفًا.", bodyEn: "Considered touches that make you feel more like yourself.", ctaAr: "شاهدي المختارات", ctaEn: "Explore the edit", image: img("hero-3.webp"), active: true, sortOrder: 3 },
];

export const seedCoupons = [
  { code: "LUBNEL10", label: "خصم ترحيبي 10٪", type: "percent" as const, value: 10, minSubtotal: 0, maxDiscount: 100 as number | null, usageLimit: 500 as number | null, endsInHours: 10 },
  { code: "GLOW20", label: "خصم 20٪ للطلبات فوق 500 ج.م", type: "percent" as const, value: 20, minSubtotal: 500, maxDiscount: 250 as number | null, usageLimit: 200 as number | null, endsInHours: 72 },
  { code: "WELCOME50", label: "خصم 50 ج.م للطلبات فوق 300", type: "fixed" as const, value: 50, minSubtotal: 300, maxDiscount: null, usageLimit: 30 as number | null, endsInHours: null },
];
