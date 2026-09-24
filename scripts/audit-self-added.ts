// Round 12-A: audit self-added products before deletion (user request:
// "شيل المنتجات ايل انت ضايفها من نفسها ومطلبتش منك تضيفها")
// Cross-references StoreProduct rows with AuditLog entries (metadata.via = ai-assistant)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const products = await db.storeProduct.findMany({
    select: { id: true, slug: true, name: true, nameAr: true, category: true, price: true, visible: true, stock: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  console.log(`=== ALL PRODUCTS (${products.length}) ===`);
  for (const p of products) {
    console.log(`#${p.id} | ${p.slug} | ${p.nameAr} | ${p.category} | ${p.price}EGP | stock ${p.stock} | ${p.visible ? "VISIBLE" : "hidden"} | ${p.createdAt.toISOString().slice(0, 16)}`);
  }

  const audits = await db.auditLog.findMany({
    where: { action: { contains: "product" } },
    orderBy: { id: "asc" },
    select: { id: true, action: true, actorUsername: true, metadata: true, createdAt: true },
  });
  console.log(`\n=== PRODUCT AUDIT ENTRIES (${audits.length}) ===`);
  for (const a of audits) {
    let via = "?";
    let target = "";
    try {
      const m = JSON.parse(a.metadata || "{}");
      via = m.via || m.source || "manual";
      target = m.slug || m.name || m.nameAr || m.productSlug || JSON.stringify(m).slice(0, 90);
    } catch { via = "unparsable"; }
    console.log(`#${a.id} | ${a.action} | via=${via} | ${target} | ${a.createdAt.toISOString().slice(0, 16)}`);
  }
}
main().finally(() => db.$disconnect());
