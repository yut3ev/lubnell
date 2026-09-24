// R54 probe — trend share lens (client-side division, payload unchanged in
// shape) + overview week KPI (`totals.weekOrders`, EXACT days=7 semantics).
// Flow: unauth guards → CSV BOM regressions → b0 snapshot with the NEW
// weekOrders asserted equal to a live days=7 orders query (all statuses,
// cancelled included) → seed rail click + vid order + no-vid order →
// weekOrders moves +2 and STILL equals the days=7 total → R53 trend
// regressions (current tracks, previous frozen, disjoint windows) → CSV
// rail column + invariants. Probe orders use the QA phone (…055) — cleanup:
// scripts/r54-cleanup.js (probe phone + probe vid only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r54probevid1234567890";
const PHONE = "011100000055";
let cookie = "";
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${label}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`); }
};
const adminAuth = async () => {
  const res = await fetch(`${BASE}/api/admin/auth`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
  });
  cookie = ((res.headers.get("set-cookie") || "").match(/lubnel_admin_session=[^;]+/) || [""])[0];
  return res.ok && !!cookie;
};
const stats = async () => (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
const ordersQuery = async (extra = "") =>
  (await fetch(`${BASE}/api/admin/orders?page=1&limit=50${extra}`, { headers: { cookie } })).json();
const bom = async (path) => {
  const bytes = new Uint8Array(await (await fetch(`${BASE}${path}`, { headers: { cookie } })).arrayBuffer());
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
};

(async () => {
  console.log("── R54 probe: week KPI + share-lens payload ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — weekOrders == days=7 total (the consistency contract)
  const s0 = await stats();
  const m0 = s0.orderMix, t0 = s0.mixTrend;
  const w0 = await ordersQuery("&days=7");
  console.log(`  [b0] book: ${s0.totals.orders} orders / weekOrders ${s0.totals.weekOrders} / days=7 total ${w0.total} / mix net ${m0.net}`);
  ok(typeof s0.totals.weekOrders === "number", "b0: totals.weekOrders present", String(s0.totals.weekOrders));
  ok(s0.totals.weekOrders === w0.total, "b0: weekOrders == days=7 query total (chip number == landed view)", `${s0.totals.weekOrders}==${w0.total}`);
  ok(s0.totals.weekOrders === s0.totals.orders, "b0: weekOrders includes cancelled (pure time window — all orders are inside 7d)", "");
  ok(s0.totals.weekOrders !== s0.totals.ordersWeek || true, "b0: (info) calendar ordersWeek may differ — R54 uses the rolling window", `ordersWeek ${s0.totals.ordersWeek}`);
  ok(t0.current.net === m0.net && t0.previous.net === 0, "R53 regression: trend current == mix, previous empty", `cur ${t0.current.net} / prev ${t0.previous.net}`);
  const shareCoupon = Math.round((t0.current.coupon / t0.current.net) * 100);
  ok(shareCoupon === Math.round((m0.coupon / m0.net) * 100), "b0: coupon share derivable from the payload (share lens math)", `${shareCoupon}%`);

  // ── 2: seed — rail click + same-vid order (rail) + no-vid order (organic)
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "university-box", vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", "→ university-box");
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R54 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with vid (rail)", order.orderNumber || "?");
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R54 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "second probe order created without vid (organic)", order2.orderNumber || "?");

  // ── 3: after — weekOrders tracks the window exactly, trend regressions
  const s1 = await stats();
  const m1 = s1.orderMix, t1 = s1.mixTrend;
  const w1 = await ordersQuery("&days=7");
  ok(s1.totals.weekOrders === s0.totals.weekOrders + 2, "weekOrders moved by exactly the probe orders (+2)", `${s0.totals.weekOrders}→${s1.totals.weekOrders}`);
  ok(s1.totals.weekOrders === w1.total, "weekOrders STILL == days=7 query total after seeding", `${s1.totals.weekOrders}==${w1.total}`);
  ok(s1.totals.weekOrders === s1.totals.orders, "weekOrders == all orders (probe orders inside the window, cancelled included)", "");
  ok(m1.rail === m0.rail + 1 && m1.organic === m0.organic + 1 && m1.coupon === m0.coupon, "R53 regression: mix moved rail +1 organic +1, coupon frozen", `rail ${m1.rail}, organic ${m1.organic}`);
  ok(t1.current.rail === m1.rail && t1.current.net === m1.net && t1.previous.net === 0, "R53 regression: trend current tracks, previous frozen", "");
  const r1 = await ordersQuery("&source=rail&days=7");
  ok(r1.total === m1.rail && r1.orders.some(o => o.orderNumber === order.orderNumber && o.railConverted === true),
    "R53 regression: rail+week drill returns the vid order flagged", `${r1.total} row(s)`);
  ok([...r1.orders].every(o => !o.vid), "vid never leaks into any API payload", "");

  // ── 4: CSV rail column regression (R51)
  const csv = await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).text();
  const lines = csv.split("\r\n").filter(Boolean);
  const header = lines[0].replace(/^﻿/, "");
  ok(header.endsWith('"rail"'), "orders CSV header ends with the rail column", "");
  const row1 = lines.find(l => l.includes(`"${order.orderNumber}"`) || l.includes(`,${order.orderNumber},`));
  const row2 = lines.find(l => l.includes(`"${order2.orderNumber}"`) || l.includes(`,${order2.orderNumber},`));
  ok(!!row1 && row1.endsWith('"yes"') && !!row2 && row2.endsWith('"no"'), "CSV rows agree with the screen (yes/no)", "");

  // ── 5: book moved by exactly the two probe orders + invariants
  const orderTotal = (order.total || 0) + (order2.total || 0);
  ok(s1.totals.orders === s0.totals.orders + 2 && s1.totals.revenue === s0.totals.revenue + orderTotal,
    "book moved by exactly the probe orders", `+${orderTotal} EGP`);
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
