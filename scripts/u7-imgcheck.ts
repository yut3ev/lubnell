import sharp from 'sharp';
import fs from 'fs';
for (const f of ['/tmp/t1.jpg', '/tmp/t2.jpg']) {
  const buf = fs.readFileSync(f);
  console.log(f, 'bytes:', buf.length, 'magic:', buf.subarray(0, 4).toString('hex'));
  try {
    const meta = await sharp(buf).metadata();
    console.log('  sharp decodes OK:', meta.format, meta.width + 'x' + meta.height);
  } catch (e) { console.log('  sharp DECODE FAILED:', (e as Error).message); }
}
