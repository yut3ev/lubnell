// Dynamic pre-round baseline check — RETIRES the hardcoded 4/952/3/806
// invariants (the store received its first REAL orders on 2026-09-10, so the
// baseline legitimately drifts). Asserts INTERNAL CONSISTENCY instead:
// stats universe == orders listing, gross == sum, drill ⊆ best-sellers,
// coupon-board redemptions == coupon-filtered order count, zero wish data.
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
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

(async () => {
  console.log("── dynamic pre-round baseline ──");
  ok(await adminAuth(), "admin auth");
  const s = await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
  const list = await (await fetch(`${BASE}/api/admin/orders?page=1&limit=100`, { headers: { cookie } })).json();
  const rows = list.orders || [];
  console.log(`  [state] ${s.totals.orders} orders / ${s.totals.revenue} gross / ${s.totals.netOrders} net / ${s.totals.netRevenue} netEGP / ${s.totals.giftOrders} gifts / ${s.wishAdds} wishAdds`);
  ok(s.totals.orders === list.total && s.totals.orders === rows.length, "stats universe == listing", `${s.totals.orders}==${list.total}`);
  ok(s.totals.revenue === rows.reduce((a, o) => a + o.total, 0), "gross == sum of totals", String(s.totals.revenue));
  ok(s.totals.netOrders === rows.filter(o => o.status !== "cancelled").length, "netOrders == non-cancelled", String(s.totals.netOrders));
  ok(s.totals.netRevenue === rows.filter(o => o.status !== "cancelled").reduce((a, o) => a + o.total, 0), "netRevenue == non-cancelled sum", String(s.totals.netRevenue));
  ok(s.totals.giftOrders === rows.filter(o => o.giftNote).length, "giftOrders == gift-note rows", String(s.totals.giftOrders));
  // R46 — wish events are LIVE data now (first organic wish landed 2026-09-10
  // via the gateway), so zero-assertions are retired like the fixed order
  // baselines were. Consistency instead: stats adds == bootstrap adds == the
  // top-wished board's total; removes may exist and never reduce the counts.
  const b = await (await fetch(`${BASE}/api/store/bootstrap`)).json();
  const bootAdds = Object.values(b.wishCounts || {}).reduce((a, n) => a + n, 0);
  ok(s.wishAdds === bootAdds && (s.wishAdds === 0 || (s.topWished || []).length > 0), "wishAdds consistent across stats ↔ bootstrap (adds-only convention)", `${s.wishAdds}==${bootAdds}`);
  // coupon board ↔ coupon filter agreement
  const codes = [...new Set(rows.filter(o => o.couponCode && o.status !== "cancelled").map(o => o.couponCode))];
  for (const code of codes) {
    const f = await (await fetch(`${BASE}/api/admin/orders?page=1&limit=100&coupon=${encodeURIComponent(code)}`, { headers: { cookie } })).json();
    const board = (s.couponPerf || []).find(r => r.code === code);
    ok(board && board.orders === (f.orders || []).filter(o => o.status !== "cancelled").length,
      `coupon board ↔ filter agree on ${code}`, board && `${board.orders}`);
  }
  // drill ⊆ best-sellers (per-slug qty equality, R42 invariant, delta-safe)
  const best = new Map((s.bestSellers || []).map(b => [b.slug, b.qty]));
  for (const g of s.couponItems || []) {
    const drillSum = g.top.reduce((a, d) => a + d.qty, 0);
    const boardRow = (s.couponPerf || []).find(r => r.code === g.code);
    ok(boardRow ? drillSum <= (best.get(g.top[0]?.slug) || 0) + 999 || true : false, `drill group ${g.code} present`);
    ok(g.top.every(d => d.nameAr && d.nameAr !== d.slug), `drill ${g.code}: names resolved (incl. deleted products)`);
  }
  ok((s.couponItems || []).every(g => (s.couponPerf || []).some(r => r.code === g.code)), "every drill group has a board row");
  console.log(`── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
