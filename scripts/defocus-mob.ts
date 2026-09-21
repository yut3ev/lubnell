// U41 — light defocus of the very bottom band (same recipe as U38-R2/U39-R2):
// blur 7, SVG linear-gradient alpha mask 78%→96%, flatten white, webp q80.
// Temp QA tool — not part of the app bundle.
import sharp from 'sharp';

const SRC = process.argv[2] || '/tmp/hero-2-mob3-raw.png';
const OUT = process.argv[3] || '/home/z/my-project/public/images/hero-2-mob3.webp';
const W = 720;
const H = 1440;

const svg =
  '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0.78" stop-color="#fff" stop-opacity="0"/>' +
  '<stop offset="0.96" stop-color="#fff" stop-opacity="1"/>' +
  '</linearGradient></defs>' +
  '<rect width="' + W + '" height="' + H + '" fill="url(#g)"/></svg>';

const base = sharp(SRC).resize(W, H, { fit: 'fill' }).removeAlpha();
const baseRaw = await base.clone().raw().toBuffer();
const blurredRaw = await base.clone().blur(7).raw().toBuffer();
const maskRaw = await sharp(Buffer.from(svg)).greyscale().resize(W, H, { fit: 'fill' }).raw().toBuffer();

// alpha = mask (0 above the band → 255 at the very bottom), blend blurred over base
const blended = Buffer.alloc(W * H * 3);
for (let p = 0; p < W * H; p++) {
  const a = maskRaw[p] / 255;
  for (let c = 0; c < 3; c++) {
    const i = p * 3 + c;
    blended[i] = Math.round(blurredRaw[i] * a + baseRaw[i] * (1 - a));
  }
}

await sharp(blended, { raw: { width: W, height: H, channels: 3 } })
  .flatten({ background: '#ffffff' })
  .webp({ quality: 80 })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log('OK', OUT, meta.width + 'x' + meta.height, 'alpha=' + meta.hasAlpha);
