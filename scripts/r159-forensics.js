// r159-forensics.js — READ-ONLY ledger forensics for the R159 r139 transient.
// Same method as scripts/r153-forensics.js (Prisma $queryRaw, no writes, no schema drift).
// Face (a): ALL audit rows in the fine window covering this round's r140 -> r139(failed)
//           -> r138 -> r45 -> r139(re-run) sequence, any entity, ascending.
// Run: node scripts/r159-forensics.js
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // 2026-09-12 00:44:00 .. 00:48:30 UTC, epoch millis
  const start = Date.UTC(2026, 8, 12, 0, 44, 0);
  const end = Date.UTC(2026, 8, 12, 0, 48, 30);
  const rows = await db.$queryRaw`
    SELECT id, action, entity, entityId, ip, userAgent, device, metadata, createdAt
    FROM AuditLog
    WHERE createdAt >= ${start} AND createdAt <= ${end}
    ORDER BY id ASC`;
  console.log(`=== ALL rows ${new Date(start).toISOString()} .. ${new Date(end).toISOString()} (${rows.length}) ===`);
  for (const r of rows) {
    const t = new Date(Number(r.createdAt)).toISOString().slice(11, 23);
    const ua = r.userAgent ? String(r.userAgent).slice(0, 60) : '-';
    const dv = r.device ? String(r.device).slice(0, 20) : '-';
    const md = r.metadata ? String(r.metadata).slice(0, 80) : '-';
    console.log(`#${r.id} ${t} ${r.action} ${r.entity}:${r.entityId} ip=${r.ip} ua=[${ua}] dev=[${dv}] md=[${md}]`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch((e) => { console.error('FORENSICS-ERROR', e); process.exit(1); });
