// U82 — persistence demo v2: write a marker INTO the real 'store' settings
// row through the studio API, survive a full dev-server restart, prove it,
// then restore the row byte-exactly without the marker.
// Usage: bun scripts/persist-demo.ts save   |   bun scripts/persist-demo.ts verify
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

const BASE = 'http://localhost:3000';
const TOKEN = 'u82-demo-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const mode = process.argv[2] || 'save';

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  await db.adminSession.create({
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u82-persist-demo' },
  });
  const H = { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' };

  if (mode === 'save') {
    const marker = 'u82-saved-' + Date.now();
    const res = await fetch(BASE + '/api/admin/settings', {
      method: 'POST', headers: H, body: JSON.stringify({ key: 'store', u82marker: marker }),
    });
    const row = await db.storeSettings.findUnique({ where: { key: 'store' } });
    const inRow = row ? (JSON.parse(row.value) as Record<string, unknown>).u82marker : null;
    console.log('save status:', res.status, '| marker:', marker);
    console.log('marker in database row NOW:', inRow);
    return;
  }

  if (mode === 'verify') {
    const row = await db.storeSettings.findUnique({ where: { key: 'store' } });
    const parsed = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    console.log('after full server restart, marker still in DB:', parsed.u82marker ?? 'GONE');
    // restore: strip every demo field (u82marker + the first attempt's
    // marker/savedAt that resolveKey merged into 'store'), write back exactly
    for (const junk of ['u82marker', 'marker', 'savedAt']) delete parsed[junk];
    await db.$executeRawUnsafe(
      'UPDATE StoreSettings SET value = ? WHERE key = ?',
      JSON.stringify(parsed), 'store'
    );
    const clean = await db.storeSettings.findUnique({ where: { key: 'store' } });
    const cleaned = JSON.parse(clean!.value) as Record<string, unknown>;
    console.log('demo fields cleaned up:', !('u82marker' in cleaned) && !('marker' in cleaned) && !('savedAt' in cleaned));
  }
}
main().finally(() => db.$disconnect());
