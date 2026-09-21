// R41 probe — wishlist daily sparkline + week-over-week pair.
// Run AFTER build+restart (r40 endpoint exists since R40's build). The r40
// probe/cleanup left baseline at 0 WishEvents. Cleanup afterwards with
// scripts/r40-cleanup.js (same exact-restore: deleteMany WishEvents).
const BASE = "http://localhost:3000";
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
const wish = async (slug, action, ip) => fetch(`${BASE}/api/store/wishlist`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip || "10.41.0.1" },
  body: JSON.stringify({ slug, action }),
});

(async () => {
  console.log("── R41 probe: wish spark + weekly pair ──");
  ok(await adminAuth(), "admin auth");

  // Baseline: trend exists (7 points, all zero), weekly pair zero
  let s = await stats();
  ok(Array.isArray(s.wishTrend) && s.wishTrend.length === 7, "baseline wishTrend 7 points", JSON.stringify(s.wishTrend?.map(p => p.adds)));
  ok(s.wishTrend.every(p => p.adds === 0), "baseline all-zero days");
  ok(s.wishAddsWeek === 0 && s.wishAddsPrevWeek === 0, "baseline weekly pair 0/0", `${s.wishAddsWeek}/${s.wishAddsPrevWeek}`);

  // 2 adds today (distinct IPs) + 1 remove (must not count)
  ok((await wish("university-box", "add", "10.41.0.11")).ok, "add university-box");
  ok((await wish("strawberry-lip-set", "add", "10.41.0.12")).ok, "add strawberry-lip-set");
  ok((await wish("university-box", "remove", "10.41.0.13")).ok, "remove recorded");

  s = await stats();
  const today = s.wishTrend[s.wishTrend.length - 1];
  ok(today.adds === 2, "today's bucket = 2 adds (remove excluded)", JSON.stringify(today));
  ok(s.wishTrend.slice(0, 6).every(p => p.adds === 0), "previous 6 days stay zero");
  ok(s.wishAdds === 2, "lifetime adds = 2", String(s.wishAdds));
  ok(s.wishAddsWeek === 2 && s.wishAddsPrevWeek === 0, "weekly pair 2/0 (delta +2)", `${s.wishAddsWeek}/${s.wishAddsPrevWeek}`);
  const sum = s.wishTrend.reduce((a, p) => a + p.adds, 0);
  ok(sum === s.wishAddsWeek, "trend sum == weekly count (same convention)", `${sum}==${s.wishAddsWeek}`);
  const slugs = s.topWished.map(w => w.slug).sort();
  ok(s.topWished.length === 2 && slugs[0] === "strawberry-lip-set" && slugs[1] === "university-box", "topWished has both slugs (1-add tie order indeterminate)", JSON.stringify(slugs));

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
