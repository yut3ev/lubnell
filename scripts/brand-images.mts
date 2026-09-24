// LUBNÉL — generate professional branded product images (final catalog).
// Generates 864x1152 product photography via z-ai image gen, then composites
// the LUBNÉL wordmark (serif + sparkle diamond) with sharp → public/images/products/lb-*.jpg
import ZAI from "z-ai-web-dev-sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "public", "images", "products");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const STYLE =
  "professional luxury beauty product photography, soft cream and dusty-rose studio background, warm diffused natural light, elegant minimal composition, high-end e-commerce catalog photo, ultra sharp, high quality, no text, no words, no watermark";

type Job = { file: string; prompt: string };

const JOBS: Job[] = [
  {
    file: "lb-university-box.jpg",
    prompt: `an elegant open dusty-pink rigid gift box with cream ribbon containing a small scrub cream jar, a roll-on deodorant, a mini nail clipper set, a folded hair towel and an eyeliner pencil arranged in rose-gold tissue paper, ${STYLE}`,
  },
  {
    file: "lb-care-makeup-box.jpg",
    prompt: `a beauty care gift box containing a body scrub jar, a royal jelly honey mask jar, a pink beauty blender sponge and two slim makeup pencils, laid on cream silk fabric with dried flowers, ${STYLE}`,
  },
  {
    file: "lb-strawberry-lip-set.jpg",
    prompt: `a classic red lipstick bullet next to a red lip liner pencil and a small metal pencil sharpener, fresh strawberries beside them on soft cream backdrop, ${STYLE}`,
  },
  {
    file: "lb-strawberry-body-mist.jpg",
    prompt: `a tall translucent body mist spray bottle filled with strawberry-pink liquid, minimal blank white label, fresh strawberry slices nearby, soft daylight, ${STYLE}`,
  },
  {
    file: "lb-vaseline-tonic.jpg",
    prompt: `a classic clear glass hair tonic bottle with pale amber liquid, vintage-style blank white label and brown cap, on cream studio background with soft shadow, ${STYLE}`,
  },
  {
    file: "lb-vaseline-tonic-blue.jpg",
    prompt: `a classic clear glass hair tonic bottle filled with deep blue liquid, blank vintage label with blue tint, dark brown cap, cream studio background, ${STYLE}`,
  },
  {
    file: "lb-avocado-box.jpg",
    prompt: `a spa care gift box with a green avocado face mask jar, a cucumber scrub jar, a yogurt facial wash tube, a beige beauty blender and a small sage hair towel, sage green and cream tones, ${STYLE}`,
  },
  {
    file: "lb-starky-eva-set.jpg",
    prompt: `a skincare duo set of a cucumber exfoliating cream jar and a green facial cleanser tube with a small makeup remover bottle, fresh cucumber slices on clean white-cream background, ${STYLE}`,
  },
  {
    file: "lb-care-more-lotion.jpg",
    prompt: `a body lotion pump bottle with creamy white liquid and a berry-pink blank label, mixed berries and a strawberry beside it, ${STYLE}`,
  },
  {
    file: "lb-care-more-trio.jpg",
    prompt: `three body lotion pump bottles in a row with soft pink, deep red and coconut-cream blank labels, tropical berries and a coconut half beside them, ${STYLE}`,
  },
  {
    file: "lb-star-necklaces.jpg",
    prompt: `delicate stainless steel necklaces with star pendants in silver and gold laid on cream velvet with soft light reflection, fine jewelry photography, ${STYLE}`,
  },
];

// ── LUBNÉL wordmark SVG (sparkle diamond + serif wordmark)
function watermarkSvg(w: number, h: number, pos: "bottom-center" | "top-left", scale = 1): string {
  const fs = Math.round(w * 0.055 * scale);
  const pad = Math.round(w * 0.055);
  const text = "LUBNÉL";
  const ls = Math.round(fs * 0.24);
  const charW = fs * 0.62;
  const textW = text.length * (charW + ls) - ls;
  const starR = fs * 0.36;
  const gap = fs * 0.5;
  const totalW = starR * 2 + gap + textW;
  const baseY = pos === "bottom-center" ? h - pad : pad + fs;
  const x = pos === "bottom-center" ? (w - totalW) / 2 : pad;
  const textX = x + starR * 2 + gap;
  const cx = x + starR;
  const cy = baseY - fs * 0.34;
  const r = starR;
  const r2 = starR * 0.3;
  const sparkle = `M ${cx} ${cy - r} C ${cx + r2 * 0.4} ${cy - r2}, ${cx + r2} ${cy - r2 * 0.4}, ${cx + r} ${cy} C ${cx + r2} ${cy + r2 * 0.4}, ${cx + r2 * 0.4} ${cy + r2}, ${cx} ${cy + r} C ${cx - r2 * 0.4} ${cy + r2}, ${cx - r2} ${cy + r2 * 0.4}, ${cx - r} ${cy} C ${cx - r2} ${cy - r2 * 0.4}, ${cx - r2 * 0.4} ${cy - r2}, ${cx} ${cy - r} Z`;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.6" flood-color="#33221c" flood-opacity="0.45"/></filter></defs>
  <path d="${sparkle}" fill="#ffffff" fill-opacity="0.96" filter="url(#ds)"/>
  <text x="${textX}" y="${baseY}" font-family="Tinos, 'Liberation Serif', 'DejaVu Serif', serif" font-size="${fs}" fill="#ffffff" fill-opacity="0.96" letter-spacing="${ls}" style="letter-spacing:${ls}px" filter="url(#ds)">${text}</text>
</svg>`;
}

async function generate(zai: Awaited<ReturnType<typeof ZAI.create>>, job: Job): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await zai.images.generations.create({ prompt: job.prompt, size: "864x1152" });
      const b64 = res.data?.[0]?.base64;
      if (!b64) throw new Error("empty base64");
      return Buffer.from(b64, "base64");
    } catch (e) {
      console.error(`  ✗ attempt ${attempt} failed: ${e instanceof Error ? e.message : e}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function main() {
  const only = process.argv[2]; // optional: single file name to (re)generate
  const zai = await ZAI.create();
  let done = 0;
  for (const job of JOBS) {
    const out = path.join(OUT, job.file);
    if (only && job.file !== only) continue;
    if (!only && fs.existsSync(out)) { console.log(`↷ skip existing ${job.file}`); done++; continue; }
    process.stdout.write(`● generating ${job.file} … `);
    const raw = await generate(zai, job);
    if (!raw) { console.log("FAILED"); continue; }
    const img = sharp(raw).resize(864, 1152, { fit: "cover" });
    const meta = await img.metadata();
    const w = meta.width || 864;
    const h = meta.height || 1152;
    const marked = await img
      .composite([{ input: Buffer.from(watermarkSvg(w, h, "bottom-center")), top: 0, left: 0 }])
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(out, marked);
    done++;
    console.log(`✓ ${(marked.length / 1024).toFixed(0)}KB`);
  }
  console.log(`\nDone: ${done}/${JOBS.length} branded product images ready in public/images/products/`);
}

main().catch(e => { console.error(e); process.exit(1); });
