#!/usr/bin/env node
// R147 — re-earning ladder rung 10: the R91 analytics v5 contract.
// Contract under test (digest: "R91: windowUnits (units across ALL lines) +
// compare-ranges (analytics v5, byte-exact previous-window construction)"):
//   W  totals.windowUnits — units (sum of item quantity) across ALL order
//      lines in the SAME 7-day window the R34 pair denominates: EVERY line
//      of EVERY order — NO status filter — the same universe ordersWeek
//      counts (a cancelled order still happened inside the window).
//   C  totals.windowUnitsPrevWeek — the BYTE-EXACT previous-window
//      construction: the same json_each scan over the disjoint range
//      [prevStart, start), where prevStart = start − 7d is the SAME
//      arithmetic the R34 gift pair already shares — same-shape vs
//      same-shape, never a re-derived approximation on the far side.
// Proofs:
//   1. windowUnits == the DB oracle over [start, now): ALL lines, ALL
//      statuses — and the ALL is proven LIVE: the era's window contains a
//      cancelled order (LN-1788982865427, one 1-unit line), so ALL-lines
//      (15) must differ from the non-cancelled-only variant (14).
//   2. windowUnitsPrevWeek == the DB oracle over [prevStart, start).
//   3. Ranges shared, not invented: totals.ordersWeek == DB count >= start
//      and totals.ordersPrevWeek == DB count [prevStart, start) — the R91
//      pair rides the SAME two ranges as the R34 pair (trap 3: anchors come
//      from the endpoint the board calls; trap 1: ordersWeek is ORDER-COUNT
//      vocabulary, windowUnits is LINE-UNITS vocabulary — they share the
//      range, not the unit).
//   4. Disjoint construction: oracle(current) + oracle(prev) == oracle over
//      the union — no order is ever counted on both sides of a delta.
//   5. Verbatim source pins: the two scans (block-scoped: NO status filter
//      inside the windowUnits WHERE), the totals pair, the shared prevStart
//      arithmetic.
// Writes: only its own tolerated auth.login row. GET-only otherwise.

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
  const orderRowsBefore = await db.storeOrder.count();
  const cancelRowsBefore = await db.auditLog.count({ where: { action: { contains: "cancel" } } });

  // 1. admin auth (read-only session) — the r142 pattern: one tolerated
  //    login, cool-and-retry on the limiter's own 429.
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

  // 2. the endpoint the board calls (trap 3 — anchors come from HERE)
  const stats = await j("/api/admin/stats", { headers: { cookie } });
  check("A stats endpoint answers 200 for the authed board", stats.status === 200, `status=${stats.status}`);
  const t = stats.body && stats.body.totals;

  // 3. THE ORACLE — the byte-exact same Date arithmetic the route runs
  //    (local midnight −6d; prevStart = start − 7d), on the same host, so
  //    the bounds are identical by construction.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const prevStart = new Date(start.getTime() - 7 * 86_400_000);
  const oracleUnits = async (fromMs, toMs) => {
    const upper = toMs != null ? `AND o.createdAt < ${toMs}` : "";
    const rows = await db.$queryRawUnsafe(
      `SELECT COALESCE(SUM(CAST(json_extract(j.value, '$.quantity') AS INTEGER)), 0) AS units
       FROM StoreOrder o, json_each(o.items) j
       WHERE o.items IS NOT NULL AND json_valid(o.items)
         AND o.createdAt >= ${fromMs} ${upper}`,
    );
    return Number(rows[0].units);
  };
  const oracleAll = await oracleUnits(start.getTime()); // [start, now) — ALL statuses
  const oraclePrev = await oracleUnits(prevStart.getTime(), start.getTime()); // [prevStart, start)
  const oracleUnion = await oracleUnits(prevStart.getTime()); // disjoint-union proof
  const oracleNonCancelledAll = Number(
    (await db.$queryRawUnsafe(
      `SELECT COALESCE(SUM(CAST(json_extract(j.value, '$.quantity') AS INTEGER)), 0) AS units
       FROM StoreOrder o, json_each(o.items) j
       WHERE o.items IS NOT NULL AND json_valid(o.items)
         AND o.status != 'cancelled' AND o.createdAt >= ${start.getTime()}`,
    ))[0].units,
  );
  const countWin = await db.storeOrder.count({ where: { createdAt: { gte: start } } });
  const countPrev = await db.storeOrder.count({ where: { createdAt: { gte: prevStart, lt: start } } });
  const cancelledInWindow = await db.storeOrder.findMany({
    where: { status: "cancelled", createdAt: { gte: start } },
    select: { orderNumber: true },
  });

  // 4. W — windowUnits: present, ALL-lines, oracle-exact
  check("W totals.windowUnits EXISTS on the stats payload", typeof (t && t.windowUnits) === "number",
    `value=${t && t.windowUnits}`);
  check("W windowUnits == DB oracle over [start, now) — ALL lines, ALL statuses",
    t && t.windowUnits === oracleAll, `payload=${t && t.windowUnits} oracle=${oracleAll}`);
  check("W the ALL is proven LIVE: window != non-cancelled-only (the window holds a cancelled line)",
    oracleAll !== oracleNonCancelledAll,
    `all=${oracleAll} non-cancelled=${oracleNonCancelledAll} cancelled-in-window=${cancelledInWindow.map((o) => o.orderNumber).join(",") || "none"}`);
  check("W windowUnits == non-cancelled units + every cancelled line's units (ALL = the union)",
    t && t.windowUnits === oracleNonCancelledAll + (oracleAll - oracleNonCancelledAll),
    `${oracleNonCancelledAll} + ${oracleAll - oracleNonCancelledAll} = ${oracleAll}`);

  // 5. C — compare-ranges: the byte-exact previous window
  check("C totals.windowUnitsPrevWeek EXISTS on the stats payload", typeof (t && t.windowUnitsPrevWeek) === "number",
    `value=${t && t.windowUnitsPrevWeek}`);
  check("C windowUnitsPrevWeek == DB oracle over [prevStart, start) — same scan, disjoint range",
    t && t.windowUnitsPrevWeek === oraclePrev, `payload=${t && t.windowUnitsPrevWeek} oracle=${oraclePrev}`);
  check("C disjoint construction: oracle(current) + oracle(prev) == oracle(union) — no double count",
    oracleAll + oraclePrev === oracleUnion, `${oracleAll} + ${oraclePrev} = ${oracleUnion}`);

  // 6. R — the ranges are SHARED with the R34 pair, not invented (trap 1:
  //    ordersWeek is order-count vocabulary; windowUnits is line-units
  //    vocabulary — same range, different unit)
  check("R totals.ordersWeek == DB count over [start, now) — the SAME range windowUnits rides",
    t && t.ordersWeek === countWin, `payload=${t && t.ordersWeek} count=${countWin}`);
  check("R totals.ordersPrevWeek == DB count over [prevStart, start) — the SAME range the compare side rides",
    t && t.ordersPrevWeek === countPrev, `payload=${t && t.ordersPrevWeek} count=${countPrev}`);

  // 7. S — verbatim source pins (the R120 lesson)
  const fs = require("fs");
  const route = fs.readFileSync("src/app/api/admin/stats/route.ts", "utf8");
  const pinScan = "SELECT COALESCE(SUM(CAST(json_extract(j.value, '$.quantity') AS INTEGER)), 0) AS units";
  const firstAt = route.indexOf(pinScan);
  const secondAt = firstAt === -1 ? -1 : route.indexOf(pinScan, firstAt + 1);
  check("S the windowUnits scan exists verbatim (the route's own json_each machinery)",
    firstAt !== -1);
  check("S the compare scan exists verbatim (TWO scans, one construction)", secondAt !== -1);
  const block1 = firstAt === -1 ? "" : route.slice(firstAt, firstAt + 400);
  const block2 = secondAt === -1 ? "" : route.slice(secondAt, secondAt + 420);
  check("S block-scoped: the windowUnits WHERE carries NO status filter (ALL lines is the contract)",
    block1.includes("o.createdAt >= ${start.getTime()}") && !block1.includes("status"),
    "no `status` anywhere in the scan block");
  check("S block-scoped: the compare scan rides [prevStart, start) — both bounds named",
    block2.includes("o.createdAt >= ${prevStart.getTime()}") && block2.includes("o.createdAt < ${start.getTime()}"));
  check("S the pair ships in totals (windowUnits + windowUnitsPrevWeek, the PrevWeek convention)",
    route.includes("windowUnits,") && route.includes("windowUnitsPrevWeek,"));
  check("S the compare side reuses the R34 prevStart arithmetic (byte-exact by shared construction)",
    route.includes("const prevStart = new Date(start.getTime() - 7 * 86_400_000);"));

  // 8. HYGIENE — GET-only after one tolerated login; zero order writes.
  const orderRowsAfter = await db.storeOrder.count();
  const cancelRowsAfter = await db.auditLog.count({ where: { action: { contains: "cancel" } } });
  const loginRowsAfter = await db.auditLog.count({ where: { action: "auth.login" } });
  const expectedLogins = loginRowsBefore + (cooled ? 2 : 1);
  check("hygiene: zero order rows written (the oracle only read)", orderRowsAfter === orderRowsBefore,
    `orders ${orderRowsBefore} -> ${orderRowsAfter}`);
  check("hygiene: zero cancel/resolve rows written (the dance stays hers)",
    cancelRowsAfter === cancelRowsBefore, `cancel rows ${cancelRowsBefore} -> ${cancelRowsAfter}`);
  check(`hygiene: only the probe's own login row (${cooled ? "+2, limiter cooled" : "+1"})`,
    loginRowsAfter === expectedLogins, `login rows ${loginRowsBefore} -> ${loginRowsAfter}`);

  await db.$disconnect();
  console.log(`\nVERDICT: ${fails === 0 ? "R91 RE-EARNED — windowUnits counts EVERY line of EVERY order in the shared 7-day range (ALL proven live: the cancelled line is counted), windowUnitsPrevWeek is the byte-exact same construction over the disjoint previous range, and both ride the SAME ranges as the R34 pair. Analytics v5's vocabulary is in the payload." : `${fails} CHECK(S) FAILED — the analytics v5 contract does not hold, fix before the ledger may claim it.`}`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
