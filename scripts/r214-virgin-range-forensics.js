// R214 — read-only forensics for the FIRST virgin-era alarm (r139 P1 FAIL: 401,401,429 on 192.0.2.81)
// Hypothesis: STUFF_IP octet reuse across rounds leaves a residual per-IP failure count of 1
// (every green r139 run ends with one post-wipe checked failure on its STUFF_IP),
// so a reused octet turns the expected flat 401,401,401 into 401,401,429.
// READ-ONLY: only findMany/count — writes nothing.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const arms = await db.auditLog.findMany({
  where: { action: "security:auth.lockout", entity: "client_ip", entityId: { startsWith: "192.0.2." } },
  orderBy: { id: "asc" },
  select: { id: true, entityId: true, createdAt: true },
});
console.log(`== client_ip arming rows in 192.0.2.* (virgin era) — ${arms.length} rows ==`);
for (const a of arms) console.log(`  #${a.id} ${a.entityId} @${a.createdAt.toISOString()}`);

const seen = new Map();
for (const a of arms) seen.set(a.entityId, (seen.get(a.entityId) || 0) + 1);
const dupes = [...seen.entries()].filter(([, n]) => n > 1);
console.log(`\n== distinct IPs: ${seen.size}; REUSED (armed more than once): ${dupes.length} ==`);
for (const [ip, n] of dupes) console.log(`  ${ip}: ${n} arms`);

// login attempts from the virgin range carry the stuff-* usernames (octet embedded)
const stuffLogins = await db.auditLog.findMany({
  where: { action: "auth.login", actorUsername: { contains: "-stuff-" } },
  orderBy: { id: "asc" },
  select: { id: true, actorUsername: true, createdAt: true },
});
console.log(`\n== auth.login rows for stuff-* usernames (virgin-era r139 attempts) — ${stuffLogins.length} rows ==`);
const byIp = new Map();
for (const l of stuffLogins) {
  const m = l.actorUsername.match(/-stuff-(\d+)-(\d+)-([a-z0-9]+)$/i);
  const key = m ? `192.0.2.${m[1]}` : l.actorUsername;
  if (!byIp.has(key)) byIp.set(key, []);
  byIp.get(key).push(`#${l.id}@${l.createdAt.toISOString().slice(11, 19)}`);
}
for (const [ip, rows] of [...byIp.entries()].sort()) {
  console.log(`  ${ip}: ${rows.length} login row(s) [${rows.join(", ")}]`);
}

await db.$disconnect();
