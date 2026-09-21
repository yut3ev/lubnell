// Apply the Round-11 catalog refresh to the live DB:
// new image galleries, variant fixes, honest badges, all products visible.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const P = (f: string) => `/images/products/${f}`;

const UPDATES: Record<string, { images: string[]; variants?: { label: string; value: string }[]; badge?: string; badgeAr?: string }> = {
  "boscarest-purity-musk-wash": { images: [P("boscarest-musk-wash-main.jpg"), P("boscarest-musk-wash-silk.jpg")], variants: [{ label: "الحجم", value: "125ml" }] },
  "yardbeauty-liquid-blush": { images: [P("gen-liquid-blush.jpg")] },
  "sheglam-clear-away-remover": { images: [P("sheglam-remover-main.jpg"), P("sheglam-remover-howto.jpg")] },
  "bom-watermelon-body-butter": { images: [P("gen-body-butter.jpg")] },
  "disaar-vitamin-c-eye-gel": { images: [P("gen-eye-gel.jpg")] },
  "soap-glory-scrub-glove": { images: [P("scrub-glove-main.jpg"), P("collage-gloves.jpg")] },
  "essence-face-body-lotion": { images: [P("gen-essence-lotion.jpg")] },
  "bodylicious-roll-on": { images: [P("gen-roll-on.jpg")] },
  "noor-lash-brow-oil": { images: [P("gen-lash-oil.jpg")] },
  "indulekha-bringha-hair-oil": { images: [P("gen-hair-oil.jpg")] },
  "university-box": { images: [P("gen-university-box.jpg")] },
  "care-makeup-box": { images: [P("gen-care-makeup-box.jpg")] },
  "strawberry-lip-set": { images: [P("gen-strawberry-lip-set.jpg")] },
  "strawberry-body-mist": { images: [P("gen-body-mist.jpg")] },
  "vaseline-hair-tonic": { images: [P("vaseline-hair-tonic-main.jpg"), P("vaseline-hair-tonic-blue.jpg"), P("vaseline-hair-tonic-dark.jpg"), P("collage-vaseline.jpg")], badge: "Best seller", badgeAr: "الأكثر طلبًا" },
  "avocado-cucumber-box": { images: [P("gen-avocado-box.jpg"), P("starky-cucumber-scrub.jpg"), P("collage-starky.jpg")], badge: "Limited set", badgeAr: "بوكس محدود" },
  "starky-eva-set": { images: [P("starky-cucumber-scrub.jpg"), P("gen-starky-eva-set.jpg"), P("collage-starky.jpg")], badge: "Best value", badgeAr: "أفضل قيمة" },
  "care-more-body-lotion": { images: [P("care-more-lotion-lifestyle.jpg"), P("care-more-lotion-trio.jpg"), P("collage-care-more.jpg")], variants: [{ label: "الرائحة", value: "Mixed Berries" }, { label: "الرائحة", value: "Strawberry" }, { label: "الرائحة", value: "Coconut" }, { label: "الرائحة", value: "Tropical" }, { label: "الحجم", value: "200ml" }], badge: "Under 90 EGP", badgeAr: "تحت 90 ج.م" },
  "stainless-star-necklaces": { images: [P("gen-star-necklaces.jpg")] },
};

const ALLOWED = new Set(Object.keys(UPDATES));

let updated = 0;
for (const [slug, patch] of Object.entries(UPDATES)) {
  const data: Record<string, unknown> = { images: JSON.stringify(patch.images), visible: true };
  if (patch.variants) data.variants = JSON.stringify(patch.variants);
  if (patch.badge !== undefined) { data.badge = patch.badge; data.badgeAr = patch.badgeAr; }
  const res = await db.storeProduct.updateMany({ where: { slug }, data });
  updated += res.count;
  console.log(`${res.count ? "✓" : "✗"} ${slug}`);
}

// Safety: anything not in the user's approved list gets hidden (user asked to
// remove products that were added without request). Currently the set matches,
// so this should report 0.
const removed = await db.storeProduct.updateMany({ where: { slug: { notIn: [...ALLOWED] } }, data: { visible: false } });
console.log(`hidden (outside approved list): ${removed.count}`);

// Every product published & priced
const pending = await db.storeProduct.count({ where: { OR: [{ visible: false }, { price: { lte: 0 } }] } });
console.log(`updated: ${updated} · still hidden/unpriced: ${pending}`);
await db.$disconnect();
