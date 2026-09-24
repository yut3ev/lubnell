// U81 stress — upload a ~35MB video through the fixed streaming path,
// verify: 200 + row on disk + data=NULL + Range serving (206), then full cleanup.
// Usage: bun scripts/video-stress-u81.ts
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const TOKEN = 'u81-stress-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  await db.adminSession.create({
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u81-stress' },
  });

  const SIZE = 35 * 1024 * 1024;
  const buf = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i += 4096) buf[i] = (i / 4096) % 251;
  const fd = new FormData();
  fd.append('file', new File([buf], 'u81-stress.mp4', { type: 'video/mp4' }));
  const t0 = Date.now();
  const res = await fetch(BASE + '/api/admin/media', { method: 'POST', body: fd, headers: { 'x-admin-token': TOKEN } });
  const json: any = await res.json().catch(() => null);
  console.log('upload status:', res.status, 'in', Date.now() - t0, 'ms');
  const url: string | undefined = json?.url;
  const assetId: string | undefined = json?.asset?.id;
  if (res.status !== 200 || !url || !assetId) {
    console.log('UPLOAD FAILED:', JSON.stringify(json)?.slice(0, 300));
    await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
    return;
  }

  const row = await db.mediaAsset.findUnique({ where: { id: assetId }, select: { fileName: true, storageKey: true, data: true } });
  console.log('row.data is null:', row?.data === null || row?.data == null);
  console.log('file on disk:', existsSync('public/' + row?.storageKey), row?.storageKey);

  const rr = await fetch(BASE + url, { headers: { Range: 'bytes=0-1023' } });
  const rbuf = Buffer.from(await rr.arrayBuffer());
  console.log('range serve:', rr.status, 'bytes:', rbuf.length, 'content-range:', rr.headers.get('content-range'));

  const del = await fetch(BASE + '/api/admin/media?id=' + assetId, { method: 'DELETE', headers: { 'x-admin-token': TOKEN } });
  console.log('cleanup delete:', del.status, 'file removed:', !existsSync('public/' + row?.storageKey));
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  console.log('stress test done — cleaned');
}

main().finally(() => db.$disconnect());
