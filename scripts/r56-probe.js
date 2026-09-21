// R56 probe — revenue lens on the rail board (`railBoard[].revenue` line-level
// EGP + `railRevenueTotal` across ALL rail-attributed orders). Flow: unauth
// guards → CSV BOM regressions → b0 (clean book: all board revenues 0, total
// 0, shape numeric, board sum ≤ total) → seed rail click (→ university-box)
// + vid order CONTAINING university-box (350) + second vid order containing
// strawberry-lip-set instead (200) → board row revenue +350 exactly while
// the SECOND order proves the honest divergence: order-level rail revenue
// (+total both orders incl. shipping) outgrows line revenue (+550 lines) and
// the converted target's revenue doesn't move — sold≥1 revenue-350 semantics
// pinned → independent cross-check: JS classification of the LISTING rows
// (parse items, qty×price for railConverted rows) == server map → R55/R54/
// R53/R49/R46 regressions → CSV. Probe orders use the QA phone (…057) —
// cleanup: scripts/r56-cleanup.js (probe phone + probe vid only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r56probevid1234567890";
const PHONE = "011100000057";
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
// Independent path: parse the LISTING rows' items in JS and sum qty × price
// for rail-attributed (railConverted) non-cancelled orders — must agree with
// the server's SQL json_each map.
const jsRailRevenue = (rows) => {
  const perSlug = {};
  let total = 0;
  for (const o of rows || []) {
    if (o.status === "cancelled" || o.railConverted !== true) continue;
    let items = [];
    try { items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []); } catch { continue; }
    for (const it of items) {
      const amt = (Number(it.quantity) || 0) * (Number(it.price) || 0);
      if (it.id) perSlug[it.id] = (perSlug[it.id] || 0) + amt;
      total += amt;
    }
  }
  return { perSlug, total };
};

