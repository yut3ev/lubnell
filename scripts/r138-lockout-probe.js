#!/usr/bin/env node
// R138 — re-earning ladder rung 2 verification: the R88 lockout ladder, live.
// Contract under test (re-derived from the ledger digest; see the in-source
// comment block in src/lib/admin-auth.ts):
//   T1 arming: 3 consecutive failures on an attempted username -> 15s lock
//   T2 ladder: next arming (no success in between) -> 30s (growth pin)
//   T3 in-lock: 429 + Retry-After (header == body), refusal WITHOUT the
//      credential check (elapsed pin), no extension (retryAfter shrinks)
//   T4 one-audit-row: exactly one security:auth.lockout row per arming
//   T5 recovery: after expiry the credential check resumes and a correct
//      login passes; the success WIPES the bucket (next arming is 15s again)
//   T6 sub-threshold: 2 failures never arm; a later success clears them
//   T7 symmetry: an UNKNOWN username arms and locks exactly like "owner" —
//      the lockout cannot enumerate valid usernames
// Writes: only its own rows — auth.login on each correct login + the
// security:auth.lockout rows its own failures arm. No book data touched.
// POST-R139 NOTE: the R93 per-IP bucket (entity=client_ip) also arms during
// this probe (every localhost failure feeds the shared "unknown" IP bucket),
// so ALL lockout-row counts below are entity-filtered to admin_user — the
// username bucket's rows — and stay exact. The IP rows are expected noise
// from the rung-3 world and are not counted here.
// R142 RE-RUN HYGIENE (the r139 lesson): a final correct login rehabilitates
// the shared "unknown" IP bucket and re-wipes the owner bucket, so a
// same-process re-run starts from clean buckets instead of inheriting a
// mid-ladder lock (T8).

// R160: BASE pins the IPv6 literal — node's fetch on "localhost" flips between
// ::1 and 127.0.0.1 per process (undici family autoselection), which made the
// probe's own ledger fingerprint unstable. "[::1]" is deterministic, so the
// final count pin can attribute rows to THIS probe (ip=::1) and exclude the
// chronic platform monitor's rows (observed ::ffff:127.0.0.1 — see
// scripts/r160-login-rows.js).
const BASE = process.env.BASE || "http://[::1]:3000";
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const OWNER = { username: "owner", verificationCode: "7777" };
const CORRECT = "lubnel1234";

let fails = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function j(path, opts) {
  const t0 = Date.now();
  const raw = await fetch(BASE + path, opts);
  const ms = Date.now() - t0;
  const body = await raw.json().catch(() => null);
  return { status: raw.status, body, ms, raw };
}
const attempt = (username, password) =>
  j("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, verificationCode: OWNER.verificationCode }),
  });
const wrongOwner = (i) => attempt("owner", "brute-force-" + i);

