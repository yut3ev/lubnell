// R42 probe — coupon code drill-down (stats.couponItems: which products each
// code actually sold). Baseline fixture is perfect for it: 4 LUBNEL10 orders,
// 1 cancelled → the 3 net orders are ALL coupon orders, so every best-seller
// unit must appear inside the LUBNEL10 drill with identical qty. Probe order E
// redeems GLOW20 (3× university-box) to test a second group; probe order F is
// the same basket but then CANCELLED — the drill must never count it (same
// convention as the coupon board: a cancelled order never redeemed anything).
// Cleanup = scripts/r42-cleanup.js (delete …039 orders + reset GLOW20 usageCount).
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
  const stats = async () => (await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json());

  // ── baseline: exactly one drill group (LUBNEL10), consistent with best sellers
  const s0 = await stats();
  const items0 = s0.couponItems || [];
  ok(Array.isArray(items0) && items0.length === 1, "baseline: exactly 1 drill group", JSON.stringify(items0.map(g => g.code)));
  ok(items0[0]?.code === "LUBNEL10", "baseline group is LUBNEL10");
  ok((items0[0]?.top || []).length > 0, "LUBNEL10 drill non-empty", JSON.stringify(items0[0]?.top?.map(d => `${d.slug}:${d.qty}`)));
  const best = new Map((s0.bestSellers || []).map(b => [b.slug, b.qty]));
  const qtyMatch = (items0[0]?.top || []).every(d => best.get(d.slug) === d.qty);
  ok(qtyMatch, "drill qty == bestSellers qty per slug (all net orders are coupon orders)");
  const drillSum = (items0[0]?.top || []).reduce((a, d) => a + d.qty, 0);
  const bestSum = (s0.bestSellers || []).reduce((a, b) => a + b.qty, 0);
  ok(drillSum === bestSum, "drill unit total == best-seller unit total", `${drillSum}==${bestSum}`);
  ok((items0[0]?.top || []).every(d => d.nameAr && d.nameAr !== d.slug), "names resolved via catalog meta");
  const bos = (items0[0]?.top || []).find(d => d.slug === "boscarest-purity-musk-wash");
  ok(!!bos && bos.nameAr === "Boscarest Purity Musk Wash", "deleted product keeps its order-item name (not raw slug)", bos?.nameAr);
  const uni = (items0[0]?.top || []).find(d => d.slug === "university-box");
  ok(!!uni && uni.image === "/images/products/lb-university-box.webp", "university-box real image (R35 parse path)", uni?.image);
  ok(!!uni && uni.revenue === uni.qty * 200, "drill revenue = qty × 200 catalog price", uni ? `${uni.qty}×200=${uni.revenue}` : "no row");
  const sorted0 = (items0[0]?.top || []).every((d, i, a) => i === 0 || a[i - 1].qty >= d.qty);
  ok(sorted0, "drill rows sorted by qty desc");

  // ── probe order E: GLOW20 (minSubtotal 500 → 3× university-box @200)
  const e = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R42", customerPhone: PHONE, customerAddress: "القاهرة",
    items: [{ id: "university-box", name: "University Box", price: 200, quantity: 3 }],
    paymentMethod: "cod",
    couponCode: "GLOW20",
  });
  ok(e.status === 200, "probe order E created", e.json?.orderNumber);
  ok(e.json?.discount === 120 && e.json?.total === 540, "server recomputed GLOW20 (120 off → 540 total)", JSON.stringify({ discount: e.json?.discount, total: e.json?.total }));

  const s1 = await stats();
  const glow1 = (s1.couponItems || []).find(g => g.code === "GLOW20");
  ok(!!glow1, "GLOW20 drill group appears after E");
  const g1 = glow1?.top?.[0];
  ok(g1?.slug === "university-box" && g1?.qty === 3 && g1?.revenue === 600, "GLOW20 drill: university-box 3 units / 600 EGP", JSON.stringify(g1));
  ok(!!g1?.image, "GLOW20 drill row carries real image", g1?.image);
  const lub1 = (s1.couponItems || []).find(g => g.code === "LUBNEL10");
  ok(!!lub1 && lub1.top.length > 0, "LUBNEL10 drill survives alongside the new group");

  // ── probe order F: same basket, then CANCELLED — must never enter the drill
  const f = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R42", customerPhone: PHONE, customerAddress: "القاهرة",
    items: [{ id: "university-box", name: "University Box", price: 200, quantity: 3 }],
    paymentMethod: "cod",
    couponCode: "GLOW20",
  });
  ok(f.status === 200, "probe order F created", f.json?.orderNumber);
  const list = await (await fetch(`${BASE}/api/admin/orders?phone=${PHONE}`, { headers: { cookie } })).json();
  const rows = Array.isArray(list) ? list : list.orders || [];
  const fRow = rows.find(o => o.orderNumber === f.json?.orderNumber);
  ok(!!fRow, "order F located in admin list");
  const cancel = await post(`${BASE}/api/admin/orders`, { id: fRow?.id, status: "cancelled" }, { cookie });
  ok(cancel.status === 200, "order F cancelled", JSON.stringify(cancel.json).slice(0, 80));

  const s2 = await stats();
  const glow2 = (s2.couponItems || []).find(g => g.code === "GLOW20");
  const g2qty = glow2?.top?.find(d => d.slug === "university-box")?.qty;
  ok(g2qty === 3, "cancelled F excluded from drill (GLOW20 qty still 3, not 6)", `got ${g2qty}`);
  ok(s2.couponPerf?.find(r => r.code === "GLOW20")?.orders === 1, "GLOW20 redemptions still 1 (cancel excluded)");
  const lub2 = (s2.couponItems || []).find(g => g.code === "LUBNEL10");
  const lubQty = lub2?.top?.find(d => d.slug === "university-box")?.qty;
  ok(lubQty === (s0.bestSellers || []).find(b => b.slug === "university-box")?.qty, "LUBNEL10 drill untouched by GLOW20 probe orders", `got ${lubQty}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
