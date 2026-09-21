/**
 * Delete the existing owner account — explicit user request
 * ("مش عارف اعمل اونر امسح الاونر القديم") so they can create their own
 * via the /admin setup form. Clears all admin sessions, writes audit.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const owner = await db.adminUser.findFirst({ where: { role: 'owner' } });
  if (!owner) {
    console.log('NO_OWNER_EXISTS');
    return;
  }
  await db.adminSession.deleteMany({});
  await db.adminUser.delete({ where: { id: owner.id } });
  await db.adminAudit.create({
    data: {
      actor: 'system-recovery',
      action: 'owner.deleted',
      entity: 'admin_user',
      entityId: owner.id,
    },
  });
  console.log('DELETED_OWNER_USERNAME: ' + owner.username);
  console.log('SESSIONS_CLEARED: all');
  console.log('AUDIT: owner.deleted written');
}

main()
  .catch((e) => {
    console.error('DELETE_FAILED', e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
