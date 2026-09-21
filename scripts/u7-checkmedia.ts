import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';

function existsFor(url: string | null | undefined): boolean {
  if (!url) return true;
  if (!url.startsWith('/uploads/')) return true; // static assets elsewhere
  return fs.existsSync(path.join(process.cwd(), 'public', url));
}

async function main() {
  const assets = await db.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 8 });
  console.log('=== recent MediaAssets ===');
  for (const a of assets) console.log(a.createdAt.toISOString(), a.url, '|', a.fileName, '| exists:', existsFor(a.url));

  const products = await db.product.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { slug: true, nameAr: true, image: true, gallery: true, createdAt: true } });
  console.log('=== recent products ===');
  for (const p of products) {
    const g: string[] = p.gallery ? JSON.parse(p.gallery) : [];
    const bad = [p.image, ...g].filter(u => !existsFor(u));
    console.log(p.createdAt.toISOString(), p.slug, '| img:', p.image, '| galleryN:', g.length, bad.length ? '| MISSING FILES: ' + bad.join(',') : '| all exist');
  }

  const cats = await db.category.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { slug: true, nameAr: true, image: true, pageImage: true, createdAt: true } });
  console.log('=== categories ===');
  for (const c of cats) console.log(c.slug, '| image:', c.image, existsFor(c.image) ? 'ok' : 'MISSING', '| pageImage:', c.pageImage, existsFor(c.pageImage) ? 'ok' : 'MISSING');

  const slides = await db.heroSlide.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('=== slides ===');
  for (const s of slides) console.log(s.id.slice(-6), '| img:', s.image, existsFor(s.image) ? 'ok' : 'MISSING', '| vid:', s.video, existsFor(s.video) ? 'ok' : 'MISSING', '| active:', s.active);

  const reviews = await db.review.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, name: true, image: true, approved: true, createdAt: true } });
  console.log('=== recent reviews ===');
  for (const r of reviews) console.log(r.createdAt.toISOString(), r.name, '| img:', r.image, existsFor(r.image) ? 'ok' : 'MISSING', '| approved:', r.approved);

  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
