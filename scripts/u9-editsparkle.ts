// U9: erase the ✦ sparkle mark from hero watermark images (keep LUBNÉL text)
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function editOne(src: string, out: string, size: string) {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(src).toString('base64');
  const mime = src.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const prompt =
    'Erase the small four-pointed star sparkle symbol located immediately to the left of the LUBNÉL watermark text. ' +
    'Fill the area seamlessly with the surrounding background texture. ' +
    'Keep the LUBNÉL letters themselves and every other element (products, textures, shadows, colors) exactly identical and unchanged.';
  const res = await zai.images.generations.edit({
    prompt,
    images: [{ url: `data:${mime};base64,${b64}` }],
    size,
  });
  const outB64 = res?.data?.[0]?.base64;
  if (!outB64) throw new Error('no image returned');
  fs.writeFileSync(out, Buffer.from(outB64, 'base64'));
  console.log('saved', out, fs.statSync(out).size, 'bytes');
}

(async () => {
  await editOne('public/images/hero-2.png', '/tmp/hero-2-edited.png', '1344x768');
  await editOne('public/images/hero-3.webp', '/tmp/hero-3-edited.webp', '1344x768');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
