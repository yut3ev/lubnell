// R43 probe — coupon deep-link: GET /api/admin/orders learns ?coupon=CODE so
// the analytics drill drawer can jump to the orders table filtered by code.
// Baseline: 4 LUBNEL10 orders (1 cancelled). Probe order E redeems GLOW20 so
// the second code has a row to filter for. Cleanup = scripts/r42-cleanup.js.
const BASE = "http://localhost:3000";
const PHONE = "011100000039";
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${label}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`); }
};

async function post(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, setCookie: r.headers.get("set-cookie"), json: await r.json().catch(() => null) };
}

(async () => {
  const login = await post(`${BASE}/api/admin/auth`, { username: "owner", password: "lubnel1234", verificationCode: "7777" });
  const cookie = (login.setCookie || "").split(";")[0];
  ok(!!cookie, "admin auth");
  const ordersPage = async (qs) => (await (await fetch(`${BASE}/api/admin/orders?${qs}`, { headers: { cookie } })).json());
  const stats = async () => (await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json());

  // ── baseline coupon filter
  const lub = await ordersPage("page=1&limit=50&coupon=LUBNEL10");
  ok(lub.total === 4, "coupon=LUBNEL10 → all 4 baseline orders (cancel included — filter is status-independent)", `total ${lub.total}`);
  ok(lub.orders.every(o => o.couponCode === "LUBNEL10"), "every row carries the filtered code");
  const lubCancelled = await ordersPage("page=1&limit=50&coupon=LUBNEL10&status=cancelled");
  ok(lubCancelled.total === 1, "coupon + status combine (cancelled ×1)", `total ${lubCancelled.total}`);
  const glow0 = await ordersPage("page=1&limit=50&coupon=GLOW20");
  ok(glow0.total === 0, "coupon=GLOW20 empty at baseline");
  const unknown = await ordersPage("page=1&limit=50&coupon=NOPE");
  ok(unknown.total === 0 && Array.isArray(unknown.orders), "unknown code → clean empty page (no crash)");

  // ── probe order E: GLOW20 (3× university-box)
  const e = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R43", customerPhone: PHONE, customerAddress: "القاهرة",
    items: [{ id: "university-box", name: "University Box", price: 200, quantity: 3 }],
    paymentMethod: "cod",
    couponCode: "GLOW20",
  });
  ok(e.status === 200, "probe order E created", e.json?.orderNumber);

  const glow1 = await ordersPage("page=1&limit=50&coupon=GLOW20");
  ok(glow1.total === 1, "coupon=GLOW20 finds the probe order", `total ${glow1.total}`);
  ok(glow1.orders[0]?.items?.[0]?.quantity === 3, "filtered row carries its items payload");

  // ── drill↔orders consistency: drill units == filtered orders' item units
  const s1 = await stats();
  const drillQty = (s1.couponItems || []).find(g => g.code === "GLOW20")?.top?.find(d => d.slug === "university-box")?.qty;
  const orderQty = glow1.orders.reduce((a, o) => a + (o.items || []).filter(i => i.id === "university-box").reduce((b, i) => b + i.quantity, 0), 0);
  ok(drillQty === orderQty, "drill qty == coupon-filtered orders item qty (same truth, two views)", `${drillQty}==${orderQty}`);

  // ── unauth + regressions
  const unauth = await fetch(`${BASE}/api/admin/orders?page=1&coupon=LUBNEL10`);
  ok(unauth.status === 401, "unauth coupon query → 401");
  const csvBuf = new Uint8Array(await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).arrayBuffer());
  ok(csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf, "CSV export BOM intact (raw bytes)", [...csvBuf.slice(0, 3)].map(b => b.toString(16)).join(" "));

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
