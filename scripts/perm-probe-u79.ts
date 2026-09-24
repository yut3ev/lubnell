// U79 probe — temp staff admin exercising the fixed permission gates, then full cleanup.
// Usage: bun scripts/perm-probe-u79.ts
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { db } from './db';

const BASE = 'http://localhost:3000';
const USERNAME = 'zz-perm-probe';
const TOKEN = 'u79-probe-' + randomBytes(8).toString('hex');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

async function setPerms(perms: string[]) {
  await db.adminUser.update({
    where: { username: USERNAME },
    data: { permissions: JSON.stringify(perms) },
  });
}

async function call(method: string, path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, {
    method,
    ...init,
    headers: { 'x-admin-token': TOKEN, ...(init?.headers || {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
}

async function main() {
  // cleanup any previous probe rows
  await db.adminSession.deleteMany({ where: { admin: { username: USERNAME } } }).catch(() => undefined);
  await db.adminUser.deleteMany({ where: { username: USERNAME } });
  await db.rolePermission.deleteMany({ where: { roleName: 'zz-probe-role' } });

  const salt = randomBytes(16).toString('hex');
  const enc = (v: string) => `${salt}:${scryptSync(v, salt, 32).toString('hex')}`;
  const admin = await db.adminUser.create({
    data: {
      username: USERNAME,
      displayName: 'U79 Perm Probe',
      passwordHash: enc('probe-pass-123'),
      verificationCodeHash: enc('probe-code-123'),
      role: 'staff',
      active: true,
      permissions: '[]',
    },
  });
  await db.adminSession.create({
    data: {
      tokenHash: sha(TOKEN),
      adminUserId: admin.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      ip: '127.0.0.1',
      userAgent: 'u79-probe',
    },
  });

  // 1) reviews with ONLY reviews.* (before fix: route demanded products.* → 401)
  await setPerms(['reviews.read', 'reviews.write']);
  const r1 = await call('GET', '/api/admin/reviews');
  check('reviews.read', r1.status === 200, `GET /api/admin/reviews → ${r1.status}`);

  // 2) order delete with orders.delete (before fix: owner-only; bogus id → 404 proves gate passed)
  await setPerms(['orders.read', 'orders.delete']);
  const r2 = await call('DELETE', '/api/admin/orders/zz-bogus-id');
  check('orders.delete', r2.status === 404, `DELETE bogus order → ${r2.status}`);

  // 2b) negative control: granted orders.read only → must stay 401
  await setPerms(['orders.read']);
  const r2b = await call('DELETE', '/api/admin/orders/zz-bogus-id');
  check('orders.delete guard intact', r2b.status === 401, `DELETE without perm → ${r2b.status}`);

  // 3) media upload with products.write only, NO media.write (before fix: 401)
  await setPerms(['products.write']);
  const fd = new FormData();
  fd.append('file', new File([PNG], 'u79-probe.png', { type: 'image/png' }));
  fd.append('altText', 'u79 probe');
  const r3 = await call('POST', '/api/admin/media', { body: fd });
  check('media upload via products.write', r3.status === 200, `POST /api/admin/media → ${r3.status}`);
  const mediaRow = await db.mediaAsset.findFirst({ where: { fileName: { contains: 'u79-probe.png' } } });
  if (mediaRow) {
    const r3b = await call('DELETE', `/api/admin/media?id=${mediaRow.id}`);
    check('media library delete stays media.write', r3b.status === 401, `DELETE media without media.write → ${r3b.status}`);
  } else if (r3.status === 200) {
    check('media row exists', false, 'upload returned 200 but no MediaAsset row found');
  }

  // 4) roles save with users.write (before fix: phantom roles.write → 401 for everyone incl. owner)
  await setPerms(['users.read', 'users.write']);
  const r4 = await call('POST', '/api/admin/roles', {
    body: JSON.stringify({ roleName: 'zz-probe-role', permissions: [] }),
    headers: { 'Content-Type': 'application/json' },
  });
  check('roles.save via users.write', r4.status === 200, `POST /api/admin/roles → ${r4.status}`);

  // cleanup everything the probe created
  await db.mediaAsset.deleteMany({ where: { fileName: { contains: 'u79-probe.png' } } });
  await db.rolePermission.deleteMany({ where: { roleName: 'zz-probe-role' } });
  await db.adminSession.deleteMany({ where: { adminUserId: admin.id } });
  await db.adminUser.delete({ where: { id: admin.id } });
  console.log(failures === 0 ? 'ALL PASS — probe rows cleaned' : `${failures} FAILURE(S) — probe rows cleaned`);
}

main().finally(() => db.$disconnect());
