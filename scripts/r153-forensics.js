/* R153 forensics step 4: every client_ip row in the 203.0.113.x / 198.51.100.x
   families, plus fine-grained rows 23:15:50..23:19:30 — pin the failed run's
   octet, its arm-row timestamp, and the re-run's, so the residual question
   (P1 statuses 401,401,429) closes on data, not narrative. Read-only. */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const rows = await db.$queryRaw`
    SELECT id, action, entity, entityId, ip, createdAt
    FROM AuditLog
    WHERE entity = 'client_ip' AND (entityId LIKE '203.0.113.%' OR entityId LIKE '198.51.100.%')
    ORDER BY id DESC LIMIT 12`;
  console.log('=== LAST 12 doc-range client_ip rows (newest first) ===');
  for (const r of rows) {
    const t = new Date(Number(r.createdAt)).toISOString().slice(11, 23);
    console.log(`#${r.id} ${t} ${r.entity}:${r.entityId} (request ip=${r.ip})`);
  }

  const fine = await db.$queryRaw`
    SELECT id, action, entity, entityId, ip, createdAt
    FROM AuditLog
    WHERE createdAt >= ${Date.parse('2026-09-11T23:15:50Z')}
      AND createdAt <= ${Date.parse('2026-09-11T23:19:30Z')}
    ORDER BY id ASC`;
  console.log(`=== ALL rows 23:15:50..23:19:30 (${fine.length}) ===`);
  for (const r of fine) {
    const t = new Date(Number(r.createdAt)).toISOString().slice(11, 23);
    console.log(`#${r.id} ${t} ${r.action} ${r.entity}:${r.entityId} ip=${r.ip}`);
  }
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); })
  .finally(() => db.$disconnect());
