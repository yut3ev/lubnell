// R45 probe — (A) public wishCounts social proof via bootstrap; (B) product
// hand-off filter on /api/admin/orders (drill product row → orders table).
// NOTE: the store received its first REAL storefront orders on 2026-09-10
// (customer "hjbkj", no coupon) — hardcoded 4/952/3/806 baselines are retired;
// this probe is DELTA-based: it snapshots the pre-probe state and asserts
// changes relative to it. UI half (card badge, PDP line, gold chip, drill-row
// arrow) verified via agent-browser AFTER this probe, which deliberately
// LEAVES the seeded data in place — cleanup: scripts/r45-cleanup.js
// (deletes …049 probe orders + resets GLOW20 usageCount + deleteMany WishEvents;
// real orders are NEVER touched — cleanup filters on the probe phone only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const PHONE = "011100000049";
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
const orders = async (q) => (await fetch(`${BASE}/api/admin/orders?${q}`, { headers: { cookie } })).json();
const bootstrap = async () => (await fetch(`${BASE}/api/store/bootstrap`)).json();
const post = async (url, body, extra = {}) => {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extra.cookie ? { cookie: extra.cookie } : {}), ...(extra.ip ? { "x-forwarded-for": extra.ip } : {}) },
    body: JSON.stringify(body),
  });
  let json = null; try { json = await r.json(); } catch { /* no body */ }
  return { status: r.status, json };
};
const wish = (slug, action, ip) => post(`${BASE}/api/store/wishlist`, { slug, action }, { ip });
// toRecord already returns items as an ARRAY (legacy array responses too)
const parseItems = (o) => {
  if (Array.isArray(o.items)) return o.items;
  try { return JSON.parse(o.items || "[]"); } catch { return []; }
};

