// R171 — read-only forensics for the r139 P1 FAIL (statuses=401,401,429).
// Hypothesis under test: ::1's in-memory IP bucket was pre-loaded with EXACTLY ONE
// checked failure before the FAIL run's P1 (1+2=3 -> arm on attempt 2, attempt 3 = 429).
// Surface: AuditLog only (bucket itself is in-memory, not queryable).
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const start = new Date('2026-09-12T04:22:00.000Z'); // 12:22 +08 — covers r142/r140/r139 window
  const rows = await db.$queryRaw`
    SELECT id, action, entity, entityId, ip, userAgent, device, createdAt
    FROM AuditLog
    WHERE createdAt >= ${start}
    ORDER BY id ASC`;
  console.log(`rows since 12:22 +08: ${rows.length}`);
  for (const r of rows) {
    const ua = r.userAgent == null ? 'null' : String(r.userAgent).slice(0, 40);
    console.log(
      `#${r.id} ${r.createdAt.toISOString()} ${r.action} ${r.entity}/${r.entityId} ip=${r.ip} dev=${r.device} ua=${ua}`
    );
  }
  // quick counts
  const fails = rows.filter(r => /fail|denied|refus|401|429/i.test(r.action));
  console.log(`--- failure-flavored action rows: ${fails.length}`);
}

main()
  .then(() => db.$disconnect())
  .catch(e => { console.error('FORENSICS ERROR:', e.message); return db.$disconnect(); });
