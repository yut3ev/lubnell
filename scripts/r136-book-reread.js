#!/usr/bin/env node
// R136 book re-read — the R123 tool REBORN for the post-wipe R65 recovery point.
// The original scripts/r123-book-reread.js was written against the R120-era
// endpoints (stats?window=14, bare /api/admin/orders) and died with the wipe.
// This adaptation uses the R65-era vocabulary (verified against the restored
// app): /api/admin/stats (no window param), /api/admin/orders?page=1&limit=100,
// login via verificationCode + cookie. Anchors = the R65-era book:
// 6 orders / 2127 gross / 1981 net / 5 netOrders / 0 gifts / cancelPending 1
// (the seed LN-1789047046089 only) / LUBNEL10 board 3 / wishAdds 1 / universe 9.
// Read-only: the only writes are its own tolerated login rows. ZERO clicks on
// orders / wishlist / resolve — the ledger stays untouched.

const BASE = process.env.BASE || "http://localhost:3000";

async function j(path, opts) {
  const raw = await fetch(BASE + path, opts);
  const body = await raw.json().catch(() => null);
  return { status: raw.status, body, raw };
}

(async () => {
  // 1. admin auth (read-only session; same discipline as every probe round)
  const login = await j("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
  });
  if (login.status === 429) {
    const wait = ((login.body && login.body.retryAfter) || 15) + 1;
    console.log(`429 limiter warm — cooling ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    const retry = await j("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
    });
    if (retry.status !== 200) { console.log("FAIL admin login after cooldown", retry.status); process.exit(1); }
    Object.assign(login, retry);
  }
  if (login.status !== 200) {
    console.log("FAIL admin login", login.status, JSON.stringify(login.body));
    process.exit(1);
  }
  const cookie = (login.raw.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) { console.log("FAIL no set-cookie"); process.exit(1); }
  const H = { cookie };

  // 2. THE ENDPOINT the board calls — authed stats (R65 vocabulary: no window)
  const stats = await j("/api/admin/stats", { headers: H });
  const s = stats.body || {};
  const tot = s.totals || s; // R65 shape: totals.{orders,revenue,netOrders,netRevenue,giftOrders} + top-level wishAdds
  console.log(
    `stats: orders=${tot.orders} gross=${tot.revenue} net=${tot.netRevenue} netOrders=${tot.netOrders} gifts=${tot.giftOrders} wishAdds=${s.wishAdds}`
  );

  // 3. THE ENDPOINT the cancel tab calls (R65 vocabulary: paginated list)
  const orders = await j("/api/admin/orders?page=1&limit=100", { headers: H });
  const rows = (orders.body?.orders || orders.body || []).filter(
    (o) => o.cancelRequested && o.status !== "cancelled"
  );
  console.log(`cancel-request rows (endpoint vocabulary): ${rows.length}`);
  for (const o of rows) console.log(`  - ${o.orderNumber} status=${o.status} cancelRequested=${o.cancelRequested}`);
  // NOTE: stats.cancelPending does NOT exist at the R65 recovery point (the field
  // is an R117-era addition — the lost span). The R65-era two-paths check is the
  // tab rows themselves vs the seed request: exactly 1, the seed.
  console.log(
    (rows.length === 1 ? "PASS" : "FAIL") +
      ` cancel rows == 1 (the seed LN-1789047046089; stats.cancelPending is an R117-era anchor, absent here)`
  );

  // 4. resolve rows EVER + inventory (R65 model names: storeProduct/wishEvent/auditLog)
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  const resolveCount = await db.auditLog.count({ where: { action: { contains: "resolve" } } });
  console.log(`resolve rows EVER (whole audit table): ${resolveCount}`);
  const products = await db.storeProduct.count();
  const wish = await db.wishEvent.count();
  console.log(`inventory: products=${products} wishEvents=${wish} admins=${await db.adminUser.count()}`);
  await db.$disconnect();

  // 5. verdict — the R65-era anchors (the recovery point's own truth)
  const ok =
    tot.orders === 6 && tot.revenue === 2127 && tot.netRevenue === 1981 &&
    tot.netOrders === 5 && tot.giftOrders === 0 && rows.length === 1 && resolveCount === 0 && products === 9;
  console.log(ok ? "BOOK INTACT (R65 recovery point) — hold the wait" : "BOOK MOVED — react");
})();
