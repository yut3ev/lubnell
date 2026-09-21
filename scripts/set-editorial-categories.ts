// U24-CATS-EDITORIAL — one-time data migration:
// 1) backs up the current category images to scripts/backup-category-images.json
// 2) assigns the AI-generated editorial photograph per category (public/categories/{slug}.png)
// 3) reorders categories to the owner's enumerated merchandising order:
//    عناية بالبشرة → مكياج → عطور → هدايا(مجموعات) → عناية بالجسم → عيون → شفايف
// Run: bun scripts/set-editorial-categories.ts
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const db = new PrismaClient();

const EDITORIAL: Record<string, string> = {
  skincare: "/categories/skincare.png",
  makeup: "/categories/makeup.png",
  fragrance: "/categories/fragrance.png",
  sets: "/categories/sets.png",
  "body-care": "/categories/body-care.png",
  eyes: "/categories/eyes.png",
  lips: "/categories/lips.png",
};

// owner's order (her message lists: عناية بالبشرة، مكياج، عطور، هدايا)
const ORDER = ["skincare", "makeup", "fragrance", "sets", "body-care", "eyes", "lips"];

async function main() {
  const cats = await db.category.findMany({ orderBy: { sortOrder: "asc" } });

  // 1) backup (only what's changing)
  const backup = {
    savedAt: new Date().toISOString(),
    note: "pre-U24-CATS-EDITORIAL images + sortOrder",
    rows: cats.map((c) => ({ slug: c.slug, image: c.image, sortOrder: c.sortOrder })),
  };
  fs.writeFileSync("scripts/backup-category-images.json", JSON.stringify(backup, null, 2));

  // 2) editorial images
  for (const c of cats) {
    const img = EDITORIAL[c.slug];
    if (!img) continue;
    await db.category.update({ where: { id: c.id }, data: { image: img } });
  }

  // 3) merchandising order
  for (let i = 0; i < ORDER.length; i++) {
    const slug = ORDER[i]!;
    const cat = cats.find((c) => c.slug === slug);
    if (cat) await db.category.update({ where: { id: cat.id }, data: { sortOrder: i + 1 } });
  }

  const after = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  console.log(after.map((c) => `${c.sortOrder}. ${c.slug} → ${c.image}`).join("\n"));

  // 4) switch the home categories section to the editorial template
  const row = await db.storeSettings.findFirst({ where: { key: "home_sections" } });
  if (row) {
    const cfg = JSON.parse(row.value) as Record<string, { template?: string }>;
    if (cfg.categories) cfg.categories.template = "editorial";
    await db.storeSettings.update({ where: { id: row.id }, data: { value: JSON.stringify(cfg) } });
    console.log("home_sections.categories.template → editorial");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
