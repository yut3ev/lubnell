// R62 probe — honest not-found layer (unknown-hash 404 + dead-product-link
// honesty + skip-link). ZERO server/API change this round: everything is
// client-side (parseHash default branch, ProductView guard, NotFoundView).
// The node probe pins (a) the standing contract that must NOT drift (unauth,
// book anchors, CSV BOM, also-saved sanity) and (b) the server deep-link
// honesty that already existed (/p + /c unknown → 302 /) and must keep
// existing, plus (c) the SSR shell now carrying the skip-link + main anchor.
// The UI itself is verified via agent-browser (hash routing is client-side).
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
const stats = async () => (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
const bom = async (path) => {
  const bytes = new Uint8Array(await (await fetch(`${BASE}${path}`, { headers: { cookie } })).arrayBuffer());
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
};

(async () => {
  console.log("── R62 probe: honest not-found layer (client-side round, contract regression) ──");

  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net", "");

  const boot = await (await fetch(`${BASE}/api/store/bootstrap`, { cache: "no-store" })).json();
  const firstProduct = (boot.products || []).find(p => p.visible !== false);
  ok(!!firstProduct, "bootstrap publishes ≥1 product (needed for the dead-link regression)", firstProduct?.id || "none");

  // SSR shell must now carry the a11y wiring (client components SSR on load)
  const html = await (await fetch(`${BASE}/`, { cache: "no-store" })).text();
  ok(html.includes('id="storefront-main"'), "SSR shell carries #storefront-main anchor", "");
  ok(html.includes("skip-link"), "SSR shell carries the skip-link button", "");
  ok(html.includes("تخطَّ إلى المحتوى"), "SSR shell skip-link default-copy AR", "");

  // Server deep-link honesty (pre-existing, must survive the round)
  const pMiss = await fetch(`${BASE}/p/${encodeURIComponent("definitely-missing-r62")}`, { redirect: "manual" });
  ok(pMiss.status === 302 && (pMiss.headers.get("location") || "").includes("://"),
    "/p/[unknown] still 302-redirects (server honesty intact)", String(pMiss.status));
  const cMiss = await fetch(`${BASE}/c/${encodeURIComponent("definitely-missing-r62")}`, { redirect: "manual" });
  ok(cMiss.status === 302, "/c/[unknown] still 302-redirects", String(cMiss.status));

  // Book residue: this round performs ZERO writes; anchors re-checked at the end
  const s1 = await stats();
  ok(s1.totals?.orders === 6 && s1.totals?.revenue === 2127 && s1.totals?.netRevenue === 1981,
    "post-probe book unchanged (zero-write round)", "");

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE ERROR", e); process.exit(1); });