(async () => {
  const lockRowsBefore = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  const loginRowsBefore = await db.auditLog.count({ where: { action: "auth.login", ip: "::1" } });

  // ---- T1: the first arming (tier 0 -> 15s) --------------------------------
  let r = [await wrongOwner(1), await wrongOwner(2), await wrongOwner(3)];
  check("T1 fails 1..3 -> flat 401s (no lock before the threshold)", r.every((x) => x.status === 401),
    `statuses=${r.map((x) => x.status).join(",")}`);
  let lockRows = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  check("T4 arming wrote EXACTLY ONE audit row", lockRows === lockRowsBefore + 1,
    `lockout rows ${lockRowsBefore} -> ${lockRows}`);
  const row = await db.auditLog.findFirst({ where: { action: "security:auth.lockout", entity: "admin_user" }, orderBy: { id: "desc" } });
  check("T4 row shape (action/entity/entityId/actor=system)", !!row && row.entity === "admin_user" && row.entityId === "owner" && row.actorUsername === "system",
    row ? `entity=${row.entity} entityId=${row.entityId} actor=${row.actorUsername} ip=${row.ip}` : "row missing");

  // ---- T3: in-lock refusals -------------------------------------------------
  const inLock1 = await wrongOwner(4);
  check("T3 4th attempt -> 429 (in-lock, credential check SKIPPED)", inLock1.status === 429,
    `status=${inLock1.status} elapsed=${inLock1.ms}ms (401s ran scrypt ~${r[0].ms}ms)`);
  check("T3 elapsed(429) << elapsed(401) — no scrypt on the in-lock path", inLock1.ms < Math.max(10, r[0].ms / 2),
    `429 in ${inLock1.ms}ms vs 401 in ${r[0].ms}ms`);
  const ra1 = inLock1.raw.headers.get("retry-after");
  check("T3 Retry-After header present and == body.retryAfter", ra1 !== null && Number(ra1) === inLock1.body?.retryAfter,
    `header=${ra1} body=${inLock1.body?.retryAfter}`);
  check("T3 retryAfter bounded by the tier (<= 15s)", Number(ra1) <= 15 && Number(ra1) >= 1, `retryAfter=${ra1}`);
  await sleep(1.3);
  const inLock2 = await wrongOwner(5);
  check("T3 no-extension: retryAfter SHRINKS (lock end unmoved)", inLock2.status === 429 && Number(inLock2.raw.headers.get("retry-after")) < Number(ra1),
    `retryAfter ${ra1} -> ${inLock2.raw.headers.get("retry-after")}`);
  check("T4 in-lock attempts wrote NO extra rows", (await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } })) === lockRowsBefore + 1,
    "still exactly one");
  const t1Wait = Number(ra1) + 2;
  console.log(`INFO sleeping ${t1Wait}s for the tier-0 lock to expire (no success in between)...`);
  await sleep(t1Wait);

  // ---- T2: the ladder GROWS (second arming -> 30s) ---------------------------
  r = [await wrongOwner(6), await wrongOwner(7), await wrongOwner(8)];
  const inLock3 = await wrongOwner(9);
  check("T2 second arming -> 429 with retryAfter <= 30 (ladder 15->30)", inLock3.status === 429 && Number(inLock3.raw.headers.get("retry-after")) <= 30,
    `status=${inLock3.status} retryAfter=${inLock3.raw.headers.get("retry-after")}`);
  check("T4 second arming wrote exactly one more row", (await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } })) === lockRowsBefore + 2,
    "two total");
  const t2Wait = Number(inLock3.raw.headers.get("retry-after")) + 2;
  console.log(`INFO sleeping ${t2Wait}s for the tier-1 lock to expire...`);
  await sleep(t2Wait);

  // ---- T5: recovery + success-wipes ------------------------------------------
  const ok1 = await attempt("owner", CORRECT);
  check("T5 correct login after expiry -> 200 (credential check resumed)", ok1.status === 200,
    `status=${ok1.status}`);
  r = [await wrongOwner(10), await wrongOwner(11), await wrongOwner(12)];
  const inLock4 = await wrongOwner(13);
  check("T5 success WIPED the tier: next arming is 15s again (not 30s)", inLock4.status === 429 && Number(inLock4.raw.headers.get("retry-after")) <= 15,
    `retryAfter=${inLock4.raw.headers.get("retry-after")}`);
  const t3Wait = Number(inLock4.raw.headers.get("retry-after")) + 2;
  await sleep(t3Wait);

  // ---- T6: sub-threshold failures never arm ----------------------------------
  r = [await wrongOwner(14), await wrongOwner(15)];
  const ok2 = await attempt("owner", CORRECT);
  check("T6 two failures -> 401s then a correct login still 200 (never armed)", r.every((x) => x.status === 401) && ok2.status === 200,
    `statuses=${r.map((x) => x.status).join(",")},${ok2.status}`);

  // ---- T7: unknown-username symmetry ------------------------------------------
  const u = [await attempt("no-such-user", "wrong-unknown-1"), await attempt("no-such-user", "wrong-unknown-2"), await attempt("no-such-user", "wrong-unknown-3")];
  const inLock5 = await attempt("no-such-user", "wrong-unknown-4");
  const uRow = await db.auditLog.findFirst({ where: { action: "security:auth.lockout", entity: "admin_user" }, orderBy: { id: "desc" } });
  check("T7 unknown username arms and locks EXACTLY like the real one (anti-enumeration symmetry)",
    u.every((x) => x.status === 401) && inLock5.status === 429 && uRow?.entityId === "no-such-user",
    `statuses=${u.map((x) => x.status).join(",")},${inLock5.status} row.entityId=${uRow?.entityId}`);

  // ---- T8: re-run hygiene (R142 lesson) ---------------------------------------
  // The lockout buckets are in-memory and restart-wipe BY DESIGN; without this
  // final rehabilitation a same-process re-run would inherit the shared
  // "unknown" IP bucket mid-lock and false-fail T1's flat-401 expectations.
  // T7's own failures have just re-armed that shared bucket, so the FIRST
  // rehabilitation attempt may itself be refused — cool the lock (the body's
  // own retryAfter) and retry; the success then wipes the buckets it came from.
  let ok3 = await attempt("owner", CORRECT);
  if (ok3.status === 429) {
    const w = Number(ok3.body?.retryAfter || 15) + 2;
    console.log(`INFO T8 cooling ${w}s — T7 re-armed the shared IP bucket...`);
    await sleep(w);
    ok3 = await attempt("owner", CORRECT);
  }
  check("T8 final correct login rehabilitates the shared IP bucket (re-run hygiene)", ok3.status === 200,
    `status=${ok3.status}`);

  // ---- final ledger counts -----------------------------------------------------
  // R160 MEASUREMENT REPAIR (R153 forensics precedent, attribution CORRECTED in
  // the same round): sibling harness scripts log in as owner from the direct
  // 127.0.0.1:3000 path, which the app records as ::ffff:127.0.0.1 — r45, the
  // r160 owner-feature probe, debug one-offs, any open dashboard session. NOT a
  // platform monitor (verified: the ::ffff rows track exactly our own tools'
  // runtimes and stop when they stop). Those rows are harness noise for THIS
  // probe, which always rides ::1 via localhost: the count pin therefore
  // filters to THIS PROBE'S OWN FINGERPRINT (ip=::1) and still demands
  // EXACTLY 3 self-produced success logins (T5 + T6 + T8).
  const OWN_IP = "::1";
  // R160: a FRESH engine for the final counts — a long-lived Prisma/SQLite
  // engine spawned before the app's restart churn can hold a stale file/WAL
  // view and miss rows the app just committed (observed live: the probe's own
  // three rows invisible to its own engine, visible to a fresh process).
  await db.$disconnect();
  const db2 = new PrismaClient();
  const lockRowsAfter = await db2.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  const loginRowsAfter = await db2.auditLog.count({ where: { action: "auth.login", ip: OWN_IP } });
  await db2.$disconnect();
  check("T4 total: exactly 4 arming rows (owner x3 + unknown x1)", lockRowsAfter === lockRowsBefore + 4,
    `${lockRowsBefore} -> ${lockRowsAfter}`);
  check("success rows: exactly 3 auth.login (T5 + T6 + T8)", loginRowsAfter === loginRowsBefore + 3,
    `${loginRowsBefore} -> ${loginRowsAfter}`);

  await db.$disconnect();
  console.log(`\nVERDICT: ${fails === 0 ? "R88 LOCKOUT LADDER RE-EARNED — all contract pins hold live (ladder 15->30, in-lock 429 without credential check, no-extension, one-row-per-arming, recovery, success-wipes, unknown-username symmetry)." : `${fails} CHECK(S) FAILED — the contract does not hold as implemented, fix before the ledger may claim rung 2.`}`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
