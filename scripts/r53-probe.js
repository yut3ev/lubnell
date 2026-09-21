// R53 probe — mix trend (windowed classification) + week-window drill.
// Flow: unauth guards → CSV BOM regressions → b0 snapshot (mix + mixTrend +
// days=7 window query, whose b0 semantics are asserted: pure time filter that
// INCLUDES the cancelled order, unlike source) → seed a rail click + same-vid
// order (rail) and a no-vid order (organic) → NEW: mixTrend.current moves
// exactly with the probe orders, previous window frozen, current == all-time
// mix while every order is inside 7 days → source+days composition totals →
// CSV rail column regression (R51) → invariants. Probe orders use the QA
// phone (…054) — cleanup: scripts/r53-cleanup.js (probe phone + probe vid only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r53probevid1234567890";
const PHONE = "011100000054";
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
const mixSum = (w) => Math.max(0, w.coupon - w.both) + w.both + Math.max(0, w.rail - w.both) + w.organic;

(async () => {
  console.log("── R53 probe: mix trend + week window ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7&source=rail`);
  ok(o401.status === 401, "orders days+source query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 snapshot — mix, mixTrend, and the week-window query BEFORE seeding
  const s0 = await stats();
  const m0 = s0.orderMix;
  const t0 = s0.mixTrend;
  console.log(`  [b0] book: ${s0.totals.orders} orders / mix net ${m0.net} = coupon ${m0.coupon} + rail ${m0.rail} (both ${m0.both}) + organic ${m0.organic}`);
  ok(m0.net === m0.coupon + m0.rail + m0.organic - m0.both, "b0: mix segments sum to net (classification identity)", `${m0.coupon}+${m0.rail}+${m0.organic}-${m0.both}==${m0.net}`);
  ok(m0.rail === 0, "b0: mix.rail == 0 (no converted rails)", "");
  ok(!!t0 && typeof t0.current?.net === "number" && typeof t0.previous?.net === "number", "b0: mixTrend payload present (current + previous)", `cur ${t0?.current?.net} / prev ${t0?.previous?.net}`);
  ok(t0.current.net === m0.net && t0.current.coupon === m0.coupon && t0.current.rail === m0.rail && t0.current.organic === m0.organic && t0.current.both === m0.both,
    "b0: mixTrend.current == all-time mix (every baseline order is inside the 7-day window)", "");
  ok(t0.previous.net === 0 && t0.previous.coupon === 0 && t0.previous.rail === 0 && t0.previous.organic === 0 && t0.previous.both === 0,
    "b0: previous window (7–14d ago) honestly empty", "");
  const w0 = await ordersQuery("&days=7");
  ok(w0.total === s0.totals.orders, "b0: days=7 is a PURE time filter — includes the cancelled order too", `${w0.total}==${s0.totals.orders}`);
  const [c0, r0, g0] = await Promise.all([ordersQuery("&source=coupon&days=7"), ordersQuery("&source=rail&days=7"), ordersQuery("&source=organic&days=7")]);
  ok(c0.total === m0.coupon, "b0: source=coupon&days=7 == mix.coupon", `${c0.total}==${m0.coupon}`);
  ok(r0.total === 0 && Array.isArray(r0.orders) && r0.orders.length === 0, "b0: source=rail&days=7 → honest EMPTY page", "");
  ok(g0.total === m0.organic, "b0: source=organic&days=7 == mix.organic", `${g0.total}==${m0.organic}`);
  const bad30 = await ordersQuery("&days=30");
  const badAbc = await ordersQuery("&days=abc");
  ok(bad30.total === s0.totals.orders && badAbc.total === s0.totals.orders, "invalid days params are no-ops (only 7 is a window)", "30/abc ignored");

  // ── 2: seed — rail click + same-vid order (rail) + no-vid order (organic)
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "university-box", vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", "→ university-box");
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R53 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with vid (rail)", order.orderNumber || "?");
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R53 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "second probe order created without vid (organic)", order2.orderNumber || "?");

  // ── 3: NEW — trend moves exactly with the probe orders, previous frozen
  const s1 = await stats();
  const m1 = s1.orderMix;
  const t1 = s1.mixTrend;
  ok(m1.rail === m0.rail + 1 && m1.organic === m0.organic + 1 && m1.coupon === m0.coupon && m1.both === m0.both,
    "all-time mix moved: rail +1, organic +1, coupon/both frozen", `rail ${m0.rail}→${m1.rail}, organic ${m0.organic}→${m1.organic}`);
  ok(t1.current.rail === m1.rail && t1.current.organic === m1.organic && t1.current.coupon === m1.coupon && t1.current.net === m1.net,
    "mixTrend.current tracks the all-time mix exactly (probe orders land inside 7 days)", `cur net ${t1.current.net}`);
  ok(t1.previous.net === 0 && t1.previous.rail === 0 && t1.previous.organic === 0 && t1.previous.coupon === 0,
    "mixTrend.previous frozen at zeros (windows disjoint — no double counting)", "");
  ok(mixSum(t1.current) === t1.current.net, "current-window segments sum to current net", `${mixSum(t1.current)}==${t1.current.net}`);

  // ── 4: week-window drill after seeding
  const w1 = await ordersQuery("&days=7");
  ok(w1.total === s1.totals.orders, "days=7 total == all orders (both probe orders inside the window)", `${w1.total}`);
  const [r1, g1, c1] = await Promise.all([ordersQuery("&source=rail&days=7"), ordersQuery("&source=organic&days=7"), ordersQuery("&source=coupon&days=7")]);
  ok(r1.total === m1.rail && r1.orders.some(o => o.orderNumber === order.orderNumber && o.railConverted === true),
    "source=rail&days=7 → exactly the vid order WITH its railConverted flag", `${r1.total} row(s)`);
  ok(g1.total === m1.organic && g1.orders.some(o => o.orderNumber === order2.orderNumber && !o.railConverted),
    "source=organic&days=7 → includes the no-vid order unflagged", `${g1.total} rows`);
  ok(c1.total === m1.coupon && !c1.orders.some(o => o.orderNumber === order.orderNumber),
    "source=coupon&days=7 → the rail order is NOT inside the coupon view", `${c1.total} rows`);
  ok([...r1.orders, ...g1.orders, ...c1.orders].every(o => !o.vid), "vid never leaks into any API payload (no PII surface)", "");
  const badSrc = await ordersQuery("&source=droptable&days=7");
  ok(badSrc.total === w1.total, "invalid source + days → days still applies (source no-op)", `${badSrc.total}==${w1.total}`);

  // ── 5: CSV agrees with the screen (R51 rail column regression)
  const csv = await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).text();
  const lines = csv.split("\r\n").filter(Boolean);
  const header = lines[0].replace(/^﻿/, "");
  ok(header.endsWith('"rail"'), "orders CSV header ends with the R51 rail column", header.split(",").slice(-1)[0]);
  const rowOf = (num) => lines.find(l => l.includes(`"${num}"`) || l.includes(`,${num},`));
  const row1 = rowOf(order.orderNumber), row2 = rowOf(order2.orderNumber);
  ok(!!row1 && row1.endsWith('"yes"'), "CSV: vid order row carries rail=yes (file agrees with the screen)", "");
  ok(!!row2 && row2.endsWith('"no"'), "CSV: no-vid order row carries rail=no", "");

  // ── 6: book moved by exactly the two probe orders + regressions
  const orderTotal = (order.total || 0) + (order2.total || 0);
  ok(s1.totals.orders === s0.totals.orders + 2 && s1.totals.revenue === s0.totals.revenue + orderTotal,
    "book moved by exactly the probe orders", `+${orderTotal} EGP`);
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);
  const boardRow = (s1.railBoard || []).find(r => r.slug === "university-box");
  ok(!!boardRow && boardRow.pulls === 1 && boardRow.sold === 1, "R50 railBoard regression (meta resolved, pulls/sold 1/1)", boardRow ? `${boardRow.pulls}/${boardRow.sold}` : "missing");
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
