import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const products = await db.storeProduct.findMany({ orderBy: { id: "asc" }, select: { slug: true, variants: true, description: true } });
for (const p of products) console.log(`${p.slug} | variants: ${p.variants}`);
await db.$disconnect();
