#!/usr/bin/env node
// R139 — re-earning ladder rung 3 verification: the R93 per-IP second bucket.
// Contract under test (digest line: "R93: second lockout bucket keyed by
// client IP (cross-username credential stuffing closed)"; mechanics re-derived
// in src/lib/admin-auth.ts, shared with the R88 username bucket):
//   P1 cross-username stuffing: failures from ONE IP across DIFFERENT
//      usernames arm the IP bucket even when no single username reaches 3
//   P2 the IP arming writes EXACTLY ONE row: entity=client_ip, entityId=IP
//   P3 in-lock: 429 without the credential check, no extension
//   P4 per-IP isolation: a FRESH IP is not punished (credential check runs)
//   P5 recovery + rehabilitation: after expiry a CORRECT login from the
//      stuffed IP passes and wipes the IP bucket
// Every request below carries an explicit X-Forwarded-For (requestMeta
// honors the first XFF hop — the recorded trade), so the probe's buckets are
// isolated from the shared localhost "unknown" bucket.
// Writes: only its own rows (1 client_ip arming row + its pre-wipe/P5 logins).
// R141 RE-RUN-SAFETY LESSON: the lockout buckets are in-memory and
// restart-wipe BY DESIGN, so fixed probe identities accumulate stale fails
// across same-process re-runs and eventually arm mid-probe (a false FAIL
// that cost a diagnosis this round). The probe now draws RANDOM identities
// per run (documentation-range IPs + suffixed usernames), keeping every pin
// delta-based and the probe trustworthy with or without a fresh restart.
// R196 SECOND-ORDER LESSON: random draws still collide once the space
// saturates. 47 of the old 80 octets (203.0.113.10..89) carried a permanent
// stale e1 fail (~59% false-FAIL per draw), and a THIRD draw of one octet
// (RUN=53: 03:45Z clean, then drawn twice consecutively this round) armed
// the never-wiped username buckets and the never-wiped FRESH_IP bucket
// mid-probe — decoded row-by-row via r196-run-collision-forensics.js.
// Fix: per-run username NONCE (never collides again) + both IPs drawn from
// the virgin TEST-NET-1 range 192.0.2.10..250 with distinct stuff/fresh
// octets (zero stale today; ~240-run runway before the same saturation math
// could return — rotate to the next documentation range if it ever does).
// R214 THIRD-ORDER LESSON (the saturation math RETURNED at run ~19, not 240):
// every green run leaves a permanent count-1 residue on BOTH drawn octets in
// the in-memory bucket (STUFF: P5's post-wipe failure; FRESH: P4's single
// 401) — 2 octets consumed per run, and FRESH draws are unrecordable in the
// audit trail (failures write no rows). R214 drew a stale FRESH octet
// (192.0.2.81) as STUFF and took the era's first 401,401,429 — while P2/P3/
// P4/P5 all PASSED, proving the R93 bucket mechanics intact (forensics via
// r214-virgin-range-forensics.js: 19 arming rows, ZERO octet reuse, so the
// stale octet could only be a prior FRESH draw). Fix: a persistent octet
// LEDGER — never draw an octet this suite has used before; seeded with every
// arming IP on record + R214's STUFF draw; both draws appended (and fenced)
// per run BEFORE any traffic. Pool < 8 aborts with the R196 rotation plan.
// R214 FIX v2 (same round — the v1 verification run hit a SECOND stale draw,
// 192.0.2.40, a prior FRESH octet NO ledger could ever have recorded, since
// failures write no audit rows): fencing alone cannot beat an unrecordable
// stale set. So the probe now ESTABLISHES its precondition through the
// contract's own recovery path — a correct owner login from the drawn STUFF
// IP (R93 "rehabilitation on success", the same login P5 already performs
// every round) wipes any residual count to 0 BEFORE P1 fires. A refusal
// (an armed draw, e.g. from outside traffic) fences the octet as
// "armed-refused", redraws from the pool, and retries once; a second
// refusal aborts rather than reporting a false FAIL. The ledger check now
// counts the pre-wipe login(s) alongside P5's.
// R238 FOURTH-ORDER LESSON (the R196 math returned through the FRESH path):
// v2 protected only the STUFF draw. A pre-ledger octet drawn TWICE as FRESH
// (both draws rowless — single 401s never arm, never write) carries count-2
// in-memory residue; its THIRD draw's P4 failure hits the arm threshold and
// writes a surprise client_ip row (R238: 192.0.2.137, ip 910->912, ledger
// FAIL while every functional pin PASSED — the mechanics were intact, the
// virgin-FRESH assumption was not). Fix: the SAME R93 rehabilitation for the
// FRESH draw BEFORE P4 — a correct owner login wipes any residue to 0; a
// refusal fences the octet as "armed-refused", redraws only the FRESH octet,
// retries once; a second refusal aborts (FRESH-PRE-WIPE-FAILED). The ledger
// check counts both pre-wipes via the existing preWipes counter.

