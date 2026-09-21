import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';

const re = /\/uploads\/[A-Za-z0-9._\/-]+/g;
function badRef(url: string): boolean {
  return url.startsWith('/uploads/') && !fs.existsSync(path.join(process.cwd(), 'public', url));
}

async function main() {
  const settings = await db.storeSettings.findMany();
  console.log('=== StoreSettings keys with /uploads refs ===');
  for (const s of settings) {
    const json = JSON.stringify(s.data ?? s);
    const refs = json.match(re) || [];
    if (refs.length) for (const r of new Set(refs)) console.log(s.key, '->', r, badRef(r) ? '** MISSING FILE **' : 'ok');
  }
  // homeSections lives under some key — print it raw for eyeballing
  const hs = settings.find(s => s.key === 'homeSections');
  if (hs) console.log('--- homeSections raw:', JSON.stringify(hs).slice(0, 2000));
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
