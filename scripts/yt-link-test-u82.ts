// U82 — end-to-end: a YouTube LINK as the maintenance video renders as a
// muted looping embed for visitors; then the previous state is restored.
// Usage: bun scripts/yt-link-test-u82.ts
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

const BASE = 'http://localhost:3000';
const TOKEN = 'u82-yt-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  await db.adminSession.create({
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u82-yt-test' },
  });
  const H = { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' };
  const before = JSON.parse((await db.storeSettings.findUnique({ where: { key: 'maintenance' } }))?.value || '{}');

  // 1) set a YouTube link and close the site
  const en = await fetch(BASE + '/api/admin/settings', {
    method: 'POST', headers: H,
    body: JSON.stringify({ key: 'maintenance', video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', enabled: true }),
  });
  console.log('set yt link + close:', en.status);
  const home = await fetch(BASE + '/');
  const html = await home.text();
  console.log('YT embed (nocookie) in visitor HTML:', html.includes('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  console.log('muted+loop params present:', html.includes('mute=1') && html.includes('loop=1'));
  console.log('maintenance headline present:', html.includes('الخدمة غير متاحة حاليًا'));

  // 2) restore exactly the previous state (uploaded file + whatever enabled was)
  const dis = await fetch(BASE + '/api/admin/settings', {
    method: 'POST', headers: H,
    body: JSON.stringify({ key: 'maintenance', video: before.video || '', enabled: before.enabled === true }),
  });
  const after = JSON.parse((await db.storeSettings.findUnique({ where: { key: 'maintenance' } }))?.value || '{}');
  console.log('restore:', dis.status, '| video back to previous:', after.video === (before.video || ''), '| enabled back:', after.enabled === (before.enabled === true), '| message kept:', (after.message || '').length > 0);
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  console.log('yt-link test done — state restored');
}

main().finally(() => db.$disconnect());
