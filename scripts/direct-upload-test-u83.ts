// U83-PHASE4 — end-to-end test of the direct browser→R2 upload flow:
// presign → PUT (large 35MB body) → confirm → serve → cleanup.
// Usage: bun scripts/direct-upload-test-u83.ts
import { createHash, randomBytes } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { db } from './db';

const BASE = process.env.PROD_URL || 'http://localhost:3000';
const TOKEN = 'u83-direct-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

// admin credentials hash lookup only — we mint a session directly
const MODE = process.argv[2] || 'local';

async function main() {
  if (MODE === 'local') {
    // mint an owner session directly in the DB (local Turso-backed dev server)
    const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
    if (!owner) throw new Error('no owner');
    await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
    await db.adminSession.create({
      data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u83-direct-test' },
    });
  } else {
    const prodToken = process.env.PROD_TOKEN!;
    if (!prodToken) throw new Error('PROD_TOKEN missing');
    // production: paste an existing admin token via env (no DB access from here)
    console.log('using provided production token');
    (globalThis as any).__PROD = prodToken;
  }

  const H: Record<string, string> = MODE === 'local'
    ? { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' }
    : { 'x-admin-token': (globalThis as any).__PROD, 'Content-Type': 'application/json' };

  // 1) presign
  const pre = await fetch(BASE + '/api/admin/media/presign', {
    method: 'POST', headers: H,
    body: JSON.stringify({ fileName: 'u83-direct-test.mp4', contentType: 'video/mp4' }),
  });
  const preJson: any = await pre.json().catch(() => null);
  console.log('presign:', pre.status, '| key:', preJson?.key);
  if (pre.status !== 200 || !preJson?.uploadUrl) { console.log('ABORT'); return; }

  // 2) PUT a real 35MB payload straight to R2
  const SIZE = 35 * 1024 * 1024;
  const buf = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i += 4096) buf[i] = (i / 4096) % 251;
  const t0 = Date.now();
  const put = await fetch(preJson.uploadUrl, {
    method: 'PUT', body: new Uint8Array(buf), headers: { 'Content-Type': 'video/mp4' },
  });
  console.log('direct PUT:', put.status, 'in', Date.now() - t0, 'ms (35MB)');

  // 3) confirm → MediaAsset row
  const conf = await fetch(BASE + '/api/admin/media/confirm', {
    method: 'POST', headers: H,
    body: JSON.stringify({ key: preJson.key, fileName: 'u83-direct-test.mp4', mimeType: 'video/mp4' }),
  });
  const confJson: any = await conf.json().catch(() => null);
  console.log('confirm:', conf.status, '| url:', confJson?.url);
  if (conf.status !== 200 || !confJson?.url) { console.log('CONFIRM FAILED'); return; }

  // 4) serve + Range through the app
  const vr = await fetch(BASE + confJson.url, { headers: { Range: 'bytes=0-1023' } });
  console.log('range serve:', vr.status, 'bytes:', (await vr.arrayBuffer()).byteLength);

  // 5) cleanup (delete the asset via the guarded endpoint)
  const del = await fetch(BASE + `/api/admin/media?id=${confJson.asset.id}`, { method: 'DELETE', headers: { 'x-admin-token': H['x-admin-token'] } });
  console.log('cleanup delete:', del.status);
  if (MODE === 'local') await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  console.log('direct-upload test done');
}

main().finally(() => db.$disconnect());
