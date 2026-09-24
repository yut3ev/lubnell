// U37 — fix the AI portrait banner: crop above the hard seam, extend the
// bottom with a stretched+blurred strip (defocused foreground look).
import sharp from 'sharp';

const SRC = process.argv[2] || '/tmp/hero-mob-raw2.png';
const OUT = process.argv[3] || '/tmp/hero-mob-fixed.png';
// Find the seam: scan rows from 60% down, find where row stddev collapses
const img = sharp(SRC);
const meta = await img.metadata();
const W = meta.width ?? 720;
const H = meta.height ?? 1440;
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;
const rowStd = (y: number) => {
  let sum = 0, sum2 = 0, n = 0;
  for (let x = 0; x < W; x += 4) {
    const i = (y * W + x) * ch;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += l; sum2 += l * l; n++;
  }
  return Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2));
};
let seam = -1;
for (let y = Math.floor(H * 0.6); y < H - 40; y++) {
  // solid block: 12 consecutive rows with very low variance
  let flat = true;
  for (let k = 0; k < 12 && flat; k++) if (rowStd(y + k) > 6) flat = false;
  if (flat) { seam = y; break; }
}
console.log('seam at', seam, 'of', H);
const cut = seam > 0 ? seam - 2 : Math.floor(H * 0.72);
const extH = H - cut;
// extension: stretch the last 120px above the cut + heavy blur
const stripH = 120;
const strip = await sharp(SRC)
  .extract({ left: 0, top: cut - stripH, width: W, height: stripH })
  .resize(W, extH, { fit: 'fill' })
  .blur(28)
  .toBuffer();
await sharp(SRC)
  .composite([
    { input: strip, left: 0, top: cut },
    // soft blend at the joint: gradient mask hides any residual edge
    {
      input: Buffer.from(
        `<svg width="${W}" height="60"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="${W}" height="60" fill="url(#g)"/></svg>`
      ),
      left: 0, top: cut - 30,
      blend: 'overlay' as const,
    },
  ])
  .extract({ left: 0, top: 0, width: W, height: H })
  .png()
  .toFile(OUT);
console.log('OK', OUT, `${W}x${H}, cut=${cut}, ext=${extH}`);
