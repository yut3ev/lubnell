/**
 * Owner credential reset — user requested recovery ("forgot owner password").
 * Uses the exact same scrypt format as src/lib/admin-auth.ts hashSecret():
 *   `${saltHex16}:${scryptSync(value, salt, 32).toString('hex')}`
 * Resets password + verification code, kills all admin sessions, writes audit.
 * Prints new credentials to stdout ONCE (not persisted anywhere else).
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function hashSecret(value: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 32).toString('hex')}`;
}

// unambiguous alphabet (no i/l/o/0/1) — 57 chars
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const pick = (n: number) =>
  Array.from(randomBytes(n))
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('');

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' } });
  if (!owner) throw new Error('NO_OWNER');

  const password = `Lb-${pick(4)}-${pick(4)}-${pick(4)}`; // ~1.2e21 combos
  const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000)); // 6-digit

  await db.adminUser.update({
    where: { id: owner.id },
    data: {
      passwordHash: hashSecret(password),
      verificationCodeHash: hashSecret(code),
      active: true,
    },
  });
  await db.adminSession.deleteMany({});
  await db.adminAudit.create({
    data: {
      actor: 'system-recovery',
      action: 'owner.password_reset',
      entity: 'admin_user',
      entityId: owner.id,
    },
  });

  console.log('USERNAME: ' + owner.username);
  console.log('PASSWORD: ' + password);
  console.log('VERIFICATION_CODE: ' + code);
  console.log('SESSIONS_CLEARED: all');
  console.log('AUDIT: owner.password_reset written');
}

main()
  .catch((e) => {
    console.error('RESET_FAILED', e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
