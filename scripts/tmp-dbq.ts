import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const cats = await db.category.findMany({ select: { slug: true, nameAr: true, image: true, sortOrder: true } });
  console.log('CATEGORIES:', JSON.stringify(cats));
  const slides = await db.heroSlide.findMany({ select: { id: true, titleAr: true, image: true, active: true, sortOrder: true } });
  console.log('SLIDES:', JSON.stringify(slides));
  const coupons = await db.coupon.findMany();
  console.log('COUPONS:', JSON.stringify(coupons));
}
main().finally(() => db.$disconnect());