(async () => {
  console.log("── R56 probe: rail board revenue lens ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — clean book: shape + honest zeros
  const s0 = await stats();
  const b0 = s0.railBoard || [];
  const t0 = s0.railRevenueTotal;
  const m0 = s0.orderMix, mr0 = s0.mixTrend.revenue;
  const best0 = new Map((s0.bestSellers || []).map(r => [r.slug, r.revenue]));
  console.log(`  [b0] book: ${s0.totals.orders} orders / board rows ${b0.length} / railRevenueTotal ${t0}`);
  ok(typeof t0 === "number", "b0: railRevenueTotal present", String(t0));
  ok(t0 === 0, "b0: clean book → rail revenue total 0", String(t0));
  ok(b0.every(r => typeof r.revenue === "number"), "b0: every board row carries numeric revenue", "");
  ok(b0.every(r => r.revenue === 0), "b0: clean book → all board revenues 0", "");
  const b0Slug = (b0.find(r => r.slug === "university-box") || { pulls: 0, sold: 0, revenue: 0 });

  // ── 2: seed — click → order WITH the target + order WITHOUT it
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "university-box", vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", "→ university-box");
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R56 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "university-box", name: "University Box", quantity: 1, price: 350 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order WITH target product (rail)", order.orderNumber || "?");
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R56 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "probe order WITHOUT target product (rail, vid reused)", order2.orderNumber || "?");
  // Server re-prices lines from the catalog (client prices are never trusted),
  // so expected LINE amounts are read back from the stored orders, not the
  // requested prices.
  const seededRows = (await ordersQuery()).orders || [];
  const lineAmt = (orderRow, slug) => {
    let items = [];
    try { items = typeof orderRow.items === "string" ? JSON.parse(orderRow.items) : (orderRow.items || []); } catch { return 0; }
    const l = items.find(i => i.id === slug);
    return l ? (Number(l.quantity) || 0) * (Number(l.price) || 0) : 0;
  };
  const stored1 = seededRows.find(o => o.orderNumber === order.orderNumber);
  const stored2 = seededRows.find(o => o.orderNumber === order2.orderNumber);
  const amt1 = stored1 ? lineAmt(stored1, "university-box") : 0;
  const amt2 = stored2 ? lineAmt(stored2, "strawberry-lip-set") : 0;
  ok(amt1 > 0 && amt2 > 0, "stored line amounts read back (catalog-priced)", `${amt1} + ${amt2}`);
  // Third seed — a SECOND pulled target (care-makeup-box) whose converting
  // order contains NEITHER it nor any of its lines: pins the .zero chip
  // state (sold ≥ 1, revenue 0 — "converted away") in the payload.
  const click2 = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "care-makeup-box", vid: VID }),
  });
  ok(click2.status === 200, "second probe rail click recorded", "→ care-makeup-box");
  const order3Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R56 Probe 3", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "vaseline-hair-tonic", name: "Vaseline Hair Tonic", quantity: 1, price: 150 }],
      vid: VID,
    }),
  });
  const order3 = await order3Res.json();
  ok(order3Res.ok && order3.orderNumber, "probe order 3 (rail, unrelated product)", order3.orderNumber || "?");
  const seededRows2 = (await ordersQuery()).orders || [];
  const stored3 = seededRows2.find(o => o.orderNumber === order3.orderNumber);
  const amt3 = stored3 ? lineAmt(stored3, "vaseline-hair-tonic") : 0;
  ok(amt3 > 0, "third stored line amount read back", String(amt3));

  // ── 3: after — line revenue exact, divergence honest, cross-checks
  const s1 = await stats();
  const b1 = s1.railBoard || [];
  const row1 = b1.find(r => r.slug === "university-box");
  const t1 = s1.railRevenueTotal;
  const t1o = order.total || 0, t2o = order2.total || 0, t3o = order3.total || 0;
  ok(!!row1, "target appears on the board after the pull", row1 ? `pulls ${row1.pulls}` : "missing");
  ok(row1.pulls === b0Slug.pulls + 1 && row1.sold === b0Slug.sold + 1, "board row: pulls +1, sold +1", `pulls ${row1.pulls}, sold ${row1.sold}`);
  ok(row1.revenue === b0Slug.revenue + amt1, "board row revenue moved by exactly the stored target line (qty × price)", `+${row1.revenue - b0Slug.revenue}`);
  ok(t1 === t0 + amt1 + amt2 + amt3, "railRevenueTotal = all three stored lines", String(t1));
  const rowX = b1.find(r => r.slug === "care-makeup-box");
  ok(!!rowX && rowX.pulls === 1 && rowX.sold === 1 && rowX.revenue === 0,
    "ZERO-CHIP state pinned: second target sold ≥ 1 with revenue 0 (converted away)", rowX ? `sold ${rowX.sold}, rev ${rowX.revenue}` : "missing");
  ok(t1 >= b1.reduce((a, r) => a + r.revenue, 0), "footer total ≥ sum of top-5 board rows (covers all slugs)", "");
  ok(s1.railConversions === (s0.railConversions ?? 0) + 2, "two event conversions (each order stamps its own click)", String(s1.railConversions));
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);
  ok(s1.mixTrend.revenue.current.rail === mr0.current.rail + t1o + t2o + t3o,
    "R55 regression: mix ORDER-level rail revenue moved by all order totals (incl. shipping)", `+${t1o + t2o + t3o}`);
  const m1 = s1.orderMix;
  ok(m1.rail === m0.rail + 3 && m1.coupon === m0.coupon && m1.organic === m0.organic,
    "R51 regression: all three vid orders count as rail in the mix", `rail ${m1.rail}`);
  const list1 = await ordersQuery();
  const js = jsRailRevenue(list1.orders);
  ok(js.total === t1, "cross-check: listing JS line sums == server railRevenueTotal", `${js.total}==${t1}`);
  const jsSlugsAgree = Object.keys(js.perSlug).every(slug => {
    const boardRow = b1.find(r => r.slug === slug);
    return boardRow ? boardRow.revenue === js.perSlug[slug] : true; // non-board slugs live in the footer total
  }) && b1.every(r => r.revenue === (js.perSlug[r.slug] || 0));
  ok(jsSlugsAgree, "cross-check: per-slug board revenue == JS classification", JSON.stringify(js.perSlug));
  const bestAgree = Object.keys(js.perSlug).every(slug => !best0.has(slug) || best0.get(slug) >= js.perSlug[slug]);
  ok(bestAgree, "cross-check: rail line revenue ⊆ best-sellers revenue per slug", "");

  // ── 4: drill + CSV + leak regressions
  const r1q = await ordersQuery("&source=rail&days=7");
  ok(r1q.total === m1.rail && r1q.orders.filter(o => o.customerPhone === PHONE).length === 3,
    "rail drill returns all three probe orders flagged", `${r1q.total} row(s)`);
  ok([...r1q.orders].every(o => !o.vid) && !JSON.stringify(s1).includes(VID), "vid never leaks into any API payload", "");
  const csv = await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).text();
  const lines = csv.split("\r\n").filter(Boolean);
  ok(lines[0].replace(/^﻿/, "").endsWith('"rail"'), "orders CSV header ends with the rail column", "");
  const prow = [order.orderNumber, order2.orderNumber, order3.orderNumber].map(n =>
    lines.find(l => l.includes(`"${n}"`) || l.includes(`,${n},`)));
  ok(prow.every(l => l && l.endsWith('"yes"')), "all three probe CSV rows say rail yes", "");

  // ── 5: book + invariants
  ok(s1.totals.orders === s0.totals.orders + 3 && s1.totals.revenue === s0.totals.revenue + t1o + t2o + t3o,
    "book moved by exactly the probe orders", `+${t1o + t2o + t3o} EGP`);
  const w1 = await ordersQuery("&days=7");
  ok(s1.totals.weekOrders === w1.total, "R54 regression: weekOrders == days=7 total", `${s1.totals.weekOrders}==${w1.total}`);
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
