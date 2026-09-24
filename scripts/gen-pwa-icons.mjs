// R30 — generate PWA icon set from the brand icon.svg (src/app/icon.svg).
// Composes each size over a full-bleed ink canvas so Android/ iOS launchers
// see a solid tile (the source SVG's rounded corners blend into the same ink).
// Maskable variant keeps the mark inside the 80% safe zone.
import sharp from "sharp";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/app/icon.svg"), "utf8");
const INK = "#11100f";

const inner = src
  .replace(/<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  // drop the source's own rounded-rect tile — the wrapper provides full bleed
  .replace(/<rect[^>]*width="64"[^>]*\/>/, "");

const wrap = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${INK}"/>
  <g transform="translate(${256 - (256 * scale)}, ${256 - (256 * scale)}) scale(${scale * 8})">${inner}</g>
</svg>`;

mkdirSync(join(root, "public/icons"), { recursive: true });

const jobs = [
  { file: "icon-192.png", size: 192, scale: 0.86 },
  { file: "icon-512.png", size: 512, scale: 0.86 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.62 }, // mark within 80% safe zone
  { file: "apple-touch-icon.png", size: 180, scale: 0.86 },
];

for (const j of jobs) {
  const svg = wrap(j.scale);
  const png = await sharp(Buffer.from(svg)).resize(j.size, j.size).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(root, "public/icons", j.file), png);
  console.log(`${j.file}: ${png.length} bytes`);
}
console.log("PWA icons generated");
