// U83 — COMPREHENSIVE deploy-safety proof on PRODUCTION:
// setup  : add product + edit it + delete another + upload image + settings
//          marker → snapshot saved to ../deploy-proof-snapshot.json
// verify : after a real redeploy → EVERY operation must be exactly as left,
//          then all test rows are cleaned up.
// Usage: bun scripts/deploy-proof-comprehensive.ts setup | verify
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import { db } from './db';

const BASE = 'https://lubnel.vercel.app';
const TOKEN = 'u83-proof-c-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const SNAP = '../deploy-proof-snapshot.json';
const MODE = process.argv[2] || 'setup';
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
};

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  await db.adminSession.create({
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u83-proof-comprehensive' },
  });
  const H = { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' };
  const CAT = 'cmu18zzjl0000qb7inqxt6llz';

  if (MODE === 'setup') {
    // A) upload an image (goes to R2)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('file', new File([png], 'u83-proof.png', { type: 'image/png' }));
    const up = await fetch(BASE + '/api/admin/media', { method: 'POST', body: fd, headers: { 'x-admin-token': TOKEN } });
    const upJ: any = await up.json().catch(() => null);
    check('image upload', up.status === 200 && !!upJ?.url, `→ ${up.status}, url=${upJ?.url}`);

    // B) create product #1 WITH that image
    const c1 = await fetch(BASE + '/api/admin/products', {
      method: 'POST', headers: H,
      body: JSON.stringify({ nameAr: 'zz-بروف-شامل', nameEn: 'zz-proof-kept', price: 3.33, categoryId: CAT, stock: 2, image: upJ?.url }),
    });
    const c1J: any = await c1.json().catch(() => null);
    check('product #1 created (with image)', c1.status === 200 && !!c1J?.product?.id, `→ ${c1.status}`);

    // C) edit product #1 (price + name) — an EDIT must survive too
    const e1 = await fetch(BASE + `/api/admin/products/${c1J.product.id}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({ nameAr: 'zz-بروف-شامل-معدّل', price: 5.55 }),
    });
    check('product #1 edited', e1.status === 200, `→ ${e1.status}`);

    // D) create product #2 then DELETE it — the deletion must survive too
    const c2 = await fetch(BASE + '/api/admin/products', {
      method: 'POST', headers: H,
      body: JSON.stringify({ nameAr: 'zz-بروف-محذوف', nameEn: 'zz-proof-deleted', price: 1, categoryId: CAT }),
    });
    const c2J: any = await c2.json().catch(() => null);
    const d2 = await fetch(BASE + `/api/admin/products/${c2J.product.id}`, { method: 'DELETE', headers: { 'x-admin-token': TOKEN } });
    check('product #2 deleted', d2.status === 200, `→ ${d2.status}`);

    // E) settings change (marker field on the store row)
    const s1 = await fetch(BASE + '/api/admin/settings', {
      method: 'POST', headers: H, body: JSON.stringify({ key: 'store', u83proof: 'saved-before-deploy' }),
    });
    check('settings change', s1.status === 200, `→ ${s1.status}`);

    // snapshot for the verify step
    const fresh = await db.product.findUnique({ where: { id: c1J.product.id } });
    const snap = {
      keptProduct: { id: c1J.product.id, slug: fresh?.slug, nameAr: 'zz-بروف-شامل-معدّل', price: 5.55, image: upJ?.url },
      imageAssetId: upJ?.asset?.id,
      deletedProductId: c2J.product.id,
      marker: 'saved-before-deploy',
      counts: {
        products: await db.product.count(),
        settings: await db.storeSettings.count(),
        media: await db.mediaAsset.count(),
      },
    };
    writeFileSync(SNAP, JSON.stringify(snap, null, 2));
    console.log('snapshot written — now trigger the deploy, then run: bun scripts/deploy-proof-comprehensive.ts verify');
    await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
    return;
  }

  if (MODE === 'verify') {
    const snap = JSON.parse(readFileSync(SNAP, 'utf8'));

    // 1) the kept product: same id, same EDITED values, image still serves
    const p1 = await db.product.findUnique({ where: { id: snap.keptProduct.id } });
    check('product survived', !!p1, p1 ? `slug=${p1.slug}` : 'GONE');
    check('edit survived (name)', p1?.nameAr === snap.keptProduct.nameAr, `nameAr=${p1?.nameAr}`);
    check('edit survived (price)', Number(p1?.price) === snap.keptProduct.price, `price=${p1?.price}`);
    check('image reference intact', p1?.image === snap.keptProduct.image, `image=${p1?.image}`);
    const img = await fetch(BASE + snap.keptProduct.image);
    check('uploaded image still served (R2)', img.ok, `→ ${img.status}`);
    await img.arrayBuffer();

    // 2) the deleted product must STILL be gone
    const gone = await db.product.findUnique({ where: { id: snap.deletedProductId } });
    check('deletion survived', !gone, gone ? 'ROW CAME BACK!' : 'still deleted ✓');

    // 3) the settings change must still be there
    const st = await db.storeSettings.findUnique({ where: { key: 'store' } });
    const marker = st ? (JSON.parse(st.value) as Record<string, unknown>).u83proof : null;
    check('settings change survived', marker === snap.marker, `marker=${marker}`);

    // 4) global counts unchanged
    const counts = {
      products: await db.product.count(),
      settings: await db.storeSettings.count(),
      media: await db.mediaAsset.count(),
    };
    check('row counts stable', JSON.stringify(counts) === JSON.stringify(snap.counts), JSON.stringify(counts));

    // cleanup every trace
    if (p1) await db.product.delete({ where: { id: p1.id } });
    const imgRow = snap.imageAssetId ? await db.mediaAsset.findUnique({ where: { id: snap.imageAssetId } }) : null;
    if (imgRow) await db.mediaAsset.delete({ where: { id: imgRow.id } });
    const st2 = await db.storeSettings.findUnique({ where: { key: 'store' } });
    if (st2) {
      const parsed = JSON.parse(st2.value) as Record<string, unknown>;
      delete parsed.u83proof;
      await db.storeSettings.update({ where: { key: 'store' }, data: { value: JSON.stringify(parsed) } });
    }
    console.log(failures === 0 ? 'ALL PASS — every operation survived the deploy, cleanup done' : `${failures} FAILURE(S) — cleanup done`);
  }
}
main().finally(() => db.$disconnect());
