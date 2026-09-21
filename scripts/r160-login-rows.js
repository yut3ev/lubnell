// r160-login-rows.js — READ-ONLY: identify the extra auth.login writer.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const rows = await db.$queryRaw`
    SELECT id, action, entity, entityId, ip, userAgent, device, createdAt
    FROM AuditLog
    WHERE action = 'auth.login'
    ORDER BY id DESC LIMIT 10`;
  console.log("=== last 10 auth.login rows (newest first) ===");
  for (const r of rows) {
    const t = new Date(Number(r.createdAt)).toISOString();
    console.log(`#${r.id} ${t} ip=${r.ip} ua=[${r.userAgent}] dev=[${r.device}]`);
  }
}

main().then(() => db.$disconnect()).catch(e => { console.error("ERR", e.message); process.exit(1); });
