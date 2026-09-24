// Generate professional LUBNÉL-branded product images for the catalog items
// that have no real photos. Sequential with retries; sharp watermark after.
import ZAI from "z-ai-web-dev-sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = "/home/z/my-project/public/images/products";
fs.mkdirSync(OUT, { recursive: true });

const STYLE = "luxury beauty e-commerce product photography, LUBNÉL brand aesthetic with blush pink cream and soft gold tones, clean uncluttered composition, elegant premium cosmetics advertising, soft diffused studio lighting, ultra detailed, high quality";

type Gen = { out: string; prompt: string; size?: string };

const gens: Gen[] = [
  { out: "gen-liquid-blush.png", prompt: `Two elegant liquid blush glass bottles with gold caps, one rose pink and one warm peach shade, with a soft doe-foot applicator lying beside them on blush silk fabric with delicate rose petals, ${STYLE}` },
  { out: "gen-body-butter.png", prompt: `Three round body butter jars in a row: watermelon pink, strawberry red, and candy purple, whipped cream texture swatch beside them, fresh watermelon slice and strawberries as props, ${STYLE}` },
  { out: "gen-eye-gel.png", prompt: `A luxurious gold eye cream jar with orange vitamin C slices and a clear hyaluronic gel texture swatch, white orchid flower beside it on a cream marble surface, ${STYLE}` },
  { out: "gen-essence-lotion.png", prompt: `A tall elegant pink body lotion pump bottle with soft towel and cream-colored flowers, gentle liquid swipe of lotion on a pastel background, ${STYLE}` },
  { out: "gen-roll-on.png", prompt: `Two slim roll-on deodorant bottles side by side, one soft pink vanilla and one violet patchouli purple, with vanilla flowers and violet petals around, ${STYLE}` },
  { out: "gen-lash-oil.png", prompt: `A delicate lash and brow serum glass bottle with gold cap and fine brush applicator, next to a soft closed-eye illustration aesthetic with tiny white flowers, ${STYLE}` },
  { out: "gen-hair-oil.png", prompt: `An amber glass Indian hair oil bottle with golden dropper, surrounded by botanical herbs and a few drops of golden oil, warm luxurious spa feeling, ${STYLE}` },
  { out: "gen-university-box.png", prompt: `A beautiful open blush-pink beauty gift box filled with skincare cream jar, roll-on bottle, nail clipper set, hair tie and makeup pencil, arranged neatly with ribbon, student lifestyle aesthetic, ${STYLE}` },
  { out: "gen-care-makeup-box.png", prompt: `An elegant care and makeup gift box containing a body scrub jar, honey mask jar, pink beauty blender sponge and two eyeliner pencils, on cream silk with gold accents, ${STYLE}` },
  { out: "gen-strawberry-lip-set.png", prompt: `A classic red lipstick bullet next to a red lip liner pencil on a strawberry-pink background with fresh strawberries and a small strawberry-shaped charm, glossy luxurious feel, ${STYLE}` },
  { out: "gen-body-mist.png", prompt: `A pink strawberry body mist spray bottle with fine mist spray frozen in air, fresh strawberries and strawberry flowers around, refreshing joyful mood, ${STYLE}` },
  { out: "gen-avocado-box.png", prompt: `A fresh spa care gift box with green avocado mask jar, cucumber scrub jar, yogurt face wash tube, pink beauty blender and hair towel, avocado halves and cucumber slices as props, cream and sage green palette, ${STYLE}` },
  { out: "gen-starky-eva-set.png", prompt: `A skincare duo set: green cucumber scrub jar next to a white yogurt face wash tube, cucumber slices and yogurt swirl as props, fresh clean spa aesthetic, ${STYLE}` },
  { out: "gen-star-necklaces.png", prompt: `Delicate stainless steel star pendant necklaces in silver, gold and rose gold displayed on soft blush velvet with a jewelry gift box, sparkling elegant jewelry photography, ${STYLE}` },
];

function watermarkSvg(w: number, h: number) {
  const size = Math.max(22, Math.round(Math.min(w, h) * 0.042));
  const pad = Math.round(Math.min(w, h) * 0.045);
  const text = `<text x="${pad}" y="${pad + size}" font-family="DejaVu Serif, Georgia, serif" font-size="${size}" letter-spacing="${Math.round(size * 0.18)}" fill="#ffffff" stroke="rgba(60,40,35,0.38)" stroke-width="${Math.max(1, size / 14)}" paint-order="stroke" font-weight="600">LUBNÉL</text>`;
  const star = `<text x="${pad + size * 4.6}" y="${pad + size}" font-size="${Math.round(size * 0.7)}" fill="#f7d9ce" stroke="rgba(60,40,35,0.3)" stroke-width="1" paint-order="stroke">✦</text>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${text}${star}</svg>`);
}

async function generate(zai: Awaited<ReturnType<typeof ZAI.create>>, gen: Gen, tries = 3): Promise<boolean> {
  const outPath = path.join(OUT, gen.out);
  if (fs.existsSync(outPath)) { console.log(`↷ exists ${gen.out}`); return true; }
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await zai.images.generations.create({ prompt: gen.prompt, size: gen.size || "864x1152" });
      const b64 = res.data?.[0]?.base64;
      if (!b64) throw new Error("empty base64");
      const raw = Buffer.from(b64, "base64");
      const img = sharp(raw).rotate();
      const meta = await img.metadata();
      const w = meta.width || 864, h = meta.height || 1152;
      const overlay = await sharp(watermarkSvg(w, h)).png().toBuffer();
      await img.composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 86, mozjpeg: true }).toFile(outPath.replace(".png", ".jpg"));
      console.log(`✓ ${gen.out.replace(".png", ".jpg")} (attempt ${attempt})`);
      return true;
    } catch (e) {
      console.error(`✗ ${gen.out} attempt ${attempt}:`, e instanceof Error ? e.message : e);
      if (attempt < tries) await new Promise(r => setTimeout(r, 2500 * attempt));
    }
  }
  return false;
}

(async () => {
  const zai = await ZAI.create();
  let ok = 0;
  for (const gen of gens) if (await generate(zai, gen)) ok++;
  console.log(`DONE generating: ${ok}/${gens.length}`);
})();
