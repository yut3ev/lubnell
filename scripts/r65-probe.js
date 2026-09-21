// R65 probe — owner phone workflow on the admin board (grouped display,
// copy chip, wa.me reachability guard). The feature is admin-side and
// zero-write; E2E proved via admin login + clipboard spy: rows read
// "010 1234 5678", copy yields the canonical digits, row-wa hrefs dial
// wa.me/2010… (never a double country code). This node probe pins the
// standing server contract (unauth → CSV BOM → book anchors → SSR a11y
// wiring → deep-link honesty → book phones all canonical) so drift is caught.
// R63 lesson holds: stubs were never reloaded after mounting — zero
// accidental orders; book verified unchanged below.
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
  console.log("── R65 probe: admin phone workflow (zero-write round, contract regression) ──");

  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // R65 NEW — every phone-shaped cell in the orders CSV is canonical 01X:
  // the board's grouped display, copy chip and wa.me guard all assume the
  // R64 storage contract, so this pins it against future odd-shaped writes.
  const csv = await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).text();
  const phones = csv.match(/01\d{9}/g) || [];
  ok(phones.length >= 6 && phones.every(p => /^01[0125]\d{8}$/.test(p)),
    `every book phone in orders CSV is canonical 01[0125]+8 (${phones.length} found)`, "");

  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "book anchors 6 orders / 2127 gross / 1981 net (zero-write round)", "");
  ok(s0.railConversions === 0 && Array.isArray(s0.railPulls) && s0.railPulls.length === 0, "quiet rail ledger", "");

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
  const pMiss = await fetch(`${BASE}/p/${encodeURIComponent("definitely-missing-r65")}`, { redirect: "manual" });
  ok(pMiss.status === 302, "/p/[unknown] → 302 to storefront", String(pMiss.status));

  console.log(`── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("probe crashed:", e); process.exit(1); });
