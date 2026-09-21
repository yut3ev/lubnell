// R39 probe — verify the coupon efficiency lens (couponPerfEff).
// Baseline: single LUBNEL10 row 3/69/806, perPage 269 — both boards identical.
// Probe F redeems WELCOME50 (fixed 50, minSubtotal 300) on QA phone
// 011100000040: 2× university-box = 400 subtotal → discount 50, total 410.
// After: uses-board [LUBNEL10(3), WELCOME50(1)] but basket-board is FLIPPED
// [WELCOME50(410/use), LUBNEL10(269/use)] — the disagreement is the feature.
// Cleanup = scripts/r39-cleanup.js (deletes phone …040, WELCOME50 usageCount −1).
const BASE = "http://localhost:3000";
const PHONE = "011100000040";

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
  const assert = (name, ok, extra = "") => console.log(ok ? `PASS ${name}` : `FAIL ${name} ${extra}`);

  // ── baseline: one row on both lenses, perPage 269
  const s0 = await stats();
  console.log("BASELINE uses:", JSON.stringify(s0.couponPerf));
  console.log("BASELINE basket:", JSON.stringify(s0.couponPerfEff));
  assert("baseline uses: LUBNEL10 3/69/806", s0.couponPerf?.length === 1 && s0.couponPerf[0].orders === 3 && s0.couponPerf[0].discount === 69 && s0.couponPerf[0].revenue === 806);
  assert("baseline perPage 269 (806/3)", s0.couponPerf?.[0].perPage === 269, `got ${s0.couponPerf?.[0]?.perPage}`);
  assert("baseline basket lens identical (single row)", JSON.stringify(s0.couponPerfEff) === JSON.stringify(s0.couponPerf));

  // ── probe F: WELCOME50, 2× university-box (catalog 200 → subtotal 400 ≥ 300)
  const f = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R39", customerPhone: PHONE, customerAddress: "الجيزة",
    items: [{ id: "university-box", name: "University Box", price: 400, quantity: 2 }],
    paymentMethod: "cod",
    couponCode: "WELCOME50",
  });
  if (f.status !== 200) { console.log("PROBE F FAILED", f.status, JSON.stringify(f.json)); process.exit(1); }
  console.log("probe F:", f.json.orderNumber, "subtotal:", f.json.subtotal, "discount:", f.json.discount, "total:", f.json.total);

  // ── after: boards disagree — that's the point
  const s1 = await stats();
  const uses = s1.couponPerf || [], basket = s1.couponPerfEff || [];
  console.log("AFTER uses:", JSON.stringify(uses));
  console.log("AFTER basket:", JSON.stringify(basket));
  const welcome = uses.find(r => r.code === "WELCOME50");
  assert("F: fixed 50 off recomputed (total 410)", f.json.discount === 50 && f.json.total === 410, JSON.stringify(f.json));
  assert("uses board: LUBNEL10 rank1 (3 uses)", uses[0]?.code === "LUBNEL10" && uses[0]?.orders === 3);
  assert("uses board: WELCOME50 1/50/410", welcome?.orders === 1 && welcome?.discount === 50 && welcome?.revenue === 410);
  assert("WELCOME50 meta fixed/50/active + perPage 410", welcome?.kind === "fixed" && welcome?.value === 50 && welcome?.active === true && welcome?.perPage === 410, JSON.stringify(welcome));
  assert("basket board FLIPPED: WELCOME50 rank1 (410 > 269)", basket[0]?.code === "WELCOME50" && basket[1]?.code === "LUBNEL10", JSON.stringify(basket.map(r => r.code)));
  assert("basket board: LUBNEL10 perPage 269", basket[1]?.perPage === 269);
  assert("uses ≠ basket ordering (lens disagreement proven)", JSON.stringify(uses.map(r => r.code)) !== JSON.stringify(basket.map(r => r.code)));
  assert("totals.orders 4→5, gross 952→1362 (+410)", s1.totals.orders === 5 && s1.totals.revenue === 1362, `${s1.totals.orders}/${s1.totals.revenue}`);
  assert("redemptions sum 4", uses.reduce((a, r) => a + r.orders, 0) === 4);
})();
