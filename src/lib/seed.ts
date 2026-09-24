// Idempotent seed — safe to call on every boot/request
// SUP-6: scoped to models that exist in the current schema (HeroSlide,
// StoreSettings). The catalog itself (Product/Category/Coupon) is managed
// live by the admin panel and seeded via scripts/apply-catalog.ts.
import { db } from "@/lib/db";
import { seedSlides } from "@/lib/seed-data";
import { WHATSAPP_NUMBER, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/lubnel-types";

let seeding: Promise<void> | null = null;

async function doSeed() {
  // Hero slides (keyed by string id)
  for (const s of seedSlides) {
    await db.heroSlide.upsert({ where: { id: s.id }, create: s, update: {} });
  }

  // Store settings defaults (merged, never overwrites admin edits)
  const settings = {
    whatsappNumber: WHATSAPP_NUMBER,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    shippingFee: SHIPPING_FEE,
    announcementAr: "شحن مجاني للطلبات فوق 900 ج.م · توصيل لكل مصر",
    announcementEn: "Complimentary delivery over 900 EGP · Nationwide shipping",
    storeName: "LUBNÉL",
    domain: "lubnel.com",
  };
  await db.storeSettings.upsert({
    where: { key: "store" },
    create: { key: "store", value: JSON.stringify(settings) },
    update: {},
  });
}

export async function ensureSeed() {
  if (!seeding) {
    seeding = doSeed().catch(err => {
      seeding = null;
      throw err;
    });
  }
  return seeding;
}