const BASE = process.env.BASE || "http://localhost:3000";
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const fs = require("fs");
const path = require("path");
const NONCE = Math.random().toString(36).slice(2, 8); // per-run username suffix — never collides
// R214 octet LEDGER: never draw an octet the suite has used before (every run
// leaves a permanent count-1 residue on both its octets; FRESH draws are
// invisible to the audit trail, so the ledger is the only record).
const LEDGER_PATH = path.join(__dirname, ".r139-octet-ledger.json");
const LEDGER_SEED = ["115", "113", "250", "37", "44", "107", "98", "83", "70", "65", "43", "184", "110", "114", "227", "167", "176", "96", "81"]; // every 192.0.2.* arming IP on record (r214 forensics) incl. R214's stale STUFF draw .81
function drawOctets() {
  let used = {};
  try { used = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")); } catch { /* first run: seed below */ }
  for (const o of LEDGER_SEED) if (!used[o]) used[o] = { role: "seed-arming", t: "2026-09-12T15:15:37Z" };
  const RANGE = Array.from({ length: 241 }, (_, i) => String(10 + i)); // 10..250 documentation range
  const pool = RANGE.filter((o) => !used[o]);
  if (pool.length < 8) {
    console.error(`NO-POOL: only ${pool.length} virgin octets left — rotate r139 to the next documentation range (R196 header plan) before running again.`);
    process.exit(1);
  }
  const pick = () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const run = pick();
  const fresh = pick();
  used[run] = { role: "stuff", t: new Date().toISOString() };
  used[fresh] = { role: "fresh", t: new Date().toISOString() };
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(used, null, 1)); // fenced BEFORE any traffic
  console.log(`INFO octet ledger: STUFF=192.0.2.${run} FRESH=192.0.2.${fresh} (pool left: ${pool.length})`);
  return { RUN: run, FRESH: fresh };
}
let { RUN, FRESH } = drawOctets();
let STUFF_IP = `192.0.2.${RUN}`;
let FRESH_IP = `192.0.2.${FRESH}`; // distinct octet, same virgin documentation range
let preWipes = 0; // successful pre-wipe logins (each writes one auth.login row)
const U = (n) => `stuff-${n}-${RUN}-${NONCE}`;

