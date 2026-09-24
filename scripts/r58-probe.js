// R58 probe — mobile rail-first PDP (ZERO API change). The feature is a UI
// reposition + honest scroll-state fades, so the probe pins the CONTRACTS the
// feature stands on plus cross-round regressions: unauth guards → CSV BOM →
// b0 book anchors (6 / 2127 / 1981) → R55/R57 payload regressions (mixTrend
// revenue nested, board rates fields) → also-saved contract (400/404, schema)
// → SEEDED co-occurrence story: probe IP adds avocado-cucumber-box + three
// others via X-Forwarded-For, so the PDP rail must return basis "co" with
// exactly those 3 items (the state the E2E screenshots depend on) → rail-click
// validation matrix (400 ×2, 404, 200 with probe vid) → no vid leak → book
// untouched by wish/click seeding. Cleanup: scripts/r58-cleanup.js (probe IP
// wishEvents + probe-vid railEvent only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r58probevid1234567890";
const IP = "203.0.113.58"; // probe co-occurrence visitor (TEST-NET-3, never a real client)
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
const alsoSaved = async (slug) =>
  fetch(`${BASE}/api/store/products/also-saved${slug !== undefined ? `?slug=${encodeURIComponent(slug)}` : ""}`);
const clickRail = (from, target, vid) => fetch(`${BASE}/api/store/products/rail-click`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ from, target, ...(vid ? { vid } : {}) }),
});
const wish = (slug, action, ip) => fetch(`${BASE}/api/store/wishlist`, {
  method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  body: JSON.stringify({ slug, action }),
});

(async () => {
  console.log("── R58 probe: mobile rail-first PDP ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — book anchors + cross-round payload regressions
  const s0 = await stats();
  const net0 = s0.totals?.netRevenue ?? s0.netRevenue;
  console.log(`  [b0] book: ${s0.totals?.orders ?? "?"} orders / ${s0.totals?.revenue ?? "?"} gross / net ${net0}`);
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && net0 === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net", "");
  ok(!("mixRevTrend" in s0) && !!s0.mixTrend?.revenue,
    "R55 regression: revenue nested in mixTrend, no top-level mixRevTrend", "");
  ok((s0.railBoard || []).every(r => typeof r.revenue === "number" && typeof r.pulls === "number" && typeof r.sold === "number"),
    "R56/R57 regression: board rows carry numeric pulls/sold/revenue", "");
  ok(typeof s0.railConversions === "number" && Array.isArray(s0.railPulls),
    "R57 regression: railConversions + railPulls present for the rate lens", "");

  // ── 2: also-saved contract (validation + schema on the quiet book)
  const noSlug = await alsoSaved(undefined);
  ok(noSlug.status === 400, "also-saved missing slug → 400", String(noSlug.status));
  const badSlug = await alsoSaved("not-a-real-slug");
  ok(badSlug.status === 404, "also-saved unknown slug → 404", String(badSlug.status));

  // ── 3: seed the co-occurrence story (probe IP saves avocado + 3 others)
  const seeded = [];
  for (const slug of ["avocado-cucumber-box", "university-box", "care-makeup-box", "strawberry-lip-set"]) {
    const r = await wish(slug, "add", IP);
    seeded.push((await r.json()).success === true);
  }
  ok(seeded.every(Boolean), "seed: 4 wish adds recorded for the probe visitor", IP);
  const co = await (await alsoSaved("avocado-cucumber-box")).json();
  const coIds = (co.items || []).map(i => i.id).sort();
  ok(co.success === true && co.basis === "co", "rail basis upgraded to 'co' for avocado PDP", co.basis);
  ok(coIds.length === 3 && coIds.join(",") === "care-makeup-box,strawberry-lip-set,university-box",
    "co rail carries EXACTLY the probe visitor's other three saves", coIds.join(", "));
  ok((co.items || []).every(i => i.id && i.name && i.nameAr && typeof i.price === "number" && typeof i.image === "string" && i.count >= 1),
    "item schema: id/name/nameAr/price/image/count all present", "");
  ok(!(co.items || []).some(i => i.id === "avocado-cucumber-box"),
    "the current product never recommends itself", "");

  // ── 4: rail-click validation matrix (no rows for the 4xx paths)
  ok((await clickRail("avocado-cucumber-box", "")).status === 400, "rail-click missing target → 400", "");
  ok((await clickRail("avocado-cucumber-box", "avocado-cucumber-box")).status === 400, "rail-click from===target → 400", "");
  ok((await clickRail("avocado-cucumber-box", "not-a-real-slug")).status === 404, "rail-click unknown target → 404", "");
  const good = await clickRail("avocado-cucumber-box", "university-box", VID);
  ok(good.status === 200 && (await good.json()).success === true, "rail-click valid → 200 (probe vid rides along)", "");

  // ── 5: privacy + book hygiene
  const s1 = await stats();
  ok(!JSON.stringify(s1).includes(VID), "probe vid never leaks into any admin payload", "");
  ok(s1.totals?.orders === 6 && s1.totals?.revenue === 2127,
    "wish/click seeding leaves the order book untouched (6 / 2127)", "");

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE ERROR", e); process.exit(1); });
