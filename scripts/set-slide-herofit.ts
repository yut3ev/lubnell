/**
 * U10-HEROMOBILE — attach the dedicated portrait banner to the artwork slide.
 *
 * The owner wants the COMPLETE banner composition on phones (products + brand
 * text). A 2.9:1 landscape can't survive a phone crop (cover slices it,
 * contain letterboxes it — both rejected). public/uploads/
 * soft-ritual-mobile.jpg is a PIL recomposition of the SAME design: the
 * products block on top, the LUBNÉL text block below, blended on a sampled
 * beige gradient (1200x1170 ≈ the 390x380 mobile band → zero visible crop).
 *
 * The slider renders slide.mobileImage below sm for artwork slides
 * (showText=false) and keeps slide.image from sm up.
 *
 * Idempotent: safe to re-run.
 *   bun scripts/set-slide-herofit.ts [id] [mobileImagePath] [mobileHeight]
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const id = process.argv[2] || 'soft-ritual';
const mobileImage = process.argv[3] || '/uploads/soft-ritual-mobile.jpg';
const mobileHeight = Number(process.argv[4]) || 380;

await db.heroSlide.updateMany({ where: { id }, data: { mobileImage, mobileHeight } });

const rows = await db.heroSlide.findMany({ orderBy: { sortOrder: 'asc' } });
for (const s of rows) {
  console.log(
    JSON.stringify({
      id: s.id,
      showText: s.showText,
      mobilePos: s.mobilePos,
      mobileHeight: s.mobileHeight,
      mobileImage: s.mobileImage,
      image: s.image,
    }),
  );
}
await db.$disconnect();
