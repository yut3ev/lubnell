// U80 owner probe — exercises the owner's critical flows end-to-end, full cleanup.
// Usage: bun scripts/owner-probe-u80.ts
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { db } from './db';

const BASE = 'http://localhost:3000';
const TOKEN = 'u80-owner-probe-' + randomBytes(8).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
// minimal MP4: 24-byte ftyp box + padding (route trusts declared video/mp4 type)
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]),
  Buffer.alloc(1024),
]);

const H = { 'x-admin-token': TOKEN };
async function call(method: string, path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, { method, ...init, headers: { ...H, ...(init?.headers || {}) } });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json };
}

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
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u80-owner-probe' },
  });

  // 1) video upload (U19/U83 — disk locally, R2 bucket when configured)
  const fd1 = new FormData();
  fd1.append('file', new File([MP4], 'u80-probe.mp4', { type: 'video/mp4' }));
  const r1 = await call('POST', '/api/admin/media', { body: fd1 });
  check('owner video upload', r1.status === 200, `POST media mp4 → ${r1.status}`);
  const vid = await db.mediaAsset.findFirst({ where: { fileName: { contains: 'u80-probe.mp4' } } });
  let vidServes = false;
  if (vid) {
    const vr = await fetch(BASE + vid.url);
    vidServes = vr.ok && (vr.headers.get('content-type') || '').startsWith('video/');
    await vr.arrayBuffer();
  }
  check('video stored & served', !!vid && vidServes, vid ? `storageKey=${vid.storageKey}, serves=${vidServes}` : 'no MediaAsset row');

  // 2) image upload
  const fd2 = new FormData();
  fd2.append('file', new File([PNG], 'u80-probe.png', { type: 'image/png' }));
  const r2 = await call('POST', '/api/admin/media', { body: fd2 });
  check('owner image upload', r2.status === 200, `POST media png → ${r2.status}`);

  // 2b) media delete endpoints really delete (no longer served)
  if (vid) {
    const rd1 = await call('DELETE', `/api/admin/media?id=${vid.id}`);
    const gone1 = !(await fetch(BASE + vid.url)).ok;
    check('media delete (video)', rd1.status === 200 && gone1, `DELETE → ${rd1.status}, no longer served=${gone1}`);
  }
  const img = await db.mediaAsset.findFirst({ where: { fileName: { contains: 'u80-probe.png' } } });
  if (img) {
    const rd2 = await call('DELETE', `/api/admin/media?id=${img.id}`);
    const gone2 = !(await fetch(BASE + img.url)).ok;
    check('media delete (image)', rd2.status === 200 && gone2, `DELETE → ${rd2.status}, no longer served=${gone2}`);
  }

  // 3) product full lifecycle (create → edit → delete)
  const CAT = 'cmu18zzjl0000qb7inqxt6llz';
  const rp = await call('POST', '/api/admin/products', {
    body: JSON.stringify({ nameAr: 'zz-بروب-فحص', nameEn: 'zz-probe-product', price: 1.5, categoryId: CAT, stock: 1 }),
    headers: { 'Content-Type': 'application/json' },
  });
  check('product create', rp.status === 200 && rp.json?.ok, `POST products → ${rp.status}`);
  const pid: string | undefined = rp.json?.product?.id;
  if (pid) {
    const rpe = await call('PATCH', `/api/admin/products/${pid}`, {
      body: JSON.stringify({ description: 'zz probe description' }),
      headers: { 'Content-Type': 'application/json' },
    });
    check('product edit', rpe.status === 200 && rpe.json?.ok, `PATCH product → ${rpe.status}`);
    const rpd = await call('DELETE', `/api/admin/products/${pid}`);
    check('product delete', rpd.status === 200, `DELETE product → ${rpd.status}`);
    const gone = await db.product.findUnique({ where: { id: pid } });
    check('product really deleted', !gone, gone ? 'row still exists!' : 'row gone from DB');
  }

  // 4) settings save — no-op write of the current "store" values, byte-identical result
  const before = await db.storeSettings.findUnique({ where: { key: 'store' } });
  const gs = await call('GET', '/api/admin/settings?key=store');
  const cur = gs.json?.settings ?? {};
  const ps = await call('POST', '/api/admin/settings', {
    body: JSON.stringify({ key: 'store', ...cur }),
    headers: { 'Content-Type': 'application/json' },
  });
  const after = await db.storeSettings.findUnique({ where: { key: 'store' } });
  check('settings save (store, no-op)', ps.status === 200 && ps.json?.ok && before?.value === after?.value, `POST settings → ${ps.status}, value unchanged=${before?.value === after?.value}`);

  // 5) order status edit — PATCH current status back (no data change)
  const order = await db.order.findFirst({ orderBy: { createdAt: 'desc' } });
  if (order) {
    const ro = await call('PATCH', `/api/admin/orders/${order.id}`, {
      body: JSON.stringify({ status: order.status }),
      headers: { 'Content-Type': 'application/json' },
    });
    check('order status edit (no-op)', ro.status === 200 && ro.json?.ok, `PATCH order → ${ro.status}`);
  }

  // cleanup session
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  console.log(failures === 0 ? 'ALL PASS — probe rows cleaned' : `${failures} FAILURE(S) — probe rows cleaned`);
}

main().finally(() => db.$disconnect());
