#!/usr/bin/env node
// R140 — re-earning ladder rung 4 verification: the R97 429 attribution.
// Contract under test (digest: "R97 added the bucket attribution to the 429
// body (username | ip | both) and made the refusal say WHY"):
//   A "username": a locked USERNAME binds a refusal even from a FRESH IP —
//     the global username bucket is the anti-brute-force side (the r97-era
//     fresh-IP-intent pin; DoS cost bounded by the 120s cap).
//   B "ip": a locked IP binds refusals for every username it tries.
//   C "both": when both buckets bound it, the body says so.
// Also: header == body.retryAfter everywhere, no credential check on any
// refusal (elapsed pin), and the Arabic message carries the reason.
// Writes: exactly 5 lockout rows (2 username + 3 ip) — all self-produced;
// zero auth.login rows.
// R142 RE-RUN-SAFETY (the r139 lesson): fixed identities accumulate stale
// fails in the by-design restart-wipe buckets across same-process re-runs
// (attr-a/b/c/d took 1 sub-threshold fail per run and would arm by run 3,
// false-failing the ledger and the attribution pins). Identities are now
// per-run (time-tagged usernames + a random documentation octet for the
// IPs). Residual risk: a same-octet collision between two runs BOTH within
// a 120s lock window (p=1/80 back-to-back) — the canonical one-run-per-round
// cadence has zero risk since every lock expires long before the next round.

const BASE = process.env.BASE || "http://localhost:3000";
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const TAG = Date.now().toString(36).slice(-6);
const RUN = Math.floor(Math.random() * 80) + 10; // 10..89
const A_IP = `198.51.100.${RUN}`;
const A_FRESH = `198.51.100.${RUN + 100}`; // never collides with the fail-carrying range
const B_IP = `198.51.100.${RUN + 1}`;
const C_IP = `198.51.100.${RUN + 2}`;
const AU = (s) => `attr-${s}-${TAG}`;

let fails = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};

async function j(path, opts) {
  const t0 = Date.now();
  const raw = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers || {}), "x-forwarded-for": opts.ip } });
  const ms = Date.now() - t0;
  const body = await raw.json().catch(() => null);
  return { status: raw.status, body, ms, raw };
}
const attempt = (ip, username, password) =>
  j("/api/admin/auth", {
    method: "POST",
    ip,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, verificationCode: "7777" }),
  });

(async () => {
  const userRowsBefore = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  const ipRowsBefore = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "client_ip" } });
  const loginRowsBefore = await db.auditLog.count({ where: { action: "auth.login" } });

  // ---- Case A: locked USERNAME binds a FRESH IP (the intent pin) --------------
  for (let i = 1; i <= 3; i++) await attempt(A_IP, AU("u"), "wrong-u-" + i);
  const a = await attempt(A_FRESH, AU("u"), "wrong-u-4");
  check("A fresh IP on a locked username still 429s (designed anti-brute-force trade)", a.status === 429,
    `status=${a.status} elapsed=${a.ms}ms`);
  check("A attribution = username", a.body?.lockedBy === "username", `lockedBy=${a.body?.lockedBy}`);
  check("A the message says WHY (user-attributed Arabic)", typeof a.body?.error === "string" && a.body.error.includes("لهذا المستخدم"),
    `"${a.body?.error}"`);

  // ---- Case B: locked IP binds every username it tries --------------------------
  await attempt(B_IP, AU("a"), "wrong-a-1");
  await attempt(B_IP, AU("b"), "wrong-b-1");
  await attempt(B_IP, AU("c"), "wrong-c-1");
  const b = await attempt(B_IP, AU("d"), "wrong-d-1");
  check("B 4th username from a stuffed IP -> 429", b.status === 429, `status=${b.status}`);
  check("B attribution = ip (no username bucket armed)", b.body?.lockedBy === "ip", `lockedBy=${b.body?.lockedBy}`);
  check("B the message says WHY (network-attributed Arabic)", typeof b.body?.error === "string" && b.body.error.includes("من هذه الشبكة"),
    `"${b.body?.error}"`);

  // ---- Case C: both buckets arm on the same failures ----------------------------
  for (let i = 1; i <= 3; i++) await attempt(C_IP, AU("both"), "wrong-x-" + i);
  const c = await attempt(C_IP, AU("both"), "wrong-x-4");
  check("C locked username + locked IP together -> 429", c.status === 429, `status=${c.status}`);
  check("C attribution = both", c.body?.lockedBy === "both", `lockedBy=${c.body?.lockedBy}`);

  // ---- universal refusal shape ---------------------------------------------------
  for (const [name, r] of [["A", a], ["B", b], ["C", c]]) {
    check(`${name} Retry-After header == body.retryAfter, elapsed < 15ms (no credential check)`,
      r.raw.headers.get("retry-after") === String(r.body?.retryAfter) && r.ms < 15,
      `header=${r.raw.headers.get("retry-after")} body=${r.body?.retryAfter} elapsed=${r.ms}ms`);
  }

  // ---- ledger: exactly the self-produced rows -------------------------------------
  const userRowsAfter = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  const ipRowsAfter = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "client_ip" } });
  const loginRowsAfter = await db.auditLog.count({ where: { action: "auth.login" } });
  check(`ledger: +2 username rows (${AU("u")}, ${AU("both")}) +3 ip rows (${A_IP}/${B_IP}/${C_IP}), 0 logins`,
    userRowsAfter === userRowsBefore + 2 && ipRowsAfter === ipRowsBefore + 3 && loginRowsAfter === loginRowsBefore,
    `user ${userRowsBefore}->${userRowsAfter}, ip ${ipRowsBefore}->${ipRowsAfter}, login ${loginRowsBefore}->${loginRowsAfter}`);

  await db.$disconnect();
  console.log(`\nVERDICT: ${fails === 0 ? "R97 ATTRIBUTION RE-EARNED — the refusal says WHY: lockedBy = username | ip | both, the fresh-IP-intent trade stands (a locked username binds fresh IPs), header/body/elapsed shape intact across all three cases." : `${fails} CHECK(S) FAILED — fix before the ledger may claim rung 4.`}`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
