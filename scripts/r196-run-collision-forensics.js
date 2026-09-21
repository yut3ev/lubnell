#!/usr/bin/env node
// R196 — forensics for the r139 double-FAIL: RUN-collision hypothesis.
// Hypothesis: the rerun drew RUN=53 (P2 row shape: entityId=203.0.113.53).
// Username buckets (stuff-a..e-53, NEVER wiped — no successful login ever
// targets them) and the FRESH_IP bucket 203.0.113.153 (never wiped) accumulate
// permanent stale fails across same-RUN draws; the STUFF_IP bucket is wiped by
// each run's P5 success but left at 1 by that run's e1 attempt. Prediction:
//   - client_ip arming rows for 203.0.113.53: TWO prior (runs #1,#2) + rerun = 3
//   - client_ip arming rows for 203.0.113.153: ZERO prior + rerun = 1
//   - admin_user arming rows for stuff-*-53: exactly the rerun's 4 (a,b,d,e)
// Read-only. No writes.

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const fmt = (d) => d.toISOString().replace("T", " ").replace("Z", "Z");

async function main() {
  const ipRows = await db.auditLog.findMany({
    where: { action: "security:auth.lockout", entity: "client_ip", entityId: { startsWith: "203.0.113." } },
    orderBy: { id: "asc" },
    select: { id: true, entityId: true, createdAt: true },
  });
  const byIp = {};
  for (const r of ipRows) (byIp[r.entityId] ||= []).push(r);
  const entries = Object.entries(byIp).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  console.log(`== client_ip lockout arming rows, entityId 203.0.113.* — ${ipRows.length} rows across ${entries.length} distinct IPs ==`);
  for (const [ip, rows] of entries) {
    const marks = rows.map((r) => `#${r.id}@${fmt(r.createdAt)}`).join(", ");
    console.log(`  ${ip}: ${rows.length} arm(s) [${marks}]${ip === "203.0.113.53" ? "   <-- rerun STUFF_IP (RUN=53)" : ip === "203.0.113.153" ? "   <-- rerun FRESH_IP (53+100)" : ""}`);
  }

  const userRows = await db.auditLog.findMany({
    where: { action: "security:auth.lockout", entity: "admin_user" },
    orderBy: { id: "asc" },
    select: { id: true, entityId: true, createdAt: true },
  });
  console.log(`\n== admin_user lockout arming rows (ALL TIME) — ${userRows.length} rows ==`);
  for (const r of userRows) console.log(`  #${r.id} entityId=${r.entityId} @${fmt(r.createdAt)}`);

  // run 1's STUFF_IP: the arming row just before the rerun's — print the last 6 ip rows for context
  console.log("\n== last 6 client_ip arming rows (chronological tail) ==");
  for (const r of ipRows.slice(-6)) console.log(`  #${r.id} ${r.entityId} @${fmt(r.createdAt)}`);

  await db.$disconnect();
}

main().catch((e) => { console.error("FORENSICS ERROR", e); process.exit(1); });
