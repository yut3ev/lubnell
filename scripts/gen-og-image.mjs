// R24 — generate branded share assets with sharp:
//   public/og-image.jpg   1200x630 (WhatsApp/Twitter/Facebook share preview)
//   src/app/apple-icon.png 180x180 (iOS home-screen icon)
// Idempotent: re-run any time. Uses only system fonts (FreeSerif/FreeSans).
import sharp from "sharp";
import { statSync } from "node:fs";

const W = 1200, H = 630;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#11100f" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#11100f" stop-opacity="0.84"/>
      <stop offset="1" stop-color="#11100f" stop-opacity="0.42"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#11100f" stop-opacity="0.88"/>
      <stop offset="0.34" stop-color="#11100f" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <rect width="${W}" height="${H}" fill="url(#bottom)"/>
  <text x="66" y="118" font-family="FreeSans" font-size="17" letter-spacing="7" fill="#d9b8ae">L U B N É L · C A I R O</text>
  <rect x="66" y="146" width="58" height="3" fill="#d9b8ae"/>
  <text x="60" y="268" font-family="FreeSerif" font-weight="bold" font-size="108" fill="#fdfcfa">LUBNÉL</text>
  <text x="66" y="330" font-family="FreeSerif" font-size="32" fill="#f3ede6">Your beauty ritual, reimagined in Cairo.</text>
  <text x="66" y="392" font-family="FreeSerif" font-size="30" fill="#dccfc2">${esc("جمالكِ اليومي، بطريقة مصرية")}</text>
  <g font-family="FreeSans" font-size="20" fill="#f3ede6">
    <rect x="66" y="516" width="330" height="52" rx="26" fill="none" stroke="#d9b8ae" stroke-opacity="0.75" stroke-width="1.6"/>
    <text x="231" y="549" text-anchor="middle">${esc("Free delivery over 900 EGP")}</text>
    <rect x="418" y="516" width="238" height="52" rx="26" fill="none" stroke="#d9b8ae" stroke-opacity="0.75" stroke-width="1.6"/>
    <text x="537" y="549" text-anchor="middle">${esc("Cash on delivery")}</text>
  </g>
</svg>`;

const icon = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#11100f"/>
  <text x="248" y="372" font-family="FreeSerif" font-weight="bold" font-size="330" fill="#fdfcfa" text-anchor="middle">L</text>
  <circle cx="368" cy="352" r="26" fill="#d9b8ae"/>
</svg>`;

const hero = await sharp("public/images/hero-1.webp")
  .resize(W, H, { fit: "cover", position: "attention" })
  .toBuffer();

await sharp(hero)
  .composite([{ input: Buffer.from(overlay) }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("public/og-image.jpg");

await sharp(Buffer.from(icon))
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile("src/app/apple-icon.png");

const og = statSync("public/og-image.jpg");
const ap = statSync("src/app/apple-icon.png");
console.log(`og-image.jpg  ${(og.size / 1024).toFixed(1)} KB`);
console.log(`apple-icon.png ${(ap.size / 1024).toFixed(1)} KB`);
