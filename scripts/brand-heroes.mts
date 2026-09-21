// LUBNÉL — hero-slide branding pass: composite the ✦ LUBNÉL wordmark (top-left,
// same sparkle+serif lockup as categories/products) onto the 3 hero slides.
// Originals are backed up to scripts/backup-images/hero-backup/ once, so re-running
// always watermarks from the clean original (no double-marking).
import fs from "fs";
import path from "path";
import sharp from "sharp";

const HEROES = ["hero-1", "hero-2", "hero-3"] as const;
const DIR = path.join(process.cwd(), "public/images");
const BACKUP = path.join(process.cwd(), "scripts/backup-images/hero-backup");

function watermarkSvg(w: number, h: number, scale = 1): string {
  // The live hero is a full-width cover slider (object-position: center + a slow
  // Ken Burns zoom), so the bottom edge is cropped on every desktop width and the
  // corners move mid-zoom. A mark at x-center / y≈70% stays inside the visible
  // band at 1280 / 1536 / 1920 and on mobile, zoom or not.
  const fs_ = Math.round(w * 0.026 * scale);
  const text = "LUBNÉL";
  const ls = Math.round(fs_ * 0.26);
  const charW = fs_ * 0.62;
  const textW = text.length * (charW + ls) - ls;
  const starR = fs_ * 0.36;
  const gap = fs_ * 0.5;
  const totalW = starR * 2 + gap + textW;
  const baseY = Math.round(h * 0.7);
  const x = (w - totalW) / 2;
  const textX = x + starR * 2 + gap;
  const cx = x + starR;
  const cy = baseY - fs_ * 0.34;
  const r = starR;
  const r2 = starR * 0.3;
  const sparkle = `M ${cx} ${cy - r} C ${cx + r2 * 0.4} ${cy - r2}, ${cx + r2} ${cy - r2 * 0.4}, ${cx + r} ${cy} C ${cx + r2} ${cy + r2 * 0.4}, ${cx + r2 * 0.4} ${cy + r2}, ${cx} ${cy + r} C ${cx - r2 * 0.4} ${cy + r2}, ${cx - r2} ${cy + r2 * 0.4}, ${cx - r} ${cy} C ${cx - r2} ${cy - r2 * 0.4}, ${cx - r2 * 0.4} ${cy - r2}, ${cx} ${cy - r} Z`;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.4" flood-color="#33221c" flood-opacity="0.38"/></filter></defs>
  <path d="${sparkle}" fill="#ffffff" fill-opacity="0.8" filter="url(#ds)"/>
  <text x="${textX}" y="${baseY}" font-family="Tinos, 'Liberation Serif', 'DejaVu Serif', serif" font-size="${fs_}" fill="#ffffff" fill-opacity="0.8" letter-spacing="${ls}" style="letter-spacing:${ls}px" filter="url(#ds)">${text}</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(BACKUP, { recursive: true });
  for (const name of HEROES) {
    const src = path.join(DIR, `${name}.png`);
    const backup = path.join(BACKUP, `${name}.jpg`);
    if (!fs.existsSync(src)) { console.error(`✗ missing ${src}`); continue; }
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(src, backup);
      console.log(`↳ backed up original → ${path.relative(process.cwd(), backup)}`);
    }
    const img = sharp(backup).resize(1344, 768, { fit: "cover" });
    const marked = await img
      .composite([{ input: Buffer.from(watermarkSvg(1344, 768)), top: 0, left: 0 }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(src, marked);
    console.log(`✓ ${name}.png branded (${(marked.length / 1024).toFixed(0)}KB)`);
  }
  console.log("\nDone: hero slides carry the ✦ LUBNÉL wordmark.");
}

main().catch(e => { console.error(e); process.exit(1); });
