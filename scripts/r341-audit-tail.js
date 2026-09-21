// r341-audit-tail.js — READ-ONLY: dump audit rows after a given id (shape identification).
// Usage: node scripts/r341-audit-tail.js [afterId] [limit]
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const afterId = Number(process.argv[2] || 0);
const limit = Number(process.argv[3] || 14);

async function main() {
  const rows = await db.$queryRaw`
    SELECT id, action, entity, entityId, actorUsername, ip, createdAt
    FROM AuditLog
    WHERE id > ${afterId}
    ORDER BY id ASC LIMIT ${limit}`;
  console.log(`=== audit rows after #${afterId} (limit ${limit}) ===`);
  for (const r of rows) {
    const t = new Date(Number(r.createdAt)).toISOString();
    console.log(
      `#${r.id} ${t} ${r.action} entity=${r.entity}:${r.entityId} actor=${r.actorUsername} ip=${r.ip}`
    );
  }
}

main().then(() => db.$disconnect()).catch(e => { console.error("ERR", e.message); process.exit(1); });
