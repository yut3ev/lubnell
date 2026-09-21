// R55 probe — week-over-week REVENUE by source (`mixRevTrend`: the mixTrend
// windows with `_sum total` instead of counts) + the studio's money mini
// table. Flow: unauth guards → CSV BOM regressions → b0 with the NEW payload
// asserted against totals.netRevenue AND an INDEPENDENT cross-check (JS
// classification of the orders LISTING rows: coupon = couponCode truthy,
// rail = railConverted flag, sums compared per key) → seed rail click + vid
// order + no-vid order → revenue moves by exactly the order totals (rail
// +total1, organic +total2, previous window frozen) → counts regression
// (R53 chips unchanged semantics) → identity + CSV + invariants. Probe
// orders use the QA phone (…056) — cleanup: scripts/r55-cleanup.js (probe
// phone + probe vid only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r55probevid1234567890";
const PHONE = "011100000056";
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
// Independent path: classify the LISTING rows in JS and sum — the aggregate
// SQL must agree with what the screen's own rows say.
const listingSums = (rows) => {
  const sums = { net: 0, coupon: 0, rail: 0, both: 0, organic: 0 };
  for (const o of rows) {
    if (o.status === "cancelled") continue;
    const isCoupon = !!o.couponCode && o.couponCode !== "";
    const isRail = o.railConverted === true;
    sums.net += o.total;
    if (isCoupon) sums.coupon += o.total;
    if (isRail) sums.rail += o.total;
    if (isCoupon && isRail) sums.both += o.total;
    if (!isCoupon && !isRail) sums.organic += o.total;
  }
  return sums;
};

(async () => {
  console.log("── R55 probe: revenue-by-source payload ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — shape, anchors, identity, independent cross-check
  const s0 = await stats();
  const t0 = s0.mixTrend, r0 = t0.revenue;
  const m0 = s0.orderMix;
  const list0 = await ordersQuery();
  const ls0 = listingSums(list0.orders || []);
  console.log(`  [b0] book: ${s0.totals.orders} orders / netRevenue ${s0.totals.netRevenue} / rev current.net ${r0?.current?.net} / listing-sum net ${ls0.net}`);
  const shapeOk = r0 && ["current", "previous"].every(w =>
    ["net", "coupon", "rail", "both", "organic"].every(k => typeof r0[w][k] === "number"));
  ok(!!shapeOk, "b0: mixRevTrend present with the full window shape", "");
  ok(r0.current.net === s0.totals.netRevenue, "b0: rev current.net == totals.netRevenue (all non-cancelled inside 7d)", `${r0.current.net}==${s0.totals.netRevenue}`);
  ok(r0.previous.net === 0, "b0: rev previous window empty (fresh book)", String(r0.previous.net));
  ok(["current", "previous"].every(w => r0[w].organic === r0[w].net - r0[w].coupon - r0[w].rail + r0[w].both),
    "b0: inclusion-exclusion identity holds per window", "");
  ok(["net", "coupon", "rail", "both", "organic"].every(k => r0.current[k] === ls0[k]),
    "b0: aggregate SQL == listing JS classification (independent paths)", JSON.stringify(ls0));
  ok(t0.current.net === m0.net, "R53 regression: count trend current == mix (counts untouched by R55)", "");
  ok(!("mixRevTrend" in s0), "no duplicate top-level revenue field (single source of truth)", "");

  // ── 2: seed — rail click + same-vid order (rail) + no-vid order (organic)
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "university-box", vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", "→ university-box");
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R55 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with vid (rail)", order.orderNumber || "?");
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R55 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "second probe order created without vid (organic)", order2.orderNumber || "?");

  // ── 3: after — revenue moves by exactly the totals, previous frozen
  const s1 = await stats();
  const t1 = s1.mixTrend, r1 = t1.revenue, m1 = s1.orderMix;
  const t1o = order.total || 0, t2o = order2.total || 0;
  ok(r1.current.rail === r0.current.rail + t1o, "rev rail moved by exactly the vid order total", `+${t1o}`);
  ok(r1.current.organic === r0.current.organic + t2o, "rev organic moved by exactly the organic order total", `+${t2o}`);
  ok(r1.current.net === r0.current.net + t1o + t2o, "rev net moved by both probe orders", `+${t1o + t2o}`);
  ok(r1.current.coupon === r0.current.coupon, "rev coupon frozen (no coupon orders seeded)", "");
  ok(r1.previous.net === 0 && r1.previous.rail === 0 && r1.previous.organic === 0,
    "rev previous window frozen at zeros (disjoint windows)", "");
  ok(r1.current.rail - r1.previous.rail === t1o, "delta chip math: rail EGP delta == order total", `+${r1.current.rail - r1.previous.rail}`);
  ok(m1.rail === m0.rail + 1 && m1.organic === m0.organic + 1 && m1.coupon === m0.coupon,
    "R53 regression: COUNT mix moved rail +1 organic +1, coupon frozen", `rail ${m1.rail}, organic ${m1.organic}`);
  ok(t1.current.rail === m1.rail && t1.current.net === m1.net, "R53 regression: count trend current still tracks", "");
  ok(["current", "previous"].every(w => r1[w].organic === r1[w].net - r1[w].coupon - r1[w].rail + r1[w].both),
    "identity still holds after seeding", "");
  const list1 = await ordersQuery();
  const ls1 = listingSums(list1.orders || []);
  ok(["net", "coupon", "rail", "both", "organic"].every(k => r1.current[k] === ls1[k]),
    "cross-check STILL holds after seeding (aggregate == listing)", JSON.stringify(ls1));
  const r1q = await ordersQuery("&source=rail&days=7");
  ok(r1q.total === m1.rail && r1q.orders.some(o => o.orderNumber === order.orderNumber && o.railConverted === true),
    "R53 regression: rail+week drill returns the vid order flagged", `${r1q.total} row(s)`);
  ok([...r1q.orders].every(o => !o.vid) && !JSON.stringify(s1).includes(VID),
    "vid never leaks into any API payload", "");

  // ── 4: CSV rail column regression (R51)
  const csv = await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).text();
  const lines = csv.split("\r\n").filter(Boolean);
  const header = lines[0].replace(/^﻿/, "");
  ok(header.endsWith('"rail"'), "orders CSV header ends with the rail column", "");
  const row1 = lines.find(l => l.includes(`"${order.orderNumber}"`) || l.includes(`,${order.orderNumber},`));
  const row2 = lines.find(l => l.includes(`"${order2.orderNumber}"`) || l.includes(`,${order2.orderNumber},`));
  ok(!!row1 && row1.endsWith('"yes"') && !!row2 && row2.endsWith('"no"'), "CSV rows agree with the screen (yes/no)", "");

  // ── 5: book moved by exactly the two probe orders + invariants
  ok(s1.totals.orders === s0.totals.orders + 2 && s1.totals.revenue === s0.totals.revenue + t1o + t2o,
    "book moved by exactly the probe orders", `+${t1o + t2o} EGP`);
  const w1 = await ordersQuery("&days=7");
  ok(s1.totals.weekOrders === w1.total, "R54 regression: weekOrders == days=7 total", `${s1.totals.weekOrders}==${w1.total}`);
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
