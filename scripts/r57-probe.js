// R57 probe — rate lens on the rail board (client-side division: per-row
// sold÷pulls chip + footer aggregate conversions÷allPulls; ZERO API change —
// R54 share-lens pattern mirrored onto the board). Flow: unauth guards → CSV
// BOM regressions → b0 (rate math contract, clean-book zeros) → seed with
// TWO vids: VID1 click→university-box + 3 orders (with/without/unrelated
// lines), VID1 click→care-makeup-box (the R56 zero-chip row), VID2
// click→avocado-cucumber-box with NO order ever (the honest unconverted
// pull) → board rows carry their rates (100% / 100% / sold 0 → no chip),
// footer aggregate 2 of 3 = 67% with the fraction derivable → R56/R55/R51/
// R49/CSV/leak regressions. Probe orders use the QA phone (…058); cleanup:
// scripts/r57-cleanup.js (probe phone + BOTH probe vids only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID1 = "r57probevid1234567890";
const VID2 = "r57probevid22468noordr"; // clicked, never ordered — the unconverted pull
const PHONE = "011100000058";
let cookie = "";
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${label}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`); }
};
const rate = (sold, pulls) => Math.round((sold / Math.max(1, pulls)) * 100); // the UI's exact math
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
const clickRail = (from, target, vid) => fetch(`${BASE}/api/store/products/rail-click`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ from, target, vid }),
});
const seedOrder = (name, items, vid) => fetch(`${BASE}/api/store/orders`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customerName: name, customerPhone: PHONE, customerAddress: "QA street", items, ...(vid ? { vid } : {}) }),
}).then(r => r.json());

(async () => {
  console.log("── R57 probe: rail rate lens ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — rate math contract + clean-book zeros
  const s0 = await stats();
  const pulls0 = (s0.railPulls || []).reduce((a, p) => a + p.count, 0);
  console.log(`  [b0] book: ${s0.totals.orders} orders / railConversions ${s0.railConversions} / totalPulls ${pulls0}`);
  ok(rate(1, 3) === 33 && rate(2, 3) === 67 && rate(0, 1) === 0, "b0: rate math contract (round half toward even-digit rounding of JS Math.round)", "1/3→33, 2/3→67, 0/1→0");
  ok(s0.railConversions === 0 && pulls0 === 0, "b0: clean book → no conversions, no pulls", "");
  ok((s0.railBoard || []).every(r => typeof r.revenue === "number"), "R56 regression: board rows still carry numeric revenue", "");

  // ── 2: seed — VID1 (two clicks, three orders) + VID2 (one click, NO order)
  const c1 = await clickRail("strawberry-lip-set", "university-box", VID1);
  ok(c1.status === 200, "click1 → university-box (VID1)", "");
  const order = await seedOrder("R57 Probe", [{ id: "university-box", name: "University Box", quantity: 1, price: 200 }], VID1);
  const order2 = await seedOrder("R57 Probe 2", [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }], VID1);
  ok(order.orderNumber && order2.orderNumber, "VID1 orders created (with + without target lines)", `${order.orderNumber || "?"} / ${order2.orderNumber || "?"}`);
  const c2 = await clickRail("strawberry-lip-set", "care-makeup-box", VID1);
  ok(c2.status === 200, "click2 → care-makeup-box (VID1, zero-chip row)", "");
  const order3 = await seedOrder("R57 Probe 3", [{ id: "vaseline-hair-tonic", name: "Vaseline Hair Tonic", quantity: 1, price: 150 }], VID1);
  ok(order3.orderNumber, "VID1 third order (unrelated product)", order3.orderNumber || "?");
  const c3 = await clickRail("strawberry-lip-set", "avocado-cucumber-box", VID2);
  ok(c3.status === 200, "click3 → avocado-cucumber-box (VID2, never ordered)", "");

  // ── 3: after — per-row rates + aggregate funnel fraction
  const s1 = await stats();
  const b1 = s1.railBoard || [];
  const pulls1 = (s1.railPulls || []).reduce((a, p) => a + p.count, 0);
  const rowU = b1.find(r => r.slug === "university-box");
  const rowC = b1.find(r => r.slug === "care-makeup-box");
  const rowA = b1.find(r => r.slug === "avocado-cucumber-box");
  ok(!!rowU && rowU.pulls === 1 && rowU.sold === 1 && rate(rowU.sold, rowU.pulls) === 100,
    "row rate: university-box 1/1 = 100%", rowU ? `${rate(rowU.sold, rowU.pulls)}%` : "missing");
  ok(!!rowC && rowC.pulls === 1 && rowC.sold === 1 && rowC.revenue === 0,
    "R56 regression: care-makeup-box zero-chip state (sold 1, revenue 0)", rowC ? `rev ${rowC.revenue}` : "missing");
  ok(!!rowA && rowA.pulls === 1 && rowA.sold === 0,
    "unconverted pull pinned: avocado row pulls 1, sold 0 (no rate chip, no sold chip)", rowA ? `sold ${rowA.sold}` : "missing");
  ok(pulls1 === 3 && s1.railConversions === 2, "aggregate funnel inputs: 3 pulls, 2 conversions", `${s1.railConversions}/${pulls1}`);
  ok(rate(s1.railConversions, pulls1) === 67, "footer aggregate rate derivable: 2/3 = 67%", "67%");
  ok(s1.railRevenueTotal === 550, "R56 regression: railRevenueTotal still the three lines (200+200+150)", String(s1.railRevenueTotal));
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);
  ok(s1.mixTrend.revenue.current.rail === s0.mixTrend.revenue.current.rail + (order.total || 0) + (order2.total || 0) + (order3.total || 0),
    "R55 regression: mix order-level rail revenue moved by all order totals", `+${(order.total || 0) + (order2.total || 0) + (order3.total || 0)}`);
  ok(s1.orderMix.rail === s0.orderMix.rail + 3, "R51 regression: all three vid orders count as rail in the mix", `rail ${s1.orderMix.rail}`);

  // ── 4: drill + CSV + leak regressions
  const r1q = await ordersQuery("&source=rail&days=7");
  ok(r1q.total === s1.orderMix.rail && r1q.orders.filter(o => o.customerPhone === PHONE).length === 3,
    "rail drill returns all three probe orders flagged", `${r1q.total} row(s)`);
  ok([...r1q.orders].every(o => !o.vid) && !JSON.stringify(s1).includes(VID1) && !JSON.stringify(s1).includes(VID2),
    "vids never leak into any API payload (both probe vids)", "");
  const csv = await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).text();
  const lines = csv.split("\r\n").filter(Boolean);
  ok(lines[0].replace(/^﻿/, "").endsWith('"rail"'), "orders CSV header ends with the rail column", "");
  const prow = [order.orderNumber, order2.orderNumber, order3.orderNumber].map(n =>
    lines.find(l => l.includes(`"${n}"`) || l.includes(`,${n},`)));
  ok(prow.every(l => l && l.endsWith('"yes"')), "all three probe CSV rows say rail yes", "");

  // ── 5: book + invariants
  const orderTotal = (order.total || 0) + (order2.total || 0) + (order3.total || 0);
  ok(s1.totals.orders === s0.totals.orders + 3 && s1.totals.revenue === s0.totals.revenue + orderTotal,
    "book moved by exactly the probe orders", `+${orderTotal} EGP`);
  const w1 = await ordersQuery("&days=7");
  ok(s1.totals.weekOrders === w1.total, "R54 regression: weekOrders == days=7 total", `${s1.totals.weekOrders}==${w1.total}`);
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
