/**
 * U10-MIDNIGHT — restores the owner's window edits (Sep 17 13:28 → Sep 18 21:07 UTC)
 * that were destroyed by the platform snapshot restore, recovered from HER OWN
 * approved screenshots (upload/brave_*.png — the 4 screenshots she attached).
 *
 * Evidence (zoomed screenshot crops vs live DB):
 *  - «بوكس الجامعة» card in her الأكثر رواجًا + /c/all screenshots: ٤٠٠ ج.م,
 *    «✓ متوفر», badge «بوكس محدود», image = the «جمالك بطريقتك / NEW COLLECTION»
 *    dark editorial banner she uploaded (public/uploads/1789686259231-chrome_31drtKvDx0.jpg).
 *    Live DB after restore: 200 EGP + placeholder-editorial.svg.
 *  - Hero slide 1 (soft-ritual) in her homepage screenshot: the pink LUBNÉL
 *    skincare collage she generated Sep 18 10:19 PM
 *    (public/uploads/1789759566058-ChatGPT-Image-Sep-18--2026--10_19_24-PM.webp).
 *    Live DB after restore: /images/hero-1.webp (gold satin model).
 *
 * Everything else in her 4 screenshots was verified to ALREADY match the live DB
 * (offer rail strikes ٢٥٠/١٢٠/١١٥/١٠٥/١٨٥/٩٥, badges, categories, reviews,
 * newsletter, footer, catalog pills) — this script only patches the two real gaps.
 *
 * Idempotent: skips any row that already holds the target value (never fights
 * an owner who changed it again afterwards). Run: bun run scripts/restore-window-edits.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const UNIVERSITY_IMAGE = '/uploads/1789686259231-chrome_31drtKvDx0.jpg';
const HERO1_IMAGE = '/uploads/1789759566058-ChatGPT-Image-Sep-18--2026--10_19_24-PM.webp';

async function main() {
  // 1) university-box — owner repriced 200 → 400 and set her banner image.
  const uni = await db.product.findUnique({ where: { slug: 'university-box' } });
  if (!uni) {
    console.log('university-box: NOT FOUND (skipped)');
  } else {
    const data: { price?: number; image?: string } = {};
    if (uni.price !== 400) data.price = 400;
    if (uni.image !== UNIVERSITY_IMAGE) data.image = UNIVERSITY_IMAGE;
    if (Object.keys(data).length) {
      await db.product.update({ where: { slug: 'university-box' }, data });
      console.log(`university-box: applied ${JSON.stringify(data)}`);
    } else {
      console.log('university-box: already at owner-approved values (kept)');
    }
  }

  // 2) hero slide 1 (soft-ritual) — owner's ChatGPT collage banner.
  const slide = await db.heroSlide.findUnique({ where: { id: 'soft-ritual' } });
  if (!slide) {
    console.log('soft-ritual slide: NOT FOUND (skipped)');
  } else if (slide.image !== HERO1_IMAGE) {
    await db.heroSlide.update({ where: { id: 'soft-ritual' }, data: { image: HERO1_IMAGE } });
    console.log(`soft-ritual: image '${slide.image}' -> ${HERO1_IMAGE}`);
  } else {
    console.log('soft-ritual: already at owner-approved image (kept)');
  }
}

main().finally(() => process.exit(0));
