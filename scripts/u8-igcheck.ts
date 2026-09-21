import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const s = await db.storeSettings.findMany({ where: { key: { in: ['store', 'texts'] } } });
for (const row of s) {
  const v = JSON.parse(row.value);
  console.log(row.key, '->', JSON.stringify({ instagramUrl: v.instagramUrl, facebookUrl: v.facebookUrl, whatsappUrl: v.whatsappUrl }));
}
await db.$disconnect();
