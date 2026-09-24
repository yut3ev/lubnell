// r283-precounts.js — READ-ONLY pre/post-face counters for R283 (and reusable).
// Fresh-engine discipline (R160 lesson): single PrismaClient, no long-lived engine.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const label = process.argv[2] || "PRE";

async function main() {
  const loginTotal = await db.auditLog.count({ where: { action: "auth.login" } });
  const loginV6 = await db.auditLog.count({ where: { action: "auth.login", ip: "::1" } });
  const armUser = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  const armIp = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "client_ip" } });
  const admins = await db.adminUser.count();
  const lastLogin = await db.auditLog.findFirst({ where: { action: "auth.login" }, orderBy: { id: "desc" } });
  const lastLoginS = lastLogin ? `#${lastLogin.id} ip=${lastLogin.ip} ua=[${String(lastLogin.userAgent || "").slice(0, 40)}] at=${new Date(Number(lastLogin.createdAt)).toISOString()}` : "none";
  console.log(`[${label}] auth.login total=${loginTotal} (::1=${loginV6}) | arming admin_user=${armUser} client_ip=${armIp} | admins=${admins}`);
  console.log(`[${label}] last login row: ${lastLoginS}`);
}
main().then(() => db.$disconnect()).catch((e) => { console.error("ERR", e.message); process.exit(1); });
