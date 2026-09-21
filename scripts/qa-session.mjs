// U2-QA: mint a temporary admin session (x-admin-token) for integration QA.
// Usage: node scripts/qa-session.mjs mint|drop <token>
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const [, , action, tokenArg] = process.argv;

const owner = await db.adminUser.findFirst({ where: { role: 'owner' } });
if (!owner) { console.error('no owner'); process.exit(1); }

if (action === 'mint') {
  const token = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db.adminSession.create({
    data: {
      tokenHash,
      adminUserId: owner.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: '127.0.0.1',
      userAgent: 'u2-qa-script',
    },
  });
  console.log(token);
} else if (action === 'drop' && tokenArg) {
  const tokenHash = createHash('sha256').update(tokenArg).digest('hex');
  const r = await db.adminSession.deleteMany({ where: { tokenHash } });
  console.log('deleted', r.count);
} else {
  console.error('usage: mint | drop <token>');
}
await db.$disconnect();
