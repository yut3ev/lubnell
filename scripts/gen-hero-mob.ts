import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync, writeFileSync } from 'fs';

const SRC = process.argv[4] || '/home/z/my-project/public/images/hero-3-mob.webp';
const OUT = process.argv[2] || '/tmp/hero-mob-raw.png';
const PROMPT = process.argv[3] ||
  `Keep the top part of this vertical image exactly as it is: the cream canvas tote bag with the LUBNÉL logo and the small pink hang tag surrounded by white baby's breath flowers against the warm terracotta wall. Replace the entire lower two thirds (the plain blurry empty area) with the continuation of the same photographic scene: below the bag, a warm travertine stone tabletop holding rose-gold luxury skincare products — a frosted glass pump bottle, a pink cosmetic tube, a pink frosted jar with rose-gold lid and a rose-gold lipstick — standing among clusters of white baby's breath flowers, a soft pink camellia bloom, draped cream silk fabric and scattered blush petals. Warm terracotta and blush palette, soft golden window light with gentle leaf shadows, shallow depth of field. IMPORTANT: the whole frame must be filled edge to edge with real photographic content — absolutely NO plain flat color block, NO empty gradient band, NO solid empty blurred area anywhere; flowers, products, fabric and warm textured surfaces continue all the way to the bottom edge of the image. Photorealistic luxury cosmetics advertising photography, ultra detailed, no text anywhere except the LUBNÉL logo on the bag. Absolutely NO phone frame, NO device mockup, NO borders, NO bezels.`;

async function main() {
  const zai = await ZAI.create();
  const b64 = readFileSync(SRC).toString('base64');
  const res = await zai.images.generations.edit({
    prompt: PROMPT,
    images: [{ url: `data:image/png;base64,${b64}` }],
    size: '720x1440',
  });
  const out = res.data?.[0]?.base64;
  if (!out) throw new Error('no base64 in response');
  writeFileSync(OUT, Buffer.from(out, 'base64'));
  console.log('OK', OUT);
}
main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
