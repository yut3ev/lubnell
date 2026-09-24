// r168-ai-forensics.js — read-only: audit rows + DB state around the transient get_catalog FAIL
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const start = new Date(Date.now() - 25 * 60 * 1000);
  const rows = await db.$queryRaw`
    SELECT id, action, entity, entityId, createdAt, metadata
    FROM AuditLog
    WHERE createdAt >= ${start}
    ORDER BY id ASC`;
  console.log('audit rows last 25min:', rows.length);
  for (const r of rows) {
    const meta = r.metadata ? String(r.metadata).slice(0, 80) : '';
    console.log(`#${r.id} ${r.createdAt.toISOString()} ${r.action} ${r.entity} ${r.entityId || ''} ${meta}`);
  }
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
