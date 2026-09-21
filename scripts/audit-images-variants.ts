// Round 12-B: inventory of images + variants across the live catalog
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const products = await db.storeProduct.findMany({
    select: { id: true, slug: true, nameAr: true, images: true, variants: true, description: true, badgeAr: true, featured: true },
    orderBy: { id: "asc" },
  });
  for (const p of products) {
    let images: string[] = [];
    try { images = JSON.parse(p.images || "[]"); } catch {}
    let variants: unknown = [];
    try { variants = JSON.parse(p.variants || "[]"); } catch {}
    const exists = images.map(src => {
      try { require("fs").accessSync("/home/z/my-project/public" + src); return `${src}(ok)`; } catch { return `${src}(MISSING)`; }
    });
    console.log(`#${p.id} ${p.slug}`);
    console.log(`   images: [${exists.join(", ")}]`);
    console.log(`   variants: ${JSON.stringify(variants).slice(0, 120)}`);
    console.log(`   desc: ${(p.description || "").slice(0, 60)} | badge: ${p.badgeAr || "-"} | featured: ${p.featured}`);
  }
  const media = await db.mediaAsset.count();
  console.log(`\nmedia library rows: ${media}`);
}
main().finally(() => db.$disconnect());
