/* LUBNÉL brand imagery generator — backend only */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT = "/home/z/my-project/public/images";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

type Job = { file: string; prompt: string; size: string };

const STYLE =
  "professional beauty product photography, soft warm beige and blush pink palette, elegant minimal composition, soft diffused studio lighting, subtle shadows, luxury cosmetic brand aesthetic, high quality, detailed, no text, no watermark";

const jobs: Job[] = [
  // ── Hero slides (wide) ──────────────────────────────────────────────
  {
    file: "hero-1.png",
    size: "1344x768",
    prompt:
      "Editorial beauty campaign photo: elegant middle-eastern woman with glowing natural makeup holding a blush pink cosmetic bottle, soft warm beige studio backdrop with silk fabric drape, golden light, luxury aesthetic, no text, high quality, wide composition with copy space on the left",
  },
  {
    file: "hero-2.png",
    size: "1344x768",
    prompt:
      "Skincare editorial flat-lay hero: glass serum droppers, cream jars and a ceramic dish arranged on warm beige linen with soft pink rose petals, morning sunlight and palm leaf shadow, luxury spa aesthetic, no text, high quality, wide composition with copy space",
  },
  {
    file: "hero-3.png",
    size: "1344x768",
    prompt:
      "Soft-glow beauty editorial: close-up of woman's hands with manicured nails applying body cream from an elegant frosted glass jar, peach and cream tones, silk sheets background, dreamy soft light, luxury cosmetic brand, no text, high quality",
  },
  // ── Categories (square) ─────────────────────────────────────────────
  { file: "cat-makeup.png", size: "1024x1024", prompt: "Luxury makeup collection: blush compact, lipstick and makeup brushes arranged on a round beige podium, blush pink background, " + STYLE },
  { file: "cat-skincare.png", size: "1024x1024", prompt: "Minimal skincare routine: amber glass serum bottle with dropper and white cream jar on a beige stone pedestal, eucalyptus leaf, " + STYLE },
  { file: "cat-fragrance.png", size: "1024x1024", prompt: "Elegant perfume bottle with gold cap on beige silk fabric, dried flowers and soft shadow play, blush and cream tones, " + STYLE },
  { file: "cat-bodycare.png", size: "1024x1024", prompt: "Body care still life: white body lotion tube and shea butter jar with cotton towel on warm beige background, soft morning light, " + STYLE },
  { file: "cat-sets.png", size: "1024x1024", prompt: "Curated beauty gift box: open blush pink box with small cosmetics, ribbon, dried orange slice and cotton flowers, beige background, " + STYLE },
  { file: "cat-lips.png", size: "1024x1024", prompt: "Strawberry red lipstick and lip liner on glossy pink surface with fresh strawberries, juicy summer beauty vibe, " + STYLE },
  // ── Products (square) ───────────────────────────────────────────────
  { file: "p-musk-wash.png", size: "1024x1024", prompt: "Elegant pink pump bottle of gentle feminine wash with musk perfume accents, beige podium, " + STYLE },
  { file: "p-liquid-blush.png", size: "1024x1024", prompt: "Peach toned liquid blush glass bottle with doe-foot applicator, swatch smear of peach blush behind, " + STYLE },
  { file: "p-remover.png", size: "1024x1024", prompt: "Clear bi-phase makeup remover bottle with white cap, cotton pads beside it, clean beige scene, " + STYLE },
  { file: "p-body-butter.png", size: "1024x1024", prompt: "Whipped pink body butter in open glass jar with watermelon slice and strawberries, fresh juicy vibe, " + STYLE },
  { file: "p-eye-gel.png", size: "1024x1024", prompt: "Small orange vitamin-c eye gel tube with golden dropper beside it, clean minimal beige background, " + STYLE },
  { file: "p-scrub-glove.png", size: "1024x1024", prompt: "Pink exfoliating body scrub glove hanging on a beige wall hook with soap bar and towel, spa vibe, " + STYLE },
  { file: "p-body-lotion.png", size: "1024x1024", prompt: "White and rose-gold body lotion pump bottle with berries and coconut pieces at its base, " + STYLE },
  { file: "p-roll-on.png", size: "1024x1024", prompt: "Sleek pastel pink deodorant roll-on bottle standing on a beige round podium, soft petals, " + STYLE },
  { file: "p-lash-oil.png", size: "1024x1024", prompt: "Small clear lash and brow growth oil serum bottle with gold dropper and castor beans, clean beige scene, " + STYLE },
  { file: "p-hair-oil.png", size: "1024x1024", prompt: "Amber hair oil bottle in an elegant infusion box with herbal leaves, warm spa lighting, " + STYLE },
  { file: "p-beauty-box.png", size: "1024x1024", prompt: "Open luxury beauty subscription box filled with mini cosmetics, skincare and tools, blush ribbon, " + STYLE },
  { file: "p-lip-set.png", size: "1024x1024", prompt: "Strawberry red lipstick with matching lip liner and lip balm arranged with fresh strawberries on pink silk, " + STYLE },
  { file: "p-body-mist.png", size: "1024x1024", prompt: "Tall transparent strawberry body mist spray bottle with pink liquid, strawberries around, glossy scene, " + STYLE },
  { file: "p-hair-tonic.png", size: "1024x1024", prompt: "Vintage style hair tonic bottle with white label next to a small cream jar, navy and gold accents on beige, " + STYLE },
  { file: "p-necklace.png", size: "1024x1024", prompt: "Dainty stainless steel star pendant necklaces on a beige jewelry display bust, soft gold tones, " + STYLE },
  { file: "p-avocado-box.png", size: "1024x1024", prompt: "Green-themed spa care box with avocado face mask, cucumber slice and small skincare jars, fresh natural vibe, " + STYLE },
];

async function main() {
  const zai = await ZAI.create();
  const todo = jobs.filter(j => !fs.existsSync(path.join(OUT, j.file)));
  console.log(`Generating ${todo.length}/${jobs.length} images...`);
  let done = 0;
  for (const job of todo) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await zai.images.generations.create({ prompt: job.prompt, size: job.size });
        const b64 = res?.data?.[0]?.base64;
        if (!b64) throw new Error("empty base64");
        fs.writeFileSync(path.join(OUT, job.file), Buffer.from(b64, "base64"));
        done++;
        console.log(`[${done}/${todo.length}] ✓ ${job.file}`);
        break;
      } catch (err) {
        console.error(`✗ ${job.file} attempt ${attempt}:`, err instanceof Error ? err.message : err);
        if (attempt === 3) console.error(`FAILED permanently: ${job.file}`);
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
  }
  console.log(`Done. ${done} images generated.`);
}

main().catch(e => { console.error(e); process.exit(1); });
