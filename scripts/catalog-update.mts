// LUBNÉL catalog rebuild (user's real inventory):
// 1. DELETE the 10 placeholder/invented products
// 2. UPDATE the 9 real products: user descriptions, stock quantities, size/color variants, new branded images, published
// 3. Delete orphaned product image files no longer referenced
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const db = new PrismaClient();
const PDIR = path.join(process.cwd(), "public", "images", "products");
const img = (f: string) => `/images/products/${f}`;

const REMOVE = [
  "boscarest-purity-musk-wash",
  "yardbeauty-liquid-blush",
  "sheglam-clear-away-remover",
  "bom-watermelon-body-butter",
  "disaar-vitamin-c-eye-gel",
  "soap-glory-scrub-glove",
  "essence-face-body-lotion",
  "bodylicious-roll-on",
  "noor-lash-brow-oil",
  "indulekha-bringha-hair-oil",
];

type Upd = {
  slug: string;
  name: string;
  nameAr: string;
  category: string;
  categoryAr: string;
  price: number;
  oldPrice: number | null;
  description: string;
  images: string[];
  stock: number;
  variants: { label: string; value: string }[];
  badge: string | null;
  badgeAr: string | null;
  featured: boolean;
};

const UPDATE: Upd[] = [
  {
    slug: "university-box", name: "University Beauty Box", nameAr: "بوكس الجامعة",
    category: "Sets", categoryAr: "مجموعات", price: 200, oldPrice: 260,
    description: "مجموعة عناية ومكياج متكاملة تحتوي على كريم صنفرة إيفونا (Evona)، رول أون، طقم قص الأظافر (Jin Da)، توك شعر، وقلم تحديد — كل ما تحتاجينه ليومكِ الجامعي في بوكس واحد أنيق.",
    images: [img("lb-university-box.jpg")], stock: 12, variants: [],
    badge: "Limited set", badgeAr: "بوكس محدود", featured: true,
  },
  {
    slug: "care-makeup-box", name: "Care & Makeup Box", nameAr: "بوكس العناية والمكياج",
    category: "Sets", categoryAr: "مجموعات", price: 125, oldPrice: 160,
    description: "مجموعة عناية ومكياج تضم سكراب جسم بالشياباتر (Scrub)، ماسك العسل الملكي (Royal Jelly Mask)، بيوتي بلندر أرنب، وقلمي مكياج (Flormar / Make Up For Ever) — تجربة جمال كاملة بسعر مميز.",
    images: [img("lb-care-makeup-box.jpg")], stock: 10, variants: [],
    badge: "Best value", badgeAr: "أفضل قيمة", featured: false,
  },
  {
    slug: "strawberry-lip-set", name: "Strawberry Lip Set", nameAr: "عرض الفراولة — روج وتحديد",
    category: "Lips", categoryAr: "شفايف", price: 200, oldPrice: 250,
    description: "عرض الفراولة: أحمر شفاه (روج) باللون الأحمر القاسي مع قلم تحديد شفاه من فلورمار (Flormar) وبرّاية — إطلالة شفاه مثالية بلمسة الفراولة.",
    images: [img("lb-strawberry-lip-set.jpg")], stock: 10,
    variants: [{ label: "اللون", value: "أحمر كلاسيك — Classic Red" }],
    badge: "Limited offer", badgeAr: "عرض محدود", featured: true,
  },
  {
    slug: "strawberry-body-mist", name: "The Body Shop Strawberry Mist", nameAr: "عرض الفراولة — معطر جسم",
    category: "Fragrance", categoryAr: "عطور", price: 200, oldPrice: 240,
    description: "سبلاش ومعطر جسم برائحة الفراولة من ذا بادي شوب (The Body Shop Fragrance Mist — Strawberry) — انتعاش يدوم معكِ طوال اليوم.",
    images: [img("lb-strawberry-body-mist.jpg")], stock: 10,
    variants: [{ label: "الحجم", value: "100ml" }],
    badge: "Limited offer", badgeAr: "عرض محدود", featured: false,
  },
  {
    slug: "vaseline-hair-tonic", name: "Vaseline Hair Tonic Set", nameAr: "تونك وفازلين الشعر",
    category: "Body Care", categoryAr: "عناية بالجسم", price: 150, oldPrice: null,
    description: "كريم وتونك الشعر بفازلين (Vaseline Hair Tonic) لتقوية الشعر وتغذيته من الجذور — متوفر بنسختي التونك الأزرق والتونك الداكن.",
    images: [img("lb-vaseline-tonic.jpg"), img("lb-vaseline-tonic-blue.jpg")], stock: 14,
    variants: [
      { label: "الحجم", value: "200ml" },
      { label: "النوع", value: "تونك أزرق — Blue" },
      { label: "النوع", value: "تونك داكن — Dark" },
    ],
    badge: "Best seller", badgeAr: "الأكثر طلبًا", featured: false,
  },
  {
    slug: "avocado-cucumber-box", name: "Avocado & Cucumber Care Box", nameAr: "بوكس العناية بالأفوكادو والخيار",
    category: "Sets", categoryAr: "مجموعات", price: 180, oldPrice: 220,
    description: "بوكس شامل يضم ماسك الأفوكادو (Avocado Mask)، سكراب الخيار من ستاركي (Starky Cucumber Scrub)، غسول إيفا بالزبادي والخيار (Eva Facial Wash Yogurt & Cucumber)، بيوتي بلندر، وتوك شعر — روتين عناية أخضر كامل.",
    images: [img("lb-avocado-box.jpg")], stock: 9, variants: [],
    badge: "Limited set", badgeAr: "بوكس محدود", featured: false,
  },
  {
    slug: "starky-eva-set", name: "Starky & Eva Cucumber Set", nameAr: "مجموعة ستاركي وإيفا",
    category: "Sets", categoryAr: "مجموعات", price: 130, oldPrice: null,
    description: "كريم مقشر الخيار من ستاركي (Starky Cucumber Scrub) مع غسول الوجه ومزيل المكياج بالزبادي والخيار من إيفا (Eva) — ثنائي تنظيف وترطيب بخلاصة الخيار الطبيعي.",
    images: [img("lb-starky-eva-set.jpg")], stock: 12, variants: [],
    badge: "Best value", badgeAr: "أفضل قيمة", featured: false,
  },
  {
    slug: "care-more-body-lotion", name: "Care & More Body Lotion", nameAr: "لوشن الجسم كير أند مور",
    category: "Body Care", categoryAr: "عناية بالجسم", price: 85, oldPrice: null,
    description: "مرطب لوشن للجسم من كير أند مور (Care & More) برائحة التوت المشكل (Mixed Berries) والفراولة (Strawberry) وجوز الهند (Coconut) والتروبيكال (Tropical) — ترطيب ناعم برائحتكِ المفضلة.",
    images: [img("lb-care-more-lotion.jpg"), img("lb-care-more-trio.jpg")], stock: 18,
    variants: [
      { label: "الرائحة", value: "توت مشكل — Mixed Berries" },
      { label: "الرائحة", value: "فراولة — Strawberry" },
      { label: "الرائحة", value: "جوز هند — Coconut" },
      { label: "الرائحة", value: "تروبيكال — Tropical" },
      { label: "الحجم", value: "200ml" },
    ],
    badge: "Under 90 EGP", badgeAr: "تحت 90 ج.م", featured: false,
  },
  {
    slug: "stainless-star-necklaces", name: "Stainless Star Necklaces", nameAr: "سلاسل ستانلس ستيل بنجمة",
    category: "Sets", categoryAr: "مجموعات", price: 95, oldPrice: 130,
    description: "قلادات وسلاسل نسائية بأشكال نجمة مرصعة من الستانلس ستيل (Stainless Steel) — لا تتأكسد، متوفرة باللون الفضي والذهبي والروز جولد.",
    images: [img("lb-star-necklaces.jpg")], stock: 15,
    variants: [
      { label: "اللون", value: "فضي — Silver" },
      { label: "اللون", value: "ذهبي — Gold" },
      { label: "اللون", value: "روز جولد — Rose Gold" },
    ],
    badge: "Under 100 EGP", badgeAr: "تحت 100 ج.م", featured: false,
  },
];

