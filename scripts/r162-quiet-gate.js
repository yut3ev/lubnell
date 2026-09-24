// r162-quiet-gate.js — read-only: report seconds since the last ::1 audit row
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  const rows = await db.$queryRaw`
    SELECT id, action, createdAt FROM AuditLog
    WHERE ip = ${'::1'} ORDER BY id DESC LIMIT 1`;
  if (!rows.length) { console.log('no ::1 rows ever'); return; }
  const last = rows[0];
  const ageSec = (Date.now() - last.createdAt.getTime()) / 1000;
  console.log(`last ::1 row #${last.id} (${last.action}) age=${ageSec.toFixed(1)}s`);
  if (ageSec >= 60) console.log('QUIET — gate open, run r138 now');
  else console.log(`NOT_QUIET — wait ${(60 - ageSec).toFixed(1)}s before r138`);
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
