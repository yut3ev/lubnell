// U10-TEXT — one-off: repair literal "\n" (backslash + n) stored inside
// HeroSlide text columns — convert to a real newline. Also SCAN other text
// surfaces (report only — no auto-write) for the same escape sequence.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TEXT_FIELDS = [
  "eyebrow",
  "titleAr",
  "titleEn",
  "bodyAr",
  "bodyEn",
  "ctaAr",
  "ctaEn",
] as const;

let fixedRows = 0;
const slides = await db.heroSlide.findMany();
for (const s of slides) {
  const data: Record<string, string> = {};
  for (const k of TEXT_FIELDS) {
    const v = (s as unknown as Record<string, unknown>)[k];
    if (typeof v === "string" && /\\n/.test(v)) {
      data[k] = v.replace(/\\n/g, "\n");
    }
  }
  if (Object.keys(data).length) {
    await db.heroSlide.update({ where: { id: s.id }, data });
    fixedRows += 1;
    console.log(`fixed slide ${s.id}:`, Object.keys(data).join(","));
  }
}
console.log(`hero slides repaired: ${fixedRows}/${slides.length}`);

// ---- scan-only: other surfaces that could carry the same literal ----
const scan = (label: string, rows: unknown[], pick: (r: never) => Record<string, unknown>) => {
  if (!Array.isArray(rows)) return [];
  const hits: string[] = [];
  for (const row of rows) {
    const fields = pick(row as never);
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === "string" && /\\n/.test(v)) hits.push(`${label}/${(fields as { id?: string }).id}.${k}`);
    }
  }
  return hits;
};

const [products, categories, settings] = await Promise.all([
  db.product.findMany(),
  db.category.findMany(),
  db.storeSettings.findMany().catch(() => []),
]);

const otherHits = [
  ...scan("product", products, (r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, descAr: r.descAr, descEn: r.descEn })),
  ...scan("category", categories, (r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn })),
  ...scan("setting", settings, (r) => ({ id: r.id, value: r.value })),
];
console.log(otherHits.length ? `OTHER literal-\\n hits (NOT auto-fixed): ${otherHits.join(" | ")}` : "other surfaces: clean");

await db.$disconnect();
