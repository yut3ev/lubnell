// R52 probe — order-mix drill (orders API source= filter) + overview KPI data.
// Flow: unauth guards → CSV BOM regressions → b0 snapshot (mix + source
// counts) → seed a rail click + same-vid order (rail) and a no-vid order
// (organic) → NEW: source=coupon/rail/organic paged queries return exactly
// the mix numbers (legend number == filtered total) → rail empty-set honesty
// is covered by b0 (rail=0 before seeding) → book moved by exactly the two
// probe orders. Probe orders use the QA phone (…053) — cleanup:
// scripts/r52-cleanup.js (probe phone + probe vid only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r52probevid1234567890";
const PHONE = "011100000053";
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
const sourceQuery = async (source) =>
  (await fetch(`${BASE}/api/admin/orders?page=1&limit=50${source ? `&source=${source}` : ""}`, { headers: { cookie } })).json();
const bom = async (path) => {
  const bytes = new Uint8Array(await (await fetch(`${BASE}${path}`, { headers: { cookie } })).arrayBuffer());
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
};

(async () => {
  console.log("── R52 probe: order-mix source drill ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&source=rail`);
  ok(o401.status === 401, "orders source query unauth → 401", String(o401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 snapshot — mix + source queries agree BEFORE seeding
  const s0 = await stats();
  const m0 = s0.orderMix;
  const [c0, r0, g0] = await Promise.all([sourceQuery("coupon"), sourceQuery("rail"), sourceQuery("organic")]);
  console.log(`  [b0] book: ${s0.totals.orders} orders / mix net ${m0.net} = coupon ${m0.coupon} + rail ${m0.rail} (both ${m0.both}) + organic ${m0.organic}`);
  ok(c0.total === m0.coupon, "b0: source=coupon total == mix.coupon", `${c0.total}==${m0.coupon}`);
  ok(r0.total === 0, "b0: source=rail total == 0 (no converted rails — honest empty)", `total ${r0.total}`);
  ok(Array.isArray(r0.orders) && r0.orders.length === 0, "b0: source=rail returns an EMPTY page (not every order)", "");
  ok(g0.total === m0.organic, "b0: source=organic total == mix.organic", `${g0.total}==${m0.organic}`);

  // ── 2: seed — rail click + same-vid order (rail) + no-vid order (organic)
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "university-box", vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", "→ university-box");
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R52 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with vid (rail)", order.orderNumber || "?");
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R52 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "second probe order created without vid (organic)", order2.orderNumber || "?");

  // ── 3: NEW — source queries match the mix exactly after seeding
  const s1 = await stats();
  const m1 = s1.orderMix;
  const [c1, r1, g1] = await Promise.all([sourceQuery("coupon"), sourceQuery("rail"), sourceQuery("organic")]);
  ok(c1.total === m1.coupon, "source=coupon total == mix.coupon", `${c1.total}==${m1.coupon}`);
  ok(r1.total === m1.rail && m1.rail === m0.rail + 1, "source=rail total == mix.rail (+1)", `${r1.total}==${m1.rail}`);
  ok(g1.total === m1.organic && m1.organic === m0.organic + 1, "source=organic total == mix.organic (+1)", `${g1.total}==${m1.organic}`);
  ok(r1.orders.some(o => o.orderNumber === order.orderNumber && o.railConverted === true),
    "rail query returns the vid order WITH its railConverted flag", order.orderNumber);
  ok(g1.orders.some(o => o.orderNumber === order2.orderNumber && !o.railConverted),
    "organic query returns the no-vid order unflagged", order2.orderNumber);
  ok(!r1.orders.some(o => o.orderNumber === order2.orderNumber), "organic order NOT inside the rail query", "");
  ok([...r1.orders, ...g1.orders, ...c1.orders].every(o => !o.vid), "vid never leaks into any API payload (no PII surface)", "");

  // ── 4: invalid source is a no-op (full unfiltered list)
  const bad = await sourceQuery("droptable");
  ok(bad.total === s1.totals.orders, "invalid source param ignored (no-op filter)", `total ${bad.total}`);

  // ── 5: book moved by exactly the two probe orders + regressions
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
