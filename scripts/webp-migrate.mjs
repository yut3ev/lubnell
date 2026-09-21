// R21-A — WebP conversion pass + DB reference migration + verification
// Usage: node scripts/webp-migrate.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const ROOT = "/home/z/my-project";
const IMG_DIR = path.join(ROOT, "public/images");
const db = new PrismaClient();

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

async function convert() {
  const files = walk(IMG_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  const report = [];
  for (const src of files) {
    const out = src.replace(/\.(png|jpe?g)$/i, ".webp");
    if (fs.existsSync(out)) {
      report.push({ src: path.relative(IMG_DIR, src), out: path.relative(IMG_DIR, out), before: fs.statSync(src).size, after: fs.statSync(out).size, skipped: true });
      continue;
    }
    const q = /\.png$/i.test(src) ? 82 : 80;
    const info = await sharp(src).webp({ quality: q, effort: 4 }).toFile(out);
    report.push({ src: path.relative(IMG_DIR, src), out: path.relative(IMG_DIR, out), before: fs.statSync(src).size, after: info.size, skipped: false });
  }
  return report;
}

// Replace ONLY when the .webp target exists on disk.
function mapToWebp(ref) {
  const cleaned = ref.replace(/\.(png|jpe?g)$/i, ".webp");
  const abs = path.join(ROOT, "public", cleaned.startsWith("/") ? cleaned : cleaned);
  return fs.existsSync(abs) ? cleaned : null;
}

async function migrateDb() {
  let slides = 0, cats = 0, prods = 0;
  const heroSlides = await db.heroSlide.findMany();
  for (const s of heroSlides) {
    const nw = mapToWebp(s.image);
    if (nw && nw !== s.image) { await db.heroSlide.update({ where: { id: s.id }, data: { image: nw } }); slides++; }
  }
  const catsRows = await db.storeCategory.findMany();
  for (const c of catsRows) {
    const nw = mapToWebp(c.imageUrl);
    if (nw && nw !== c.imageUrl) { await db.storeCategory.update({ where: { id: c.id }, data: { imageUrl: nw } }); cats++; }
  }
  const prodsRows = await db.storeProduct.findMany({ select: { id: true, images: true } });
  for (const p of prodsRows) {
    let arr;
    try { arr = JSON.parse(p.images); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    const mapped = arr.map((u) => mapToWebp(u) || u);
    if (JSON.stringify(mapped) !== JSON.stringify(arr)) {
      await db.storeProduct.update({ where: { id: p.id }, data: { images: JSON.stringify(mapped) } });
      prods++;
    }
  }
  return { slides, cats, prods };
}

async function verify() {
  const missing = [];
  const slides = await db.heroSlide.findMany({ select: { image: true } });
  const cats = await db.storeCategory.findMany({ select: { imageUrl: true } });
  const prods = await db.storeProduct.findMany({ select: { images: true } });
  const refs = [...slides.map((s) => s.image), ...cats.map((c) => c.imageUrl),
    ...prods.flatMap((p) => { try { return JSON.parse(p.images); } catch { return []; } })];
  for (const r of refs) {
    const abs = path.join(ROOT, "public", r);
    if (!fs.existsSync(abs)) missing.push(r);
  }
  return { refs: refs.length, missing };
}

(async () => {
  const rep = await convert();
  const conv = rep.filter((r) => !r.skipped);
  const before = conv.reduce((a, r) => a + r.before, 0);
  const after = conv.reduce((a, r) => a + r.after, 0);
  console.log(`converted ${conv.length} files, skipped ${rep.length - conv.length} (already webp)`);
  for (const r of rep) console.log(`  ${r.src}  ${(r.before / 1024).toFixed(0)}KB -> ${(r.after / 1024).toFixed(0)}KB${r.skipped ? "  (skipped)" : ""}`);
  console.log(`total: ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB  (${(100 - (after / before) * 100).toFixed(1)}% saved)`);
  const dbRes = await migrateDb();
  console.log(`db migrated: ${dbRes.slides} slides, ${dbRes.cats} categories, ${dbRes.prods} products`);
  const v = await verify();
  console.log(`verify: ${v.refs} DB image refs, missing files: ${v.missing.length}${v.missing.length ? " -> " + v.missing.join(", ") : ""}`);
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