let fails = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

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

  // ---- R214 fix v2: establish P1's precondition (count=0) via the R93 --------
  // ---- recovery path BEFORE any stuffed failure fires -------------------------
  const rehabilitate = async (ip) => {
    const r = await attempt(ip, "owner", "lubnel1234");
    if (r.status === 200) preWipes++;
    return r.status === 200;
  };
  let wiped = await rehabilitate(STUFF_IP);
  for (let tries = 0; !wiped && tries < 2; tries++) {
    console.log(`INFO pre-wipe refusal on ${STUFF_IP} (armed draw?) — fencing it and redrawing from the ledger pool...`);
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
    ledger[String(RUN)] = { role: "armed-refused", t: new Date().toISOString() };
    ({ RUN, FRESH } = drawOctets()); // re-fences a fresh pair before any further traffic
    STUFF_IP = `192.0.2.${RUN}`;
    FRESH_IP = `192.0.2.${FRESH}`;
    wiped = await rehabilitate(STUFF_IP);
  }
  if (!wiped) {
    console.error(`PRE-WIPE-FAILED: ${STUFF_IP} stays in-lock after a redraw — aborting rather than reporting a false FAIL.`);
    process.exit(1);
  }

  // ---- R238 fix: the SAME precondition established for the FRESH draw ---------
  // ---- (a third-draw FRESH octet carries count-2 pre-ledger residue; P4's -----
  // ---- single failure would then ARM it mid-probe — see header) ---------------
  wiped = await rehabilitate(FRESH_IP);
  for (let tries = 0; !wiped && tries < 2; tries++) {
    console.log(`INFO pre-wipe refusal on FRESH ${FRESH_IP} (armed draw?) — fencing it and redrawing the FRESH octet from the ledger pool...`);
    const ledgerMap = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
    ledgerMap[String(FRESH)] = { role: "armed-refused", t: new Date().toISOString() };
    const virginPool = Array.from({ length: 241 }, (_, i) => String(10 + i)).filter((o) => !ledgerMap[o]);
    if (virginPool.length < 8) {
      console.error(`NO-POOL: only ${virginPool.length} virgin octets left — rotate r139 to the next documentation range (R196 header plan) before running again.`);
      process.exit(1);
    }
    FRESH = virginPool[Math.floor(Math.random() * virginPool.length)];
    ledgerMap[FRESH] = { role: "fresh", t: new Date().toISOString() };
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledgerMap, null, 1)); // fenced before any further traffic
    FRESH_IP = `192.0.2.${FRESH}`;
    wiped = await rehabilitate(FRESH_IP);
  }
  if (!wiped) {
    console.error(`FRESH-PRE-WIPE-FAILED: ${FRESH_IP} stays in-lock after a redraw — aborting rather than reporting a false FAIL.`);
    process.exit(1);
  }

  // ---- P1: cross-username stuffing from ONE IP --------------------------------
  const a = await attempt(STUFF_IP, U("a"), "wrong-a-12345");
  const b = await attempt(STUFF_IP, U("b"), "wrong-b-12345");
  const c = await attempt(STUFF_IP, U("c"), "wrong-c-12345");
  check("P1 three DIFFERENT usernames, one IP -> flat 401s (no username bucket at 3)", [a, b, c].every((x) => x.status === 401),
    `statuses=${[a, b, c].map((x) => x.status).join(",")}`);

  // ---- the IP bucket arms on the 3rd cumulative failure -----------------------
  const d1 = await attempt(STUFF_IP, U("d"), "wrong-d-12345");
  check("P1 4th attempt from the stuffed IP (yet another username) -> 429", d1.status === 429,
    `status=${d1.status} elapsed=${d1.ms}ms`);
  check("P3 in-lock refusal skips the credential check (elapsed pin)", d1.ms < 15,
    `429 in ${d1.ms}ms (401s run scrypt ~${a.ms}ms)`);
  const ra1 = d1.raw.headers.get("retry-after");
  check("P3 Retry-After header == body.retryAfter, <= 15s", ra1 !== null && Number(ra1) === d1.body?.retryAfter && Number(ra1) <= 15,
    `header=${ra1} body=${d1.body?.retryAfter}`);

  // ---- P2: the arming row belongs to the IP, no username row ------------------
  const ipRows = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "client_ip" } });
  const userRows = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  check("P2 arming wrote EXACTLY ONE client_ip row", ipRows === ipRowsBefore + 1,
    `ip rows ${ipRowsBefore} -> ${ipRows}`);
  check("P2 NO username bucket armed (cross-username stuffing, not one-user brute force)", userRows === userRowsBefore,
    `admin_user rows unchanged at ${userRows}`);
  const row = await db.auditLog.findFirst({ where: { action: "security:auth.lockout", entity: "client_ip" }, orderBy: { id: "desc" } });
  check("P2 row shape (entityId = the stuffed IP, actor=system)", !!row && row.entityId === STUFF_IP && row.actorUsername === "system",
    row ? `entityId=${row.entityId} actor=${row.actorUsername} ip=${row.ip}` : "row missing");

  // ---- P3: no-extension ---------------------------------------------------------
  await sleep(1.3);
  const d2 = await attempt(STUFF_IP, U("d"), "wrong-d-12345");
  check("P3 no-extension: retryAfter shrinks (lock end unmoved)", d2.status === 429 && Number(d2.raw.headers.get("retry-after")) < Number(ra1),
    `retryAfter ${ra1} -> ${d2.raw.headers.get("retry-after")}`);
  check("P3 in-lock attempts wrote no extra rows", (await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "client_ip" } })) === ipRowsBefore + 1,
    "still exactly one");

  // ---- P4: a FRESH IP is not punished ------------------------------------------
  const d3 = await attempt(FRESH_IP, U("d"), "wrong-d-12345");
  check("P4 fresh IP, same username -> 401 (the lock is per-IP, credential check runs)", d3.status === 401,
    `status=${d3.status}`);

  // ---- P5: expiry, then a CORRECT login from the stuffed IP rehabilitates it ----
  const wait = Number(ra1) + 2;
  console.log(`INFO sleeping ${wait}s for the IP lock to expire...`);
  await sleep(wait);
  const ok = await attempt(STUFF_IP, "owner", "lubnel1234");
  check("P5 correct login from the STUFFED IP after expiry -> 200", ok.status === 200,
    `status=${ok.status}`);
  const e1 = await attempt(STUFF_IP, U("e"), "wrong-e-12345");
  check("P5 the success WIPED the IP bucket: next failure is a normal 401, not a 429", e1.status === 401,
    `status=${e1.status}`);

  // ---- final ledger counts -------------------------------------------------------
  const ipRowsAfter = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "client_ip" } });
  const userRowsAfter = await db.auditLog.count({ where: { action: "security:auth.lockout", entity: "admin_user" } });
  const loginRowsAfter = await db.auditLog.count({ where: { action: "auth.login" } });
  check(`ledger: exactly 1 client_ip row, 0 admin_user rows, ${1 + preWipes} auth.login = pre-wipes (stuff + fresh) + P5 (all self-produced)`,
    ipRowsAfter === ipRowsBefore + 1 && userRowsAfter === userRowsBefore && loginRowsAfter === loginRowsBefore + 1 + preWipes,
    `ip ${ipRowsBefore}->${ipRowsAfter}, user ${userRowsBefore}->${userRowsAfter}, login ${loginRowsBefore}->${loginRowsAfter} (+${preWipes} pre-wipe)`);

  await db.$disconnect();
  console.log(`\nVERDICT: ${fails === 0 ? "R93 PER-IP BUCKET RE-EARNED — cross-username stuffing from one IP is closed (IP bucket arms at 3 cumulative checked failures), fresh IPs unaffected, rehabilitation on success, one row per IP arming." : `${fails} CHECK(S) FAILED — the rung-3 contract does not hold as implemented, fix before the ledger may claim it.`}`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
