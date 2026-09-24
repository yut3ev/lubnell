// Mint a temporary AdminSession for API/UI verification, or clean it up.
// Usage: bun mint-test-session.ts mint  |  bun mint-test-session.ts clean
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const TOKEN = 'visits-test-token-2026-09-18-zz';

async function main() {
  const mode = process.argv[2] || 'mint';
  const tokenHash = createHash('sha256').update(TOKEN).digest('hex');
  if (mode === 'clean') {
    await db.adminSession.deleteMany({ where: { tokenHash } });
    console.log('test session removed');
    return;
  }
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');
  await db.adminSession.deleteMany({ where: { tokenHash } });
  await db.adminSession.create({
    data: {
      tokenHash,
      adminUserId: owner.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: '127.0.0.1',
      userAgent: 'test-harness',
    },
  });
  console.log(TOKEN);
}
main().finally(() => db.$disconnect());
