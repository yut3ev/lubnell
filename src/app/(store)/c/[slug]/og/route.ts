import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreCategory } from "@prisma/client";
import { findShareCategory } from "@/lib/share-helpers";

// R26 — on-demand branded OG card per category: /c/[slug]/og
// 1200×630 JPEG: category art + bottom ink scrim + top scrim + brand eyebrow +
// bilingual category name + live product-count chip. Disk-cached in .og-cache
// with a signature derived from updatedAt+count so catalog edits invalidate it.

export const dynamic = "force-dynamic";

const W = 1200, H = 630;
const CACHE_DIR = path.join(process.cwd(), ".og-cache");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrapName(name: string): string[] {
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 26 && cur) {
      lines.push(cur.trim());
      cur = w;
      if (lines.length === 2) break;
    } else {
      cur = `${cur} ${w}`;
    }
  }
  if (lines.length < 2 && cur.trim()) lines.push(cur.trim());
  if (lines.length === 2 && words.join(" ").length > lines.join(" ").length + 1) {
    lines[1] = `${lines[1].slice(0, 24).trimEnd()}…`;
  }
  return lines.slice(0, 2);
}

function cardOverlay(nameLines: string[], chipText: string): string {
  const nameSvg =
    nameLines.length === 2
      ? `<text x="64" y="486" font-family="FreeSerif" font-weight="bold" font-size="62" fill="#fdfcfa">${esc(nameLines[0])}</text>
         <text x="64" y="560" font-family="FreeSerif" font-weight="bold" font-size="62" fill="#fdfcfa">${esc(nameLines[1])}</text>`
      : `<text x="64" y="522" font-family="FreeSerif" font-weight="bold" font-size="66" fill="#fdfcfa">${esc(nameLines[0])}</text>`;
  const chipW = Math.max(150, chipText.length * 15 + 56);
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#11100f" stop-opacity="0.94"/>
      <stop offset="0.42" stop-color="#11100f" stop-opacity="0.55"/>
      <stop offset="0.72" stop-color="#11100f" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="topscrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#11100f" stop-opacity="0.66"/>
      <stop offset="1" stop-color="#11100f" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <rect width="${W}" height="170" fill="url(#topscrim)"/>
  <text x="64" y="76" font-family="FreeSans" font-size="16" letter-spacing="6" fill="#d9b8ae">L U B N É L · C O L L E C T I O N</text>
  <rect x="64" y="98" width="46" height="3" fill="#d9b8ae"/>
  ${nameSvg}
  <g>
    <rect x="${W - chipW - 56}" y="46" width="${chipW}" height="50" rx="25" fill="#11100f" fill-opacity="0.62" stroke="#d9b8ae" stroke-opacity="0.7" stroke-width="1.4"/>
    <text x="${W - 56 - chipW / 2}" y="79" font-family="FreeSans" font-size="24" fill="#fdfcfa" text-anchor="middle">${esc(chipText)}</text>
  </g>
</svg>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: id } = await params;

  let found: { category: StoreCategory; count: number } | null = null;
  try {
    found = await findShareCategory(id);
  } catch {
    found = null;
  }
  if (!found) {
    const fallback = await readFile(path.join(process.cwd(), "public", "og-image.jpg"));
    return new Response(new Uint8Array(fallback), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" },
    });
  }

  const { category, count } = found;
  const sig = `${category.updatedAt.getTime()}-${count}-${category.nameAr}`;
  let hash = 5381;
  for (let i = 0; i < sig.length; i++) hash = ((hash << 5) + hash + sig.charCodeAt(i)) >>> 0;
  const cacheFile = path.join(CACHE_DIR, `cat-${category.slug}-${hash.toString(16)}.jpg`);

  try {
    const cached = await readFile(cacheFile);
    return new Response(new Uint8Array(cached), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" },
    });
  } catch {
    /* regenerate below */
  }

  let base: Buffer | null = null;
  if (category.imageUrl) {
    try {
      base = await readFile(path.join(process.cwd(), "public", category.imageUrl));
    } catch {
      base = null;
    }
  }
  if (!base) {
    base = await readFile(path.join(process.cwd(), "public", "og-image.jpg"));
  }

  const name = category.nameAr || category.name;
  const chip = count > 0 ? `${count} منتجات` : "قريبًا";
  const photo = await sharp(base)
    .resize(W, H, { fit: "cover", position: "attention" })
    .toBuffer();
  const jpeg = await sharp(photo)
    .composite([{ input: Buffer.from(cardOverlay(wrapName(name), chip)) }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile, jpeg);
  } catch {
    /* cache write is best-effort */
  }

  return new Response(new Uint8Array(jpeg), {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" },
  });
}
