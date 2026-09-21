// Process uploaded product photos → public/images/products/
// - resize to max 1100px long edge, JPEG q84
// - elegant LUBNÉL watermark on real photos (skip ones already branded)
// - crop the marketing collage into 4 quadrant heroes (already LUBNÉL-branded)
import sharp from "sharp";
import fs from "fs";
import path from "path";

const SRC = "/home/z/my-project/upload";
const OUT = "/home/z/my-project/public/images/products";
fs.mkdirSync(OUT, { recursive: true });

const U = (f: string) => path.join(SRC, f);

type Job = { src: string; out: string; watermark: boolean };

const jobs: Job[] = [
  { src: U("brave_xEvxPiEmrQ.png"), out: "boscarest-musk-wash-main.jpg", watermark: true },
  { src: U("brave_CNPruu7s03.jpg"), out: "boscarest-musk-wash-silk.jpg", watermark: true },
  { src: U("images (1) (1).jpg"), out: "sheglam-remover-main.jpg", watermark: true },
  { src: U("93207858284.png"), out: "sheglam-remover-howto.jpg", watermark: true },
  { src: U("f5203012c8094d6f8a5e43afb2293393.png"), out: "scrub-glove-main.jpg", watermark: true },
  { src: U("9cfa6e89ddf44342b966a504c2f7f9dc.jpg"), out: "care-more-lotion-trio.jpg", watermark: true },
  { src: U("Gemini_Generated_Image_yulcmkyulcmkyulc.jpg"), out: "care-more-lotion-lifestyle.jpg", watermark: false },
  { src: U("brave_ICLqLkTkD8.png"), out: "vaseline-hair-tonic-main.jpg", watermark: false },
  { src: U("Gemini_Generated_Image_yulcmkyulcmkyulc (1).jpg"), out: "vaseline-hair-tonic-blue.jpg", watermark: false },
  { src: U("Gemini_Generated_Image_yulcmkyulcmkyulc (2).jpg"), out: "vaseline-hair-tonic-dark.jpg", watermark: false },
  { src: U("images.jpg"), out: "starky-cucumber-scrub.jpg", watermark: true },
];

// LUBNÉL watermark SVG — small elegant serif wordmark + ✦, top-left, works on light & dark
function watermarkSvg(w: number, h: number) {
  const size = Math.max(22, Math.round(Math.min(w, h) * 0.042));
  const pad = Math.round(Math.min(w, h) * 0.045);
  const text = `<text x="${pad}" y="${pad + size}" font-family="DejaVu Serif, Georgia, serif" font-size="${size}" letter-spacing="${Math.round(size * 0.18)}" fill="#ffffff" stroke="rgba(60,40,35,0.38)" stroke-width="${Math.max(1, size / 14)}" paint-order="stroke" font-weight="600">LUBNÉL</text>`;
  const star = `<text x="${pad + size * 4.6}" y="${pad + size}" font-size="${Math.round(size * 0.7)}" fill="#f7d9ce" stroke="rgba(60,40,35,0.3)" stroke-width="1" paint-order="stroke">✦</text>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${text}${star}</svg>`);
}

async function processJob(job: Job) {
  const img = sharp(job.src).rotate();
  const meta = await img.metadata();
  const w = meta.width || 800;
  const h = meta.height || 800;
  const scale = Math.min(1, 1100 / Math.max(w, h));
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);
  let pipe = img.resize(tw, th, { fit: "inside" });
  if (job.watermark) {
    const overlay = await sharp(watermarkSvg(tw, th)).png().toBuffer();
    pipe = pipe.composite([{ input: overlay, top: 0, left: 0 }]);
  }
  await pipe.jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, job.out));
  console.log(`✓ ${job.out} (${tw}x${th})${job.watermark ? " +watermark" : ""}`);
}

// Crop collage into 4 quadrants (each already carries LUBNÉL marks)
async function cropCollage() {
  const src = U("Gemini_Generated_Image_ha81feha81feha81 (1).jpg");
  const meta = await sharp(src).metadata();
  const w = Math.floor((meta.width || 880) / 2);
  const h = Math.floor((meta.height || 1314) / 2);
  const quads: [string, number, number][] = [
    ["collage-vaseline.jpg", 0, 0],
    ["collage-care-more.jpg", 1, 0],
    ["collage-gloves.jpg", 0, 1],
    ["collage-starky.jpg", 1, 1],
  ];
  for (const [name, cx, cy] of quads) {
    await sharp(src)
      .extract({ left: cx * w, top: cy * h, width: w, height: h })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(OUT, name));
    console.log(`✓ ${name} (${w}x${h})`);
  }
}

(async () => {
  for (const job of jobs) {
    try { await processJob(job); } catch (e) { console.error(`✗ ${job.out}:`, e instanceof Error ? e.message : e); }
  }
  try { await cropCollage(); } catch (e) { console.error("✗ collage:", e instanceof Error ? e.message : e); }
  console.log("DONE processing uploads");
})();
