// R64 probe — checkout phone honesty (Egyptian mobile canonicalisation,
// visible blur rewrite, format gate, track-query normalization). The feature
// is client-side; E2E proved: "abc" and landline "0223456789" blocked with
// inline rose note + zero POSTs; "+20 101 234 5678" and Arabic-Indic digits
// canonicalise visibly to 01012345678 (field + persisted value); the stubbed
// POST body and wa.me message carry the canonical form; the track page finds
// the same 4 book orders from canonical, +20-form AND Arabic-digit queries.
// This node probe pins the standing server contract (unauth → CSV BOM → book
// anchors → SSR a11y wiring → deep-link honesty) so any drift gets caught.
// R63 lesson applied: stubs were never reloaded after mounting — zero
// accidental orders this round; book verified unchanged below.
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
  console.log("── R64 probe: checkout phone honesty (client-side round, contract regression) ──");

  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net (zero-write round, stubs never reloaded)", "");
  ok(s0.railConversions === 0 && Array.isArray(s0.railPulls) && s0.railPulls.length === 0, "b0: quiet rail ledger", "");

  // SSR shell a11y wiring (R62) must survive this round
  const html = await (await fetch(`${BASE}/`, { cache: "no-store" })).text();
  ok(html.includes('id="storefront-main"'), "SSR shell carries #storefront-main anchor (R62 regression)", "");
  ok(html.includes("skip-link"), "SSR shell carries the skip-link button (R62 regression)", "");

  // Inventory truth is bootstrap-served: every published product row carries stock
  const boot = await (await fetch(`${BASE}/api/store/bootstrap`, { cache: "no-store" })).json();
  const pub = (boot.products || []).filter(p => p.visible !== false);
  ok(pub.length >= 5 && pub.every(p => typeof p.stock === "number"),
    `bootstrap exposes stock on all ${pub.length} published rows (bag cap data source)`, "");

  // Server deep-link honesty (R62 pins, must survive)
  const pMiss = await fetch(`${BASE}/p/${encodeURIComponent("definitely-missing-r63")}`, { redirect: "manual" });
  ok(pMiss.status === 302, "/p/[unknown] still 302-redirects", String(pMiss.status));

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE ERROR", e); process.exit(1); });
