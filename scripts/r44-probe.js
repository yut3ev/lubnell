// R44 probe — deep-link round trip (server half) + per-product wish trend.
// UI half (crumb, auto-open drill, wish hover spark) verified via agent-browser
// AFTER this probe, which deliberately LEAVES the 3 seeded WishEvents in place
// for the hover test — cleanup afterwards with scripts/r40-cleanup.js
// (deleteMany WishEvents is an exact baseline restore; no counters involved).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1, next binds IPv4
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
const wish = async (slug, action, ip) => fetch(`${BASE}/api/store/wishlist`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
  body: JSON.stringify({ slug, action }),
});

(async () => {
  console.log("── R44 probe: round-trip server half + wish row trend ──");
  ok(await adminAuth(), "admin auth");

  // Baseline
  let s = await stats();
  ok((s.topWished || []).length === 0 && s.wishAdds === 0, "baseline 0 wish rows", JSON.stringify(s.wishAdds));
  ok((s.couponItems || []).length === 1 && s.couponItems[0].code === "LUBNEL10" && s.couponItems[0].top.length === 2, "baseline 1 drill group LUBNEL10/2 rows");
  const list = await orders("coupon=LUBNEL10");
  const rows1 = Array.isArray(list) ? list : list.orders || [];
  ok(rows1.length === 4, "R43 regression: coupon=LUBNEL10 → 4 orders (cancelled incl.)", String(rows1.length));

  // Seed wish events (distinct IPs beat the 8s per-slug+ip throttle)
  ok((await wish("university-box", "add", "10.44.0.11")).ok, "add university-box #1");
  ok((await wish("university-box", "add", "10.44.0.12")).ok, "add university-box #2");
  ok((await wish("strawberry-lip-set", "add", "10.44.0.13")).ok, "add strawberry-lip-set");
  ok((await wish("university-box", "remove", "10.44.0.14")).ok, "remove university-box (must not dent trend)");

  s = await stats();
  const tw = s.topWished || [];
  ok(tw.length === 2, "topWished 2 rows", JSON.stringify(tw.map(r => r.slug)));
  const ub = tw.find(r => r.slug === "university-box");
  const sl = tw.find(r => r.slug === "strawberry-lip-set");
  ok(ub && ub.adds === 2, "university-box adds=2 (remove not counted)", ub && String(ub.adds));
  ok(ub && Array.isArray(ub.trend) && ub.trend.length === 7, "row trend is 7 buckets", ub && JSON.stringify(ub.trend));
  ok(ub && ub.trend.slice(0, 6).every(v => v === 0) && ub.trend[6] === 2, "trend: 6 quiet days, today=2");
  ok(ub && ub.week === 2, "row week=2", ub && String(ub.week));
  ok(ub && ub.trend.reduce((a, b) => a + b, 0) === ub.week, "row trend sum == row week");
  ok(sl && sl.adds === 1 && sl.trend[6] === 1 && sl.week === 1, "strawberry-lip-set 1/1 on today");
  ok(ub && ub.sold === 3, "university-box sold=3 unchanged (sales join intact)", ub && String(ub.sold));
  const rowsWeek = tw.reduce((a, r) => a + (r.week || 0), 0);
  ok(rowsWeek === s.wishAddsWeek, "rows' week sum == aggregate wishAddsWeek (same window)", `${rowsWeek}==${s.wishAddsWeek}`);
  const aggTrend = (s.wishTrend || []).map(p => p.adds);
  ok(aggTrend[6] === 3 && aggTrend.slice(0, 6).every(v => v === 0), "aggregate trend counts all adds (2+1=3 today, remove excluded)", JSON.stringify(aggTrend));

  console.log(`── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
