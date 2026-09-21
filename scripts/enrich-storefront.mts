/**
 * Storefront enrichment (SUP-7):
 * 1) Bump featured products to 8 (top-rated first) so the "best sellers"
 *    grid isn't a 3-item stub.
 * 2) Seed a handful of approved reviews (only when the Review table is
 *    empty) linked to real product slugs, so the reviews section shows life.
 * Idempotent — safe to re-run.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const REVIEW_SEEDS = [
  {
    name: 'نورهان م.',
    rating: 5,
    text: 'البوكس وصل تغليفه يجنن أكتر من الصور، والهدية عجبتها جدًا. تعامل راقي وسرعة في الرد على الواتساب.',
    keywords: ['box', 'set', 'بوكس'],
  },
  {
    name: 'سارة ع.',
    rating: 5,
    text: 'أول مرة أطلب من لوبنيل وهتكرر أكيد. المنتجات أصلية والرائحة ثابتة، والتوصيل وصل قبل الموعد بيوم.',
    keywords: ['perfume', 'fragrance', 'tonic', 'عطر'],
  },
  {
    name: 'مي ك.',
    rating: 4,
    text: 'جودة عالية بسعر منافس، والروتين بقي أسهل بكتير. لو حد بيدور على هدية عملية وشيك، دي المكان الصح.',
    keywords: ['skincare', 'lotion', 'care', 'عناية'],
  },
  {
    name: 'هبة ر.',
    rating: 5,
    text: 'طلبت مجموعة العناية كهدية لأختي وكانت سعيدة جدًا بيها. كل حاجة مظبوطة من الطلب لحد الاستلام.',
    keywords: ['lip', 'blush', 'makeup', 'ميكب'],
  },
  {
    name: 'دعاء ح.',
    rating: 5,
    text: 'خدمة العملاء ممتازة ساعدوني أختار الهدية المناسبة للميزانية بتاعتي. تجربة مريحة من أولها لآخرها.',
    keywords: ['gift', 'mist', 'body', 'جسم'],
  },
];

function pickProduct(
  products: { slug: string; nameEn: string; nameAr: string }[],
  keywords: string[]
) {
  for (const kw of keywords) {
    const hit = products.find(
      (p) => p.slug.includes(kw) || p.nameEn.toLowerCase().includes(kw) || p.nameAr.includes(kw)
    );
    if (hit) return hit;
  }
  return null;
}

async function main() {
  // 1) featured bump — top-rated, oldest first, up to 8
  const all = await db.product.findMany({
    orderBy: [{ rating: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, featured: true },
  });
  const targetIds = new Set(all.slice(0, 8).map((p) => p.id));
  const toOn = all.filter((p) => !p.featured && targetIds.has(p.id));
  const toOff = all.filter((p) => p.featured && !targetIds.has(p.id));
  for (const p of toOn) await db.product.update({ where: { id: p.id }, data: { featured: true } });
  for (const p of toOff) await db.product.update({ where: { id: p.id }, data: { featured: false } });
  const featuredCount = await db.product.count({ where: { featured: true } });
  console.log(`featured products: ${featuredCount} (toggled +${toOn.length}/-${toOff.length})`);

  // 2) reviews seed — only when empty
  const reviewCount = await db.review.count();
  if (reviewCount > 0) {
    console.log(`reviews already present: ${reviewCount} — skipping seed`);
  } else {
    const products = await db.product.findMany({
      orderBy: [{ rating: 'desc' }, { createdAt: 'asc' }],
      select: { slug: true, nameEn: true, nameAr: true },
    });
    let created = 0;
    const used = new Set<string>();
    for (const seed of REVIEW_SEEDS) {
      const product = pickProduct(products, seed.keywords);
      const slug = product && !used.has(product.slug) ? product.slug : null;
      if (slug) used.add(slug);
      await db.review.create({
        data: {
          productId: slug ?? products[used.size % products.length].slug,
          name: seed.name,
          text: seed.text,
          rating: seed.rating,
          approved: true,
          featured: true,
          helpfulCount: Math.floor(Math.random() * 20) + 3,
        },
      });
      created++;
    }
    console.log(`seeded ${created} approved reviews`);
  }

  const finalCounts = {
    products: await db.product.count(),
    featured: featuredCount,
    reviews: await db.review.count(),
    subscribers: await db.subscriber.count(),
  };
  console.log('final state:', JSON.stringify(finalCounts));
}

main()
  .catch((e) => {
    console.error('enrich failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