(async () => {
  console.log("── R45 probe: wishCounts social proof + product hand-off ──");
  ok(await adminAuth(), "admin auth");

  // ── snapshot pre-probe state (delta baseline — real orders may exist)
  const s0 = await stats();
  const all0 = await orders("page=1&limit=100");
  const all0Rows = all0.orders || [];
  console.log(`  [snapshot] totals: ${s0.totals.orders} orders / ${s0.totals.revenue} gross / ${s0.totals.netOrders} net / ${s0.totals.netRevenue} netEGP / ${s0.totals.giftOrders} gifts`);
  ok(s0.totals.orders === all0.total, "stats totals == orders listing total (same universe)", `${s0.totals.orders}==${all0.total}`);
  ok(s0.totals.revenue === all0Rows.reduce((a, o) => a + o.total, 0), "gross == sum of listed order totals", String(s0.totals.revenue));

  // ── A1: bootstrap carries wishCounts, empty at probe start (cleanup ran)
  let b = await bootstrap();
  ok(b.wishCounts && typeof b.wishCounts === "object", "bootstrap exposes wishCounts key");
  ok(Object.keys(b.wishCounts).length === 0, "wishCounts empty at probe start (no wish traffic since last cleanup)", JSON.stringify(b.wishCounts));

  // ── A2: seed adds (distinct IPs beat the 8s throttle) → counts rise; removes don't dent
  ok((await wish("university-box", "add", "10.45.0.11")).status === 200, "add university-box #1");
  ok((await wish("university-box", "add", "10.45.0.12")).status === 200, "add university-box #2");
  ok((await wish("strawberry-lip-set", "add", "10.45.0.13")).status === 200, "add strawberry-lip-set");
  b = await bootstrap();
  ok(b.wishCounts["university-box"] === 2, "wishCounts university-box = 2", String(b.wishCounts["university-box"]));
  ok(b.wishCounts["strawberry-lip-set"] === 1, "wishCounts strawberry-lip-set = 1", String(b.wishCounts["strawberry-lip-set"]));
  ok((await wish("university-box", "remove", "10.45.0.14")).status === 200, "remove university-box");
  b = await bootstrap();
  ok(b.wishCounts["university-box"] === 2, "remove does NOT dent the public count (board convention)", String(b.wishCounts["university-box"]));

  // ── B1: product filter returns only orders truly containing the slug
  const truth = all0Rows.filter(o => parseItems(o).some(i => i.id === "university-box")).map(o => o.orderNumber).sort();
  const pf = await orders(`page=1&limit=100&product=university-box`);
  const pfRows = pf.orders || [];
  ok(pf.total === truth.length && pfRows.map(o => o.orderNumber).sort().join() === truth.join(),
    `product=university-box matches JS truth (${truth.length} orders)`, `${pf.total}==${truth.length}`);
  ok(pfRows.every(o => parseItems(o).some(i => i.id === "university-box")), "every returned row contains the slug");

  // ── B2: substring precision — "box" must never match "university-box"
  const pfBox = await orders(`page=1&limit=100&product=box`);
  ok((pfBox.orders || []).length === 0 && pfBox.total === 0, `substring "box" matches nothing (exact-anchor works)`, `total=${pfBox.total}`);

  // ── B3: composes with coupon + status
  const pfCoupon = await orders(`page=1&limit=100&product=university-box&coupon=LUBNEL10`);
  ok((pfCoupon.orders || []).every(o => o.couponCode === "LUBNEL10") && pfCoupon.total <= pf.total,
    "product+coupon compose (all rows LUBNEL10)", `total=${pfCoupon.total}`);
  const pfCancel = await orders(`page=1&limit=100&product=university-box&status=cancelled`);
  ok((pfCancel.orders || []).every(o => o.status === "cancelled"), "product+status compose (all cancelled)", `total=${pfCancel.total}`);

  // ── B4: unknown slug → clean empty
  const pfNone = await orders(`page=1&limit=100&product=ghost-product-xyz`);
  ok(pfNone.total === 0 && (pfNone.orders || []).length === 0, "unknown slug → clean empty page");

  // ── B5: probe order E (GLOW20, 3× strawberry-lip-set @200 catalog = 600 ≥ minSubtotal 500)
  const e = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R45", customerPhone: PHONE, customerAddress: "القاهرة",
    items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", price: 200, quantity: 3 }],
    paymentMethod: "cod",
    couponCode: "GLOW20",
  });
  ok(e.status === 200, "probe order E created (GLOW20 × 3 strawberry-lip-set)", e.json?.orderNumber ?? JSON.stringify(e.json));
  ok(e.json?.discount === 120 && e.json?.total === 540, "server recomputed GLOW20 (600 − 120 + 60 shipping → 540, same math as R42's E)", JSON.stringify({ discount: e.json?.discount, total: e.json?.total }));

  // ── B6: deltas — exactly one new order; product filter finds it
  const s1 = await stats();
  ok(s1.totals.orders === s0.totals.orders + 1 && s1.totals.revenue === s0.totals.revenue + 540,
    "delta: +1 order / +540 gross (total incl. shipping)", `${s0.totals.orders}→${s1.totals.orders}, ${s0.totals.revenue}→${s1.totals.revenue}`);
  const pfE = await orders(`page=1&limit=100&product=strawberry-lip-set`);
  const eRow = (pfE.orders || []).find(o => o.orderNumber === e.json?.orderNumber);
  ok(!!eRow, "product=strawberry-lip-set finds order E", `total=${pfE.total}`);
  ok(parseItems(eRow || {}).find(i => i.id === "strawberry-lip-set")?.quantity === 3, "order E item qty 3 in filtered row");

  // ── B7: drill drawer vs filtered orders — same truth, two views (E included)
  const glow = (s1.couponItems || []).find(g => g.code === "GLOW20");
  const glowTop = glow?.top?.find(d => d.slug === "strawberry-lip-set");
  ok(glowTop?.qty === 3 && glowTop?.revenue === 600, "drill drawer GLOW20 row: 3 units / 600 EGP", JSON.stringify(glowTop));
  const pfEGlow = await orders(`page=1&limit=100&product=strawberry-lip-set&coupon=GLOW20`);
  const eQty = (pfEGlow.orders || []).reduce((a, o) => a + (parseItems(o).find(i => i.id === "strawberry-lip-set")?.quantity || 0), 0);
  ok(eQty === 3 && glowTop?.qty === 3, "filtered-orders qty == drill qty (3==3)", `${eQty}==${glowTop?.qty}`);

  // ── unauth 401 regression
  const unauth = await fetch(`${BASE}/api/admin/orders?page=1&product=university-box`);
  ok(unauth.status === 401, "unauth product-filter request → 401");

  // ── CSV BOM regression (raw bytes)
  const csv = await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } });
  const buf = new Uint8Array(await csv.arrayBuffer());
  ok(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, "CSV export BOM ef bb bf (raw bytes)");

  console.log(`── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
