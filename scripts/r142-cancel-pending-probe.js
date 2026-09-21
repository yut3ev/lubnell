#!/usr/bin/env node
// R142 — re-earning ladder rung 6 verification: the R117 cancelPending field
// + badge. Contract under test (digest: "R117: cancelPending badge riding
// load(); stats.cancelPending field added (ABSENT in the R65 recovery point)"):
//   F  stats.cancelPending — top-level field on /api/admin/stats, the EXACT
//      virtual-status formula the orders route's cancel-request tab uses
//      (cancelRequested && status != cancelled) — two paths, one number.
//   B  the badge — the studio sidebar's orders nav carries the cancel-pending
//      count (nav-pending treatment), fed by the orders route's per-tab count
//      that rides the shell's loadOrders() cycle — visible from ANY section,
//      so a customer's cancel request is never silently waiting.
// Pins (the R121 lesson: pin the virtual-status formula at BOTH sources and
// prove the paths agree; the R120 lesson: verbatim source pins for UI truth):
//   1. stats.cancelPending == DB count == orders-route counts["cancel-request"]
//      == the cancel-request tab's row count — FOUR paths, one number.
//   2. the rows named: exactly the era's pending set (the seed
//      LN-1789047046089 — the ONLY cancel request in the book; the resolve
//      dance stays the owner's, this probe never touches it).
//   3. verbatim source: the badge line, its loadOrders feed, the stats field.
// Writes: only its own tolerated auth.login row. ZERO orders/cancel writes.

const BASE = process.env.BASE || "http://localhost:3000";
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

let fails = 0;
let cooled = false;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};
async function j(path, opts) {
  const raw = await fetch(BASE + path, opts);
  const body = await raw.json().catch(() => null);
  return { status: raw.status, body, raw };
}

(async () => {
  const loginRowsBefore = await db.auditLog.count({ where: { action: "auth.login" } });
  const cancelRowsBefore = await db.auditLog.count({ where: { action: { contains: "cancel" } } });

  // 1. admin auth (read-only session)
  let login = await j("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
  });
  if (login.status === 429) {
    cooled = true;
    const wait = ((login.body && login.body.retryAfter) || 15) + 1;
    console.log(`INFO 429 limiter warm — cooling ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    login = await j("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
    });
  }
  if (login.status !== 200) { console.log("FAIL admin login", login.status); process.exit(1); }
  const cookie = (login.raw.headers.get("set-cookie") || "").split(";")[0];
  const H = { cookie };

  // 2. THE FIELD: stats.cancelPending (the digest's named delta)
  const stats = await j("/api/admin/stats", { headers: H });
  const cp = stats.body?.cancelPending;
  check("F stats.cancelPending exists as a top-level number", typeof cp === "number", `got ${JSON.stringify(cp)}`);

  // 3. THE ORACLE: the DB, same formula the two routes use
  const dbCount = await db.storeOrder.count({ where: { cancelRequested: true, status: { not: "cancelled" } } });
  check("F stats.cancelPending == DB count (same virtual-status formula)", cp === dbCount,
    `stats=${cp} db=${dbCount}`);
  check("F the number is the era's: exactly 1 (the seed — nothing else waits)",
    cp === 1, `cancelPending=${cp}`);

  // 4. TWO PATHS ONE NUMBER: the orders route's per-tab count (the badge feed)
  const list = await j("/api/admin/orders", { headers: H }); // the bare call loadOrders() makes
  const counts = list.body?.counts || {};
  check("P orders-route counts['cancel-request'] == stats.cancelPending (badge == field)",
    counts["cancel-request"] === cp, `counts=${JSON.stringify(counts["cancel-request"])} stats=${cp}`);

  // 5. THE TAB: the cancel-request view's rows agree too, and the row is named.
  //    (The paged branch is the endpoint the orders VIEW itself calls — the
  //    virtual cancel-request tab only exists there; the legacy bare call is
  //    the badge's feed and carries the same count since R117.)
  const tab = await j("/api/admin/orders?page=1&status=cancel-request&limit=100", { headers: H });
  const rows = tab.body?.orders || [];
  check("P cancel-request tab rows == the same number (three paths, one number)",
    rows.length === cp, `tab rows=${rows.length} cancelPending=${cp}`);
  check("P every tab row is a REAL pending cancel (cancelRequested && not cancelled)",
    rows.every((o) => o.cancelRequested === true && o.status !== "cancelled"),
    rows.map((o) => `${o.orderNumber}:${o.status}`).join(","));
  check("P the row is NAMED: the seed LN-1789047046089 is the waiting request",
    rows.some((o) => o.orderNumber === "LN-1789047046089"),
    rows.map((o) => o.orderNumber).join(","));

  // 6. VERBATIM SOURCE PINS (the R120 lesson — UI truth is pinned in source)
  const fs = require("fs");
  const studio = fs.readFileSync("src/components/lubnel/admin/studio.tsx", "utf8");
  const statsRoute = fs.readFileSync("src/app/api/admin/stats/route.ts", "utf8");
  check("S badge feed rides loadOrders: setCancelPending(data.counts?.['cancel-request'] ?? 0)",
    studio.includes('setCancelPending(data.counts?.["cancel-request"] ?? 0);'));
  check("S the badge renders on the orders nav, visible from ANY section",
    studio.includes('{id === "orders" && cancelPending > 0 && <b className="nav-pending">{cancelPending}</b>}'));
  check("S the stats field is the named R117 delta",
    statsRoute.includes("cancelPending: cancelPendingCount,"));
  check("S the formula is shared verbatim (two paths, one number at the source level)",
    statsRoute.includes('cancelRequested: true, status: { not: "cancelled" }'));
  check("S the legacy branch carries the same counts (the badge's feed, same formula)",
    fs.readFileSync("src/app/api/admin/orders/route.ts", "utf8")
      .includes('"cancel-request": cancelReqCount, gifts: giftCount'));

  // 7. HYGIENE: the resolve dance stays the owner's — the probe wrote nothing
  //    but its own tolerated login row.
  const cancelRowsAfter = await db.auditLog.count({ where: { action: { contains: "cancel" } } });
  const loginRowsAfter = await db.auditLog.count({ where: { action: "auth.login" } });
  const expectedLogins = loginRowsBefore + (cooled ? 2 : 1);
  check("hygiene: zero cancel/resolve rows written (the seed untouched, the dance is hers)",
    cancelRowsAfter === cancelRowsBefore, `cancel rows ${cancelRowsBefore} -> ${cancelRowsAfter}`);
  check(`hygiene: only the probe's own login row (${cooled ? "+2, limiter cooled" : "+1"})`,
    loginRowsAfter === expectedLogins, `login rows ${loginRowsBefore} -> ${loginRowsAfter}`);

  await db.$disconnect();
  console.log(`\nVERDICT: ${fails === 0 ? "R117 RE-EARNED — cancelPending is a first-class number on four agreeing paths (stats field == DB == badge feed == tab rows), the badge rides the studio's load cycle visible from any section, and the waiting seed is named. The owner's resolve dance is untouched." : `${fails} CHECK(S) FAILED — the rung-6 contract does not hold, fix before the ledger may claim it.`}`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
