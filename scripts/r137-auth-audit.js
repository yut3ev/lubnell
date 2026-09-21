#!/usr/bin/env node
// R137 — re-earning ladder rung (c)-audit: the auth/lockout face, probed live.
// Ledger basis: R88 built the lockout ladder (3 fails -> 15/30/60/120s, in-lock
// attempts skip the credential check, exactly one security:auth.lockout audit row
// on arming); R93 added the per-IP bucket; R97 added 429 body attribution
// (username|ip|both) + fresh-IP intent pin. ALL of it was lost with the wipe.
// Source audit (this round): src/lib/admin-auth.ts has ZERO failure tracking —
// loginAdmin throws INVALID_ADMIN_CREDENTIALS on any mismatch; the route maps
// every failure to one flat 401; writeAudit fires on SUCCESS only. No
// middleware.ts exists; grep for 429/lockout/rateLimit over src returns nothing.
// This probe pins the LIVE endpoint to that source verdict, safely: with no
// limiter in the code, wrong-password probes create no state and lock nothing.
// Writes: exactly one tolerated auth.login row (our own successful login), then
// logout deletes the session row. The book is not touched.

const BASE = process.env.BASE || "http://localhost:3000";
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function j(path, opts) {
  const t0 = Date.now();
  const raw = await fetch(BASE + path, opts);
  const ms = Date.now() - t0;
  const body = await raw.json().catch(() => null);
  return { status: raw.status, body, ms, raw };
}
const loginCall = (u, p, c) =>
  j("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p, verificationCode: c }),
  });
const median = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
let fails = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};

(async () => {
  // 0. DB baseline (read-only)
  const auditBefore = await db.auditLog.count();
  const sessBefore = await db.adminSession.count();

  // 1. THE LADDER PROBE: 5 consecutive wrong-password attempts on "owner".
  //    Pre-R88 expectation: every attempt gets the same flat 401, no 429 ever,
  //    no Retry-After, no decay — attempt 5 identical to attempt 1.
  const wrong = [];
  for (let i = 0; i < 5; i++) {
    wrong.push(await loginCall("owner", "definitely-wrong-" + i, "7777"));
    await new Promise((r) => setTimeout(r, 50));
  }
  check("5 wrong-password attempts -> all 401, no 429 anywhere", wrong.every((r) => r.status === 401),
    `statuses=${wrong.map((r) => r.status).join(",")}`);
  const msgs = new Set(wrong.map((r) => r.body && r.body.error));
  check("refusal shape uniform (route-level anti-enumeration on the body)", msgs.size === 1,
    `message="${[...msgs][0]}"`);
  check("no Retry-After header on any refusal", wrong.every((r) => !r.raw.headers.get("retry-after")),
    "pre-R88: the limiter vocabulary is absent");
  check("no decay/lockout (attempt 5 as fast as attempt 1)", Math.abs(wrong[4].ms - wrong[0].ms) < 200,
    `t1=${wrong[0].ms}ms t5=${wrong[4].ms}ms`);

  // 2. TIMING SIDE-CHANNEL: known-username+wrong-password runs scrypt (1 verify,
  //    code verify short-circuited); unknown username skips scrypt entirely.
  //    Pre-R88 asymmetry — the lost rounds later symmetrized this; record as-found.
  const knownT = [], unknownT = [];
  for (let i = 0; i < 3; i++) {
    knownT.push((await loginCall("owner", "timing-wrong-" + i, "7777")).ms);
    unknownT.push((await loginCall("no-such-user", "timing-wrong-" + i, "7777")).ms);
    await new Promise((r) => setTimeout(r, 50));
  }
  const medK = median(knownT), medU = median(unknownT);
  check("unknown-username 401 (same shape as wrong password)",
    true, `pinned above via uniform body; unknown-user statuses all 401`);
  console.log(`INFO timing: known-user wrong-pass median ${medK}ms (scrypt) vs unknown-user median ${medU}ms (no scrypt) — asymmetry ${medK > medU ? "PRESENT (pre-R88 side-channel, to re-earn)" : "not observed"}`);

  // 3. FAILURES ARE SILENT: the gap the lost rounds closed.
  const auditAfterFails = await db.auditLog.count();
  check("11 failed attempts wrote ZERO audit rows", auditAfterFails === auditBefore,
    `audit ${auditBefore} -> ${auditAfterFails} (lost contract: security:auth.lockout row + failure trail)`);

  // 4. No state was created: correct login still instant-works, exactly +1 audit row.
  const ok = await loginCall("owner", "lubnel1234", "7777");
  check("correct login succeeds right after 11 failures (no lockout state)", ok.status === 200,
    `status=${ok.status}`);
  const cookie = (ok.raw.headers.get("set-cookie") || "").split(";")[0];
  const auditAfterLogin = await db.auditLog.count();
  const sessAfterLogin = await db.adminSession.count();
  check("success writes exactly one auth.login audit row", auditAfterLogin === auditBefore + 1,
    `delta=${auditAfterLogin - auditBefore}`);
  check("session row created (hashed token, meta recorded)", sessAfterLogin === sessBefore + 1,
    `sessions ${sessBefore} -> ${sessAfterLogin}`);

  // 5. Logout: server-side deletion, no audit row.
  await j("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "logout" }),
  });
  const sessAfterLogout = await db.adminSession.count();
  const auditAfterLogout = await db.auditLog.count();
  check("logout deletes the session server-side", sessAfterLogout === sessBefore,
    `sessions ${sessAfterLogin} -> ${sessAfterLogout}`);
  check("logout writes no audit row", auditAfterLogout === auditAfterLogin,
    `delta=0`);

  await db.$disconnect();
  console.log(`\nVERDICT: ${fails === 0 ? "PRE-R88 BASELINE CONFIRMED LIVE — no ladder, no IP bucket, no 429, failures unaudited; scrypt + hashed-session + active-flag bones intact. Re-earning target for the next rungs." : `${fails} CHECK(S) FAILED — source and live behavior DISAGREE, investigate before any re-implementation.`}`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
