// Task 2-c — one-off in-place recompression of public/products/*.{jpg,jpeg,png}
// - same filenames (DB rows reference them — never rename)
// - quality ~78, max dimension ~1400px, mozjpeg for JPEG outputs
// - PNG inputs stay PNG (palette/quantized) so transparency survives
// - files whose extension is .jpg but whose bytes are PNG (hasAlpha PNGs
//   saved with the wrong extension) are normalized to REAL JPEG bytes,
//   flattened onto white — the .jpg extension already promises image/jpeg
// - rewrite only when the new file is >=15% smaller
// Usage: bun scripts/optimize-images.mjs  (or: node scripts/optimize-images.mjs)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve(process.cwd(), 'public/products');
const MAX_DIM = 1400;
const QUALITY = 78;
const MIN_SAVING = 0.15; // only rewrite when >=15% smaller
const BIG_THRESHOLD = 350 * 1024; // worklog list of files still >350KB

const files = fs
  .readdirSync(DIR)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();

let beforeTotal = 0;
let afterTotal = 0;
let rewritten = 0;
const stillBig = [];

for (const file of files) {
  const p = path.join(DIR, file);
  const before = fs.statSync(p).size;
  beforeTotal += before;

  const isPng = /\.png$/i.test(file);
  const base = sharp(p).rotate(); // auto-orient from EXIF, then strip
  const meta = await base.metadata();
  const pipe = base.resize({
    width: MAX_DIM,
    height: MAX_DIM,
    fit: 'inside',
    withoutEnlargement: true,
  });

  // PNG-in-.jpg-clothing: normalize to real JPEG (flattened on white)
  const effectivelyJpeg = !isPng; // by extension — served Content-Type follows it
  let buf;
  try {
    buf = effectivelyJpeg
      ? await pipe.flatten({ background: '#ffffff' }).jpeg({
          quality: QUALITY,
          mozjpeg: true,
          chromaSubsampling: '4:2:0',
        }).toBuffer()
      : await pipe.png({
          quality: QUALITY,
          palette: true,
          compressionLevel: 9,
          effort: 7,
        }).toBuffer();
  } catch (err) {
    console.error(`! ${file}: encode failed (${err.message}) — left untouched`);
    afterTotal += before;
    continue;
  }

  const after = buf.length;
  const saved = 1 - after / before;
  if (after < before && saved >= MIN_SAVING) {
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, p); // atomic-ish swap, same filename
    afterTotal += after;
    rewritten++;
    console.log(
      `✓ ${file} [${meta.width}x${meta.height} ${meta.format}] → ${(
        before / 1024
      ).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (-${(saved * 100).toFixed(0)}%)`
    );
  } else {
    afterTotal += before;
    console.log(
      `• ${file} [${meta.width}x${meta.height} ${meta.format}] kept at ${(
        before / 1024
      ).toFixed(0)}KB (best saving ${(saved * 100).toFixed(0)}% < 15%)`
    );
  }

  const finalSize = fs.statSync(p).size;
  if (finalSize > BIG_THRESHOLD) stillBig.push(`${file} (${(finalSize / 1024).toFixed(0)}KB)`);
}

console.log('────────────────────────────────────────');
console.log(
  `Total: ${(beforeTotal / 1048576).toFixed(2)}MB → ${(afterTotal / 1048576).toFixed(2)}MB ` +
    `(-${(((beforeTotal - afterTotal) / 1048576)).toFixed(2)}MB, ${(
      (1 - afterTotal / beforeTotal) * 100
    ).toFixed(1)}%) — ${rewritten}/${files.length} files rewritten`
);
if (stillBig.length) console.log(`Still >350KB: ${stillBig.join(', ')}`);
else console.log('Still >350KB: none');
