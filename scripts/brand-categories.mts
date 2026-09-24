// LUBNÉL — stamp the brand wordmark (top-left) on the 6 category tiles.
// Backs up originals to scripts/backup-images/ then overwrites in place.
import sharp from "sharp";
import fs from "fs";
import path from "path";

const IMG = path.join(process.cwd(), "public", "images");
const BACKUP = path.join(process.cwd(), "scripts", "backup-images");
if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP, { recursive: true });

function watermarkSvg(w: number, h: number): string {
  const fs2 = Math.round(w * 0.062);
  const pad = Math.round(w * 0.05);
  const text = "LUBNÉL";
  const ls = Math.round(fs2 * 0.22);
  const starR = fs2 * 0.36;
  const gap = fs2 * 0.45;
  const baseY = pad + fs2;
  const x = pad;
  const textX = x + starR * 2 + gap;
  const cx = x + starR;
  const cy = baseY - fs2 * 0.34;
  const r = starR;
  const r2 = starR * 0.3;
  const sparkle = `M ${cx} ${cy - r} C ${cx + r2 * 0.4} ${cy - r2}, ${cx + r2} ${cy - r2 * 0.4}, ${cx + r} ${cy} C ${cx + r2} ${cy + r2 * 0.4}, ${cx + r2 * 0.4} ${cy + r2}, ${cx} ${cy + r} C ${cx - r2 * 0.4} ${cy + r2}, ${cx - r2} ${cy + r2 * 0.4}, ${cx - r} ${cy} C ${cx - r2} ${cy - r2 * 0.4}, ${cx - r2 * 0.4} ${cy - r2}, ${cx} ${cy - r} Z`;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.6" flood-color="#33221c" flood-opacity="0.5"/></filter></defs>
  <path d="${sparkle}" fill="#ffffff" fill-opacity="0.95" filter="url(#ds)"/>
  <text x="${textX}" y="${baseY}" font-family="Tinos, 'Liberation Serif', 'DejaVu Serif', serif" font-size="${fs2}" fill="#ffffff" fill-opacity="0.95" style="letter-spacing:${ls}px" filter="url(#ds)">${text}</text>
</svg>`;
}

const tiles = ["cat-makeup.png", "cat-skincare.png", "cat-fragrance.png", "cat-bodycare.png", "cat-lips.png", "cat-sets.png"];

for (const file of tiles) {
  const src = path.join(IMG, file);
  if (!fs.existsSync(src)) { console.log(`✗ missing ${file}`); continue; }
  const bak = path.join(BACKUP, file);
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
  const buf = fs.readFileSync(src);
  const meta = await sharp(buf).metadata();
  const w = meta.width || 768;
  const h = meta.height || 768;
  const out = await sharp(buf)
    .composite([{ input: Buffer.from(watermarkSvg(w, h)), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(src, out);
  console.log(`✓ ${file} branded (${w}x${h}, ${(out.length / 1024).toFixed(0)}KB)`);
}
console.log("Category tiles branded.");
