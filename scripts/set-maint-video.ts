// U82 — set the maintenance emblem video back to the given URL (default: the
// owner's uploaded file that still lives in the media library).
// Usage: bun scripts/set-maint-video.ts [url]
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

const BASE = 'http://localhost:3000';
const TOKEN = 'u82-set-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

async function main() {
  // Git Bash mangles leading-slash argv into Windows paths — undo that
  let url = (process.argv[2] || '').replace(/^C:\/Program Files\/Git/, '').trim();
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  await db.adminSession.create({
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u82-set-video' },
  });
  const res = await fetch(BASE + '/api/admin/settings', {
    method: 'POST',
    headers: { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'maintenance', video: url, updatedAt: new Date().toISOString() }),
  });
  const row = JSON.parse((await db.storeSettings.findUnique({ where: { key: 'maintenance' } }))?.value || '{}');
  console.log('set status:', res.status, '| video now:', row.video || '(none)');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
}
main().finally(() => db.$disconnect());
