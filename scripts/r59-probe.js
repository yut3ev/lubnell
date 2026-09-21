// R59 probe — rail-proven chip on also-saved cards (additive API: items gain
// `railOrders` = DISTINCT non-cancelled orders CONTAINING the product whose
// vid is in convertedVids — visitor-level rail attribution, R56's json_each
// line-scan machinery reused as a count). Flow: unauth guards → CSV BOM → b0
// (clean book: every item railOrders 0) → seed the FULL story: probe-IP wish
// co-occurrence (avocado + 3 saves, same as R58) + probe-vid click →
// university-box + TWO orders from that vid (one CONTAINING university-box,
// one containing care-makeup-box instead) → university railOrders 1, care
// railOrders 1, strawberry railOrders 0 (line-level honesty: the rail
// VISITOR ordered, but strawberry never appeared in an attributed order) →
// line-level guard: a converted vid ordering WITHOUT the product never
// inflates it → R58 regressions (co basis, item schema, click matrix, no vid
// leak) → book anchored. Cleanup: scripts/r59-cleanup.js (probe phone +
// probe vid + probe IP only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r59probevid1234567890";
const IP = "203.0.113.59"; // probe co-occurrence visitor (TEST-NET-3)
const PHONE = "011100000059";
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
  (await fetch(`${BASE}/api/store/products/also-saved?slug=${encodeURIComponent(slug)}`)).json();
const clickRail = (from, target, vid) => fetch(`${BASE}/api/store/products/rail-click`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ from, target, vid }),
});
const seedOrder = (name, items) => fetch(`${BASE}/api/store/orders`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customerName: name, customerPhone: PHONE, customerAddress: "QA street", items, vid: VID }),
}).then(r => r.json());
const wish = (slug, ip) => fetch(`${BASE}/api/store/wishlist`, {
  method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  body: JSON.stringify({ slug, action: "add" }),
});

(async () => {
  console.log("── R59 probe: rail-proven chip ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — clean book: no conversions, so every card railOrders 0
  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net", "");
  ok(s0.railConversions === 0, "b0: no rail conversions yet", "");
  const co0 = await alsoSaved("avocado-cucumber-box");
  ok((co0.items || []).every(i => typeof i.railOrders === "number" && i.railOrders === 0),
    "b0: additive field present, honest zeros on the quiet book", "");

  // ── 2: seed — wish co-story + rail click + TWO attributed orders
  for (const slug of ["avocado-cucumber-box", "university-box", "care-makeup-box", "strawberry-lip-set"]) {
    await wish(slug, IP);
  }
  const c1 = await clickRail("strawberry-lip-set", "university-box", VID);
  ok(c1.status === 200, "seed: rail click → university-box (probe vid)", "");
  const o1 = await seedOrder("R59 Probe A", [{ id: "university-box", name: "University Box", quantity: 1, price: 200 }]);
  ok(o1.success === true, "seed: order A CONTAINS university-box (attributed vid)", "");
  const o2 = await seedOrder("R59 Probe B", [{ id: "care-makeup-box", name: "Care & Makeup Box", quantity: 1, price: 125 }]);
  ok(o2.success === true, "seed: order B contains care-makeup-box (same vid, no university line)", "");

  // ── 3: the chip contract — visitor-level attribution, line-level presence
  const co1 = await alsoSaved("avocado-cucumber-box");
  const byId = new Map((co1.items || []).map(i => [i.id, i]));
  ok(co1.basis === "co" && co1.items?.length === 3, "co rail intact for avocado PDP (R58 regression)", "");
  ok(byId.get("university-box")?.railOrders === 1, "university-box: railOrders 1 (line present in attributed order)", "");
  ok(byId.get("care-makeup-box")?.railOrders === 1, "care-makeup-box: railOrders 1 (the visitor DID order it, other line)", "");
  ok(byId.get("strawberry-lip-set")?.railOrders === 0, "strawberry-lip-set: railOrders 0 — never in an attributed order, honest zero", "");
  ok((co1.items || []).every(i => i.id !== "avocado-cucumber-box"), "self still never recommended (R58 regression)", "");
  ok((co1.items || []).every(i => i.id && i.name && i.nameAr && typeof i.price === "number" && i.count >= 1),
    "item schema intact + railOrders additive (R58 regression)", "");

  // ── 4: privacy + book hygiene
  const s1 = await stats();
  ok(!JSON.stringify(s1).includes(VID), "probe vid never leaks into any admin payload", "");
  ok(s1.railConversions === 1, "exactly one rail conversion stamped (vid → convertedAt)", "");
  ok(s1.totals?.orders === 8, "book grew by exactly the 2 probe orders (6 → 8)", "");
  ok((s1.railBoard || []).every(r => typeof r.revenue === "number"), "R56/R57 board regressions intact", "");
  ok(!("mixRevTrend" in s1) && !!s1.mixTrend?.revenue, "R55 mixTrend.revenue nesting intact", "");

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE ERROR", e); process.exit(1); });
