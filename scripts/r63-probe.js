// R63 probe — bag inventory honesty (stock-capped stepper, at-cap note,
// sold-out row states, checkout guard) + the WhatsApp template's delivery
// line (R62 pool #3 ride-along). The feature itself is client-side; the
// template branches were E2E-proven via stubbed window.fetch/window.open
// (BOTH branches: subtotal 800 → "التوصيل: 60 ج.م", 2400 → "مجاني"). This
// node probe pins the standing server contract (unauth → CSV BOM → book
// anchors → SSR a11y wiring → deep-link honesty) so any drift gets caught.
// Book stayed quiet through E2E (one accidental order from the reload-wipes-
// stubs lesson was deleted by r63-cleanup; see that script's header).
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
  console.log("── R63 probe: bag inventory honesty (client-side round, contract regression) ──");

  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net (accidental E2E order cleaned)", "");
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
