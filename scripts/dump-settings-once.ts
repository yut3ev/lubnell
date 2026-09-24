import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const rows = await db.storeSettings.findMany();
  for (const r of rows) {
    const v = r.value.length > 300 ? r.value.slice(0, 300) + '…' : r.value;
    console.log(`[${r.key}] = ${v}`);
  }
  await db.$disconnect();
}
main();
