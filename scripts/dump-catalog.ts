import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const products = await db.storeProduct.findMany({ orderBy: { id: "asc" } });
for (const p of products) {
  const imgs = JSON.parse(p.images || "[]") as string[];
  console.log(`${p.slug} | ${p.nameAr} | ${p.category} | ${p.price}EGP (old:${p.oldPrice}) | stock:${p.stock} | ${p.visible ? "منشور" : "مخفي"} | ${imgs.join(",")}`);
}
console.log("─── categories:");
for (const c of await db.storeCategory.findMany()) console.log(`${c.slug} | ${c.nameAr} | ${c.imageUrl}`);
console.log("─── slides:");
for (const s of await db.heroSlide.findMany()) console.log(`${s.id} | ${s.titleAr} | ${s.image}`);
await db.$disconnect();
