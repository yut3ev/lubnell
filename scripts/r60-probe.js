// R60 probe — cart cross-sell ("كمّلي حقيبتكِ"): the also-saved endpoint now
// answers a MISSING slug with the store-wide most-saved products (tier "top")
// and honors an `exclude` CSV (the bag's slugs); a PRESENT unknown slug stays
// 404. Flow: unauth guards → CSV BOM → b0 (quiet book: exactly 1 store-wide
// card — the residual local add on university-box; exclude removes it) →
// seed the story: probe-IP wish adds ×4 + probe-vid rail click + TWO orders
// (university / care) → store-wide: university leads (count 2), railOrders
// proof carries through, exclude drops bag items deterministically, exclude-
// everything is honestly empty, unknown exclude slugs harmless → anchored
// path UNCHANGED (co basis, self-exclusion, R59 chips, exclude ignored) →
// click matrix + privacy + book anchored. Cleanup: scripts/r60-cleanup.js
// (probe phone …060 + probe vid + probe IP 203.0.113.60 only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r60probevid1234567890";
const IP = "203.0.113.60"; // probe wish visitor (TEST-NET-3)
const PHONE = "011100000060";
const SEED = ["avocado-cucumber-box", "university-box", "care-makeup-box", "strawberry-lip-set"];
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
const alsoSavedRaw = async (qs) => fetch(`${BASE}/api/store/products/also-saved${qs}`);
const alsoSaved = async (qs) => (await alsoSavedRaw(qs)).json();
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
  console.log("── R60 probe: cart cross-sell (كمّلي حقيبتكِ) ──");

  // ── 0: unauth guards + hygiene regressions
  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 — quiet book: store-wide top saves is exactly the residual truth
  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net", "");
  ok(s0.railConversions === 0, "b0: no rail conversions yet", "");
  const top0 = await alsoSaved("");
  ok(top0.success === true && top0.basis === "top" && top0.items?.length === 1 && top0.items[0].id === "university-box",
    "b0: missing slug → 200 store-wide top saves, exactly the residual local add", "basis " + top0.basis);
  ok(top0.items?.[0]?.count === 1 && top0.items?.[0]?.railOrders === 0 &&
      typeof top0.items?.[0]?.name === "string" && typeof top0.items?.[0]?.price === "number",
    "b0: store-wide item schema intact, railOrders 0 additive", "");
  const ex0 = await alsoSaved("?exclude=university-box");
  ok(ex0.success === true && Array.isArray(ex0.items) && ex0.items.length === 0,
    "b0: exclude removes the only candidate → honest empty list", "");
  const unk = await alsoSavedRaw("?slug=not-a-real-slug");
  ok(unk.status === 404, "unknown PRESENT slug still 404 (only MISSING slug changed)", String(unk.status));

  // ── 2: seed — wish adds ×4 + rail click + TWO attributed orders
  for (const slug of SEED) { await wish(slug, IP); }
  const c1 = await clickRail("strawberry-lip-set", "university-box", VID);
  ok(c1.status === 200, "seed: rail click → university-box (probe vid)", "");
  const o1 = await seedOrder("R60 Probe A", [{ id: "university-box", name: "University Box", quantity: 1, price: 200 }]);
  ok(o1.success === true, "seed: order A CONTAINS university-box (attributed vid)", "");
  const o2 = await seedOrder("R60 Probe B", [{ id: "care-makeup-box", name: "Care & Makeup Box", quantity: 1, price: 125 }]);
  ok(o2.success === true, "seed: order B contains care-makeup-box (same vid)", "");

  // ── 3: store-wide contract with the seeded story
  const top1 = await alsoSaved("");
  const byId = new Map((top1.items || []).map(i => [i.id, i]));
  ok(top1.basis === "top" && top1.items?.length === 3 && byId.get("university-box")?.count === 2,
    "store-wide: university-box leads with count 2 (local + probe adds), top 3 returned", "");
  ok(byId.get("university-box")?.railOrders === 1,
    "store-wide: railOrders proof rides the strip (university 1)", "");
  ok((byId.get("care-makeup-box")?.railOrders ?? 1) === 1 && (byId.get("avocado-cucumber-box")?.railOrders ?? 0) === 0 && (byId.get("strawberry-lip-set")?.railOrders ?? 0) === 0,
    "store-wide: care 1, avocado/strawberry honest zeros (when the tie includes them)", "");
  const ex1 = await alsoSaved("?exclude=university-box,care-makeup-box");
  ok(ex1.items?.length === 2 && ex1.items.every(i => i.id === "avocado-cucumber-box" || i.id === "strawberry-lip-set"),
    "exclude drops the bag's slugs deterministically (exactly avocado + strawberry)", "");
  const exAll = await alsoSaved(`?exclude=${SEED.join(",")}`);
  ok(exAll.success === true && exAll.items?.length === 0,
    "exclude everything → honest empty list (strip hides)", "");
  const exMix = await alsoSaved("?exclude=university-box,not-a-real-slug,also-fake");
  ok(exMix.items?.length === 3 && exMix.items.every(i => i.id !== "university-box"),
    "unknown slugs inside exclude are harmless (university excluded, the other 3 remain)", "");

  // ── 4: anchored path regression — byte-for-byte R58/R59 behavior
  const co1 = await alsoSaved("?slug=avocado-cucumber-box");
  const coById = new Map((co1.items || []).map(i => [i.id, i]));
  ok(co1.basis === "co" && co1.items?.length === 3 && !coById.has("avocado-cucumber-box"),
    "co rail intact for avocado PDP, self never recommended (R58 regression)", "");
  ok(coById.get("university-box")?.railOrders === 1 && coById.get("care-makeup-box")?.railOrders === 1 && coById.get("strawberry-lip-set")?.railOrders === 0,
    "R59 railOrders chips intact on the PDP path (1 / 1 / honest 0)", "");
  const coEx = await alsoSaved("?slug=avocado-cucumber-box&exclude=university-box,care-makeup-box");
  ok(coEx.items?.length === 3 && coEx.items.every(i => i.id !== "avocado-cucumber-box"),
    "exclude IGNORED on the anchored path (PDP contract untouched)", "");

  // ── 5: rail-click matrix regression (R58)
  ok((await clickRail("strawberry-lip-set", "", VID)).status === 400, "click matrix: missing target → 400", "");
  ok((await clickRail("strawberry-lip-set", "strawberry-lip-set", VID)).status === 400, "click matrix: from===target → 400", "");
  ok((await clickRail("strawberry-lip-set", "not-a-real-slug", VID)).status === 404, "click matrix: unknown target → 404", "");

  // ── 6: privacy + book hygiene
  const s1 = await stats();
  ok(!JSON.stringify(s1).includes(VID), "probe vid never leaks into any admin payload", "");
  ok(s1.railConversions === 1, "exactly one rail conversion stamped (vid → convertedAt)", "");
  ok(s1.totals?.orders === 8, "book grew by exactly the 2 probe orders (6 → 8)", "");
  ok((s1.railBoard || []).every(r => typeof r.revenue === "number" && typeof r.pulls === "number" && typeof r.sold === "number"),
    "R56/R57 board regressions intact", "");
  ok(!("mixRevTrend" in s1) && !!s1.mixTrend?.revenue, "R55 mixTrend.revenue nesting intact", "");

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE ERROR", e); process.exit(1); });
