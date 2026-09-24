import { db } from '../src/lib/db';
import { hashSecret } from '../src/lib/admin-auth';
async function main() {
  await db.adminUser.deleteMany({ where: { username: 'tmp_visual' } });
  await db.adminUser.create({
    data: {
      username: 'tmp_visual',
      displayName: 'فحص بصري',
      passwordHash: hashSecret('VisualPass123'),
      verificationCodeHash: hashSecret('VC-2468'),
      role: 'owner',
    },
  });
  console.log('temp owner ready');
  process.exit(0);
}
main();
