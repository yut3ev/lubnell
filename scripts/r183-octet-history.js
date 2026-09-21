#!/usr/bin/env node
// R183 forensics — verify the octet-residue model (R153 class, 6th appearance).
// Model: every r139 run leaves ONE invisible sub-threshold count on its STUFF_IP
// (the e1 check after the P5 wipe). A later run drawing the SAME octet within
// the in-memory bucket's TTL window starts with r=1 -> P1 = 401,401,429.
// This script lists ALL historical client_ip arming rows on the 203.0.113.x
// documentation range so the FAIL runs' octets (.33 and .15) can be matched
// against recent STUFF_IPs. Read-only.

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const rows = await db.$queryRaw`
    SELECT id, entityId, createdAt
    FROM AuditLog
    WHERE action = 'security:auth.lockout'
      AND entity = 'client_ip'
      AND entityId LIKE '203.0.113.%'
    ORDER BY id DESC
    LIMIT 30`;
  console.log("=== last 30 client_ip arming rows on 203.0.113.x (newest first) ===");
  for (const r of rows) {
    console.log(`#${r.id} ${r.entityId.toISOString?.() ?? r.createdAt} octet=${r.entityId}`);
  }
  const octets = rows.map((r) => r.entityId.split(".")[3]);
  const uniq = [...new Set(octets)];
  console.log(`\ndistinct octets in window: ${uniq.join(", ")}`);
  console.log(`.33 present: ${octets.includes("33")} | .15 present: ${octets.includes("15")}`);
  await db.$disconnect();
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
