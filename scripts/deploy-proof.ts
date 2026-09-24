// U83 — deploy-proof: create a test product ON PRODUCTION via the studio API,
// then (after a real redeploy) prove it survived, then clean up.
// Usage: bun scripts/deploy-proof.ts setup   |   bun scripts/deploy-proof.ts verify
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

const BASE = 'https://lubnel.vercel.app';
const TOKEN = 'u83-deploy-proof-' + randomBytes(6).toString('hex');
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const NAME = 'zz-بروف-نشر';
const MODE = process.argv[2] || 'setup';

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  await db.adminSession.create({
    data: { tokenHash: sha(TOKEN), adminUserId: owner.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u83-deploy-proof' },
  });

  if (MODE === 'setup') {
    const CAT = 'cmu18zzjl0000qb7inqxt6llz';
    const res = await fetch(BASE + '/api/admin/products', {
      method: 'POST',
      headers: { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameAr: NAME, nameEn: 'zz-deploy-proof', price: 1, categoryId: CAT, stock: 1 }),
    });
    const j: any = await res.json().catch(() => null);
    console.log('test product created on PRODUCTION:', res.status, '| slug:', j?.product?.slug);
    console.log('session token for verify step:', TOKEN);
    return;
  }

  if (MODE === 'verify') {
    const row = await db.product.findFirst({ where: { nameAr: NAME } });
    console.log('PROOF — test product still in production DB after redeploy:', row ? 'YES ✓ (slug ' + row.slug + ')' : 'GONE ✗');
    if (row) {
      const page = await fetch(BASE + '/p/' + row.slug);
      console.log('live-served on the NEW deployment:', page.status);
      await db.product.delete({ where: { id: row.id } });
      console.log('test product cleaned up');
    }
    await db.adminSession.deleteMany({ where: { tokenHash: sha(TOKEN) } });
  }
}
main().finally(() => db.$disconnect());
