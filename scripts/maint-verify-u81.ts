// U81 maintenance verify — duplicate cleanup, reference guard, and a real
// close-the-site test proving the emblem video renders for visitors.
// Usage: bun scripts/maint-verify-u81.ts
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { db } from './db';

const BASE = 'http://localhost:3000';
const TOKEN = 'u81-maint-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

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
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u81-maint-verify' },
  });
  const H = { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' };

  const maintRow = await db.storeSettings.findUnique({ where: { key: 'maintenance' } });
  const maint = JSON.parse(maintRow?.value || '{}');
  const videoUrl: string = maint.video || '';
  console.log('configured video:', videoUrl || '(none)');
  if (!videoUrl) {
    // U82 hardening — an empty value made `html.includes('')` vacuously pass
    console.log('FAIL no video configured — nothing to verify');
    await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
    process.exit(1);
  }

  // 1) the in-use (referenced) video must be REFUSED by the delete guard
  const libRes = await fetch(BASE + '/api/admin/media', { headers: { 'x-admin-token': TOKEN } });
  const lib = await libRes.json();
  const referenced = (lib.media || []).find((m: any) => m.url === videoUrl);
  if (referenced) {
    const r = await fetch(BASE + `/api/admin/media?id=${referenced.id}`, { method: 'DELETE', headers: { 'x-admin-token': TOKEN } });
    check('delete guard blocks in-use video', r.status === 409, `DELETE in-use video → ${r.status} (expect 409)`);
  } else {
    check('configured video in library', false, 'maintenance video URL not found in media library');
  }

  // 2) the orphan duplicate (older identical upload) must be deletable
  const orphan = (lib.media || []).find((m: any) => m.url !== videoUrl && String(m.mimeType || '').startsWith('video/'));
  if (orphan) {
    const r = await fetch(BASE + `/api/admin/media?id=${orphan.id}`, { method: 'DELETE', headers: { 'x-admin-token': TOKEN } });
    const gone = !existsSync('public/' + orphan.storageKey);
    check('orphan duplicate deleted', r.status === 200 && gone, `DELETE orphan → ${r.status}, file removed=${gone}`);
  } else {
    console.log('no orphan video found (already clean)');
  }

  // 3) close the site for real and prove the video renders for visitors
  const en = await fetch(BASE + '/api/admin/settings', { method: 'POST', headers: H, body: JSON.stringify({ key: 'maintenance', enabled: true, updatedAt: new Date().toISOString() }) });
  check('close site', en.status === 200, `POST maintenance enabled=true → ${en.status}`);
  const home = await fetch(BASE + '/');
  const html = await home.text();
  const headline = html.includes('الخدمة غير متاحة حاليًا');
  check('maintenance screen served', home.status === 200 && headline, `GET / → ${home.status}, headline=${headline}`);
  check('emblem video SSR with owner URL', html.includes(videoUrl), `video URL present in HTML=${html.includes(videoUrl)}`);
  check('storefront hidden while closed', !html.includes('/p/'), 'no product links in closed HTML');
  const vr = await fetch(BASE + videoUrl, { headers: { Range: 'bytes=0-1023' } });
  check('video Range serve (206)', vr.status === 206, `GET video Range → ${vr.status}`);
  await vr.arrayBuffer();

  // 4) restore: site back open exactly as it was
  const dis = await fetch(BASE + '/api/admin/settings', { method: 'POST', headers: H, body: JSON.stringify({ key: 'maintenance', enabled: false }) });
  const home2 = await fetch(BASE + '/');
  const html2 = await home2.text();
  check('reopen site', dis.status === 200 && home2.status === 200 && !html2.includes('الخدمة غير متاحة حاليًا'), `GET / after reopen → ${home2.status}, maintenance screen gone=${!html2.includes('الخدمة غير متاحة حاليًا')}`);
  const after = JSON.parse((await db.storeSettings.findUnique({ where: { key: 'maintenance' } }))?.value || '{}');
  check('message+video preserved', after.video === videoUrl && typeof after.message === 'string' && after.message.length > 0, `video kept=${after.video === videoUrl}, message kept=${(after.message || '').length > 0}`);

  // 5) disk hygiene: exactly one video asset + one video file remain
  const videoRows = await db.mediaAsset.count({ where: { mimeType: { startsWith: 'video' } } });
  const videoFiles = readdirSync('public/uploads').filter((f) => /\.(mp4|webm|mov|m4v)$/i.test(f));
  check('single video copy on disk+DB', videoRows === 1 && videoFiles.length === 1, `video rows=${videoRows}, video files=${videoFiles.length}`);

  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  console.log(failures === 0 ? 'ALL PASS — site restored open, disk clean' : `${failures} FAILURE(S)`);
}

main().finally(() => db.$disconnect());
