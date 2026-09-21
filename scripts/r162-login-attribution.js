// r162-login-attribution.js — read-only forensics: attribute login rows after R161 close
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // R161 close was ~02:00Z (10:00 +08). Window: everything after 01:55Z.
  const start = new Date('2026-09-12T01:55:00.000Z');
  const rows = await db.$queryRaw`
    SELECT id, action, entity, ip, userAgent, device, createdAt
    FROM AuditLog
    WHERE action LIKE ${'%login%'} AND createdAt >= ${start}
    ORDER BY id ASC`;
  console.log('login rows since 01:55Z:', rows.length);
  for (const r of rows) {
    console.log(`#${r.id} ${r.createdAt.toISOString()} ip=${r.ip} dev=${r.device} ua=${(r.userAgent||'').slice(0,40)}`);
  }
  const total = await db.$queryRaw`SELECT COUNT(*) AS c FROM AuditLog WHERE action LIKE ${'%login%'}`;
  console.log('total login rows:', total[0].c);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
