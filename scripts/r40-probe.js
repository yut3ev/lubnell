// R40 probe — wishlist demand tracking: endpoint + stats board math.
// Run AFTER build+restart. Cleanup with scripts/r40-cleanup.js afterwards.
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
  const setCookie = res.headers.get("set-cookie") || "";
  cookie = (setCookie.match(/lubnel_admin_session=[^;]+/) || [""])[0];
  return res.ok && !!cookie;
};
const stats = async () => (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
const wish = async (slug, action, ip) => fetch(`${BASE}/api/store/wishlist`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip || "10.40.0.1" },
  body: JSON.stringify({ slug, action }),
});

(async () => {
  console.log("── R40 probe: wishlist demand board ──");
  ok(await adminAuth(), "admin auth");

  // Baseline: zero events, and the R35 image-fix is live on best sellers
  let s = await stats();
  ok(Array.isArray(s.topWished) && s.topWished.length === 0, "baseline topWished empty", JSON.stringify(s.topWished));
  ok(s.wishAdds === 0, "baseline wishAdds 0", String(s.wishAdds));
  const uni = s.bestSellers.find(b => b.slug === "university-box");
  ok(!!uni && uni.image.startsWith("/images/"), "R40 FIX bestSellers image parsed", uni && uni.image);

  // Unknown slug → 404
  const nf = await wish("no-such-product-xyz", "add");
  ok(nf.status === 404, "unknown slug 404", String(nf.status));

  // adds: university-box ×3 (distinct visitor IPs), strawberry-lip-set ×1
  for (const ip of ["10.40.0.11", "10.40.0.12", "10.40.0.13"]) {
    const r = await wish("university-box", "add", ip);
    ok(r.ok, `add university-box from ${ip}`);
  }
  const r4 = await wish("strawberry-lip-set", "add", "10.40.0.14");
  ok(r4.ok, "add strawberry-lip-set");

  // Throttle: same slug+action+ip within 8s → throttled, no extra row
  const rt = await wish("university-box", "add", "10.40.0.11");
  ok(rt.ok, "throttled add still 2xx");
  const tj = await rt.json().catch(() => ({}));
  ok(tj.throttled === true, "throttle flag returned", JSON.stringify(tj));

  // A remove is recorded but must NOT retract the add (board counts adds)
  const rr = await wish("strawberry-lip-set", "remove", "10.40.0.15");
  ok(rr.ok, "remove strawberry-lip-set recorded");

  s = await stats();
  const tw = s.topWished;
  ok(tw.length === 2, "two wish rows", JSON.stringify(tw.map(w => [w.slug, w.adds, w.sold])));
  ok(tw[0] && tw[0].slug === "university-box" && tw[0].adds === 3, "university-box tops with 3 adds");
  ok(tw[0] && tw[0].sold === 3, "university-box sold 3 (matches best-sellers qty)", String(tw[0] && tw[0].sold));
  ok(tw[0] && tw[0].image.startsWith("/images/") && tw[0].nameAr.length > 0, "meta resolved (nameAr + image)", tw[0] && tw[0].image);
  ok(tw[1] && tw[1].slug === "strawberry-lip-set" && tw[1].adds === 1 && tw[1].sold === 0, "strawberry-lip-set 1 add / 0 sold (remove not retraction)");
  ok(s.wishAdds === 4, "wishAdds totals 4", String(s.wishAdds));

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
