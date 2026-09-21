import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
const db = new PrismaClient();
const hash = (v: string) => { const salt = randomBytes(8).toString('hex'); return `${salt}:${scryptSync(v, salt, 32).toString('hex')}`; };
// temp admin
const up = await db.adminUser.upsert({
  where: { username: 'e2e_temp' },
  update: { passwordHash: hash('e2e-pass-123'), verificationCodeHash: hash('000000'), role: 'owner', active: true },
  create: { username: 'e2e_temp', displayName: 'E2E Temp', passwordHash: hash('e2e-pass-123'), verificationCodeHash: hash('000000'), role: 'owner', active: true },
});
// simulate 2 storefront visits (different sessions) + events
const v1 = await db.visit.upsert({
  where: { sessionId: 'e2e-session-a' },
  create: { sessionId: 'e2e-session-a', ip: '197.35.100.11', userAgent: 'Mozilla/5.0 (iPhone)', device: 'mobile', deviceLabel: 'Safari on iPhone', entryPath: '/', lastPath: '/p/university-box', events: 3 },
  update: { lastSeenAt: new Date(), events: 3 },
});
await db.visitEvent.deleteMany({ where: { visitId: v1.id } });
await db.visitEvent.createMany({ data: [
  { visitId: v1.id, path: '/', action: 'page_view' },
  { visitId: v1.id, path: '/p/university-box', action: 'product_view', detail: 'بوكس الجامعة' },
  { visitId: v1.id, path: '/p/university-box', action: 'add_to_cart', detail: 'بوكس الجامعة' },
]});
const v2 = await db.visit.upsert({
  where: { sessionId: 'e2e-session-b' },
  create: { sessionId: 'e2e-session-b', ip: '156.222.8.4', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', device: 'desktop', deviceLabel: 'Chrome on Windows', entryPath: '/c/all', lastPath: '/c/all', events: 1 },
  update: { lastSeenAt: new Date(), events: 1 },
});
await db.visitEvent.deleteMany({ where: { visitId: v2.id } });
await db.visitEvent.createMany({ data: [{ visitId: v2.id, path: '/c/all', action: 'page_view' }] });
console.log(JSON.stringify({ adminId: up.id, visits: [v1.id, v2.id] }));
await db.$disconnect();
