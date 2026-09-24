// U83 — production probe setup: mint an OWNER session + a limited STAFF admin
// (products.write/orders.read/orders.delete — deliberately NO media.write, NO
// settings.write) directly in Turso, so the deployed site can be tested.
// Usage: bun scripts/prod-probe-setup.ts
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { db } from './db';

const OWNER_TOKEN = 'u83-prod-owner-' + randomBytes(6).toString('hex');
const STAFF_TOKEN = 'u83-prod-staff-' + randomBytes(6).toString('hex');
const STAFF_USER = 'zz-prod-probe';
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('no owner user found');

  // staff account (clean previous probe rows first)
  await db.adminSession.deleteMany({ where: { admin: { username: STAFF_USER } } }).catch(() => undefined);
  await db.adminUser.deleteMany({ where: { username: STAFF_USER } });
  const salt = randomBytes(16).toString('hex');
  const enc = (v: string) => `${salt}:${scryptSync(v, salt, 32).toString('hex')}`;
  await db.adminUser.create({
    data: {
      username: STAFF_USER,
      displayName: 'U83 Prod Probe (temp)',
      passwordHash: enc('probe-pass-123'),
      verificationCodeHash: enc('probe-code-123'),
      role: 'staff',
      active: true,
      permissions: JSON.stringify(['orders.read', 'orders.delete', 'products.write']),
    },
  });
  const staff = await db.adminUser.findUnique({ where: { username: STAFF_USER } });
  if (!staff) throw new Error('staff create failed');

  for (const [token, adminUserId] of [[OWNER_TOKEN, owner.id], [STAFF_TOKEN, staff.id]] as const) {
    await db.adminSession.deleteMany({ where: { tokenHash: sha(token) } });
    await db.adminSession.create({
      data: { tokenHash: sha(token), adminUserId, expiresAt: new Date(Date.now() + 60 * 60 * 1000), ip: '127.0.0.1', userAgent: 'u83-prod-probe' },
    });
  }
  console.log('OWNER_TOKEN=' + OWNER_TOKEN);
  console.log('STAFF_TOKEN=' + STAFF_TOKEN);
}
main().finally(() => db.$disconnect());