async function main() {
  // 1. remove invented products
  for (const slug of REMOVE) {
    const gone = await db.storeProduct.deleteMany({ where: { slug } });
    console.log(gone.count ? `🗑 deleted ${slug}` : `· ${slug} (not found)`);
  }

  // 2. update real products
  for (const p of UPDATE) {
    const data = {
      name: p.name, nameAr: p.nameAr, category: p.category, categoryAr: p.categoryAr,
      price: p.price, oldPrice: p.oldPrice, description: p.description,
      images: JSON.stringify(p.images), variants: JSON.stringify(p.variants),
      stock: p.stock, visible: true, featured: p.featured,
      badge: p.badge, badgeAr: p.badgeAr,
      seo: JSON.stringify({ title: p.name, description: p.description, slug: p.slug }),
    };
    const row = await db.storeProduct.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });
    console.log(`✓ ${p.slug} — ${p.price} EGP, stock ${p.stock}, ${p.variants.length} variants, ${row.visible ? "published" : "hidden"}`);
  }

  // 3. cleanup orphaned product images
  const referenced = new Set<string>();
  const rows = await db.storeProduct.findMany({ select: { images: true } });
  for (const r of rows) { try { for (const u of JSON.parse(r.images || "[]")) referenced.add(String(u).replace("/images/products/", "")); } catch { /* ignore */ } }
  let removed = 0;
  for (const f of fs.readdirSync(PDIR)) {
    if (!referenced.has(f)) { fs.unlinkSync(path.join(PDIR, f)); removed++; }
  }
  console.log(`\nkept ${referenced.size} referenced files, removed ${removed} orphaned files`);
  const total = await db.storeProduct.count();
  console.log(`catalog now: ${total} products (all real inventory)`);
}

main().finally(() => db.$disconnect());
