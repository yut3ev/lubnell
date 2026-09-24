// R38 probe — verify couponPerf aggregation math.
// Baseline already carries the perfect fixture: 4 LUBNEL10 orders of which 1
// is cancelled → the board must show orders:3 (cancelled never redeemed),
// discount 69 (40+20+9), revenue 806. Then probe order E redeems GLOW20
// (percent 20, minSubtotal 500) on QA phone 011100000039 to test a second
// ranked row + totals deltas. Cleanup = scripts/r38-cleanup.js.
const BASE = "http://localhost:3000";
const PHONE = "011100000039";

async function post(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, setCookie: r.headers.get("set-cookie"), json: await r.json().catch(() => null) };
}

(async () => {
  const login0 = await post(`${BASE}/api/admin/auth`, { username: "owner", password: "lubnel1234", verificationCode: "7777" });
  const cookie = (login0.setCookie || "").split(";")[0];
  if (!cookie) { console.log("LOGIN FAILED", login0.status, JSON.stringify(login0.json)); process.exit(1); }
  const stats = async () => (await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json());

  // ── baseline: couponPerf must show exactly LUBNEL10 3/69/806 (cancel excluded)
  const s0 = await stats();
  const c0 = s0.couponPerf || [];
  const assert = (name, ok, extra = "") => console.log(ok ? `PASS ${name}` : `FAIL ${name} ${extra}`);
  console.log("BASELINE orders:", s0.totals.orders, "gross:", s0.totals.revenue, "net:", s0.totals.netRevenue, "| couponPerf:", JSON.stringify(c0));
  assert("baseline: exactly 1 coupon row (LUBNEL10)", c0.length === 1 && c0[0].code === "LUBNEL10", JSON.stringify(c0));
  assert("baseline: cancelled LUBNEL10 order excluded (orders=3 not 4)", c0[0]?.orders === 3, `got ${c0[0]?.orders}`);
  assert("baseline: discount sum 69 (40+20+9)", c0[0]?.discount === 69, `got ${c0[0]?.discount}`);
  assert("baseline: attributed revenue 806", c0[0]?.revenue === 806, `got ${c0[0]?.revenue}`);
  assert("baseline: meta resolved (percent 10, active)", c0[0]?.kind === "percent" && c0[0]?.value === 10 && c0[0]?.active === true, JSON.stringify(c0[0]));

  // ── probe E: GLOW20 needs subtotal >= 500 → 3× university-box (catalog 200)
  const e = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R38", customerPhone: PHONE, customerAddress: "القاهرة",
    items: [{ id: "university-box", name: "University Box", price: 600, quantity: 3 }],
    paymentMethod: "cod",
    couponCode: "GLOW20",
  });
  if (e.status !== 200) { console.log("PROBE E FAILED", e.status, JSON.stringify(e.json)); process.exit(1); }
  console.log("probe E:", e.json.orderNumber, "subtotal:", e.json.subtotal, "discount:", e.json.discount, "shipping:", e.json.shipping, "total:", e.json.total);

  // ── after: 2 ranked rows + totals deltas
  const s1 = await stats();
  const c1 = s1.couponPerf || [];
  console.log("AFTER orders:", s1.totals.orders, "gross:", s1.totals.revenue, "net:", s1.totals.netRevenue, "| couponPerf:", JSON.stringify(c1));
  const lub = c1.find(r => r.code === "LUBNEL10");
  const glow = c1.find(r => r.code === "GLOW20");
  assert("E: server recomputed GLOW20 discount 120 (20% of 600)", e.json.discount === 120 && e.json.total === 540, JSON.stringify(e.json));
  assert("after: 2 coupon rows ranked", c1.length === 2, JSON.stringify(c1.map(r => r.code)));
  assert("LUBNEL10 stays rank 1 (3 uses > 1)", c1[0]?.code === "LUBNEL10" && lub?.orders === 3);
  assert("GLOW20 row 1 use / 120 discount / 540 revenue", glow?.orders === 1 && glow?.discount === 120 && glow?.revenue === 540, JSON.stringify(glow));
  assert("GLOW20 meta (percent 20, active)", glow?.kind === "percent" && glow?.value === 20 && glow?.active === true);
  assert("totals.orders 4→5", s1.totals.orders === 5, `got ${s1.totals.orders}`);
  assert("gross revenue 952→1492 (+540)", s1.totals.revenue === 1492, `got ${s1.totals.revenue}`);
  assert("net revenue 806→1346 (+540)", s1.totals.netRevenue === 1346, `got ${s1.totals.netRevenue}`);
  // coupon rows must never include cancelled: recompute invariant
  const sumOrders = c1.reduce((a, r) => a + r.orders, 0);
  assert("redemptions sum 4 = non-cancelled coupon orders", sumOrders === 4, `got ${sumOrders}`);
})();
