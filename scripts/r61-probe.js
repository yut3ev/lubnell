// R61 probe — wishlist cross-sell (surfaces trilogy closer). ZERO API change
// this round: the wishlist strip consumes the R60 store-wide contract as-is.
// This probe therefore pins the STANDING contract so any drift gets caught:
// unauth guards → CSV BOM → b0 anchors + store-wide determinism (the
// residual local add) + exclude + unknown-slug 404 + anchored co-path +
// click matrix + privacy. Story seeding stays in r60-probe (31/31 there);
// the quiet book is deterministic enough for every assertion here.
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
const alsoSavedRaw = async (qs) => fetch(`${BASE}/api/store/products/also-saved${qs}`);
const alsoSaved = async (qs) => (await alsoSavedRaw(qs)).json();
const clickRail = (from, target, vid) => fetch(`${BASE}/api/store/products/rail-click`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ from, target, vid }),
});

(async () => {
  console.log("── R61 probe: wishlist strip (trilogy contract regression) ──");

  const o401 = await fetch(`${BASE}/api/admin/orders?page=1&days=7`);
  ok(o401.status === 401, "orders days query unauth → 401", String(o401.status));
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  const s0 = await stats();
  ok(s0.totals?.orders === 6 && s0.totals?.revenue === 2127 && s0.totals?.netRevenue === 1981,
    "b0: book anchors 6 orders / 2127 gross / 1981 net", "");
  ok(s0.railConversions === 0 && Array.isArray(s0.railPulls) && s0.railPulls.length === 0, "b0: quiet rail ledger", "");

  const top0 = await alsoSaved("");
  ok(top0.success === true && top0.basis === "top" && top0.items?.length === 1 && top0.items[0].id === "university-box" && top0.items[0].count === 1 && top0.items[0].railOrders === 0,
    "store-wide: exactly the residual card (empty-wishlist strip truth)", "");
  const ex0 = await alsoSaved("?exclude=university-box");
  ok(ex0.items?.length === 0, "exclude the only candidate → honest empty (non-empty-strip truth)", "");
  ok((await alsoSavedRaw("?slug=not-a-real-slug")).status === 404, "unknown slug still 404", "");
  ok((await alsoSavedRaw("?slug=")).status === 200, "EMPTY slug = MISSING slug → 200 store-wide", "");

  const co0 = await alsoSaved("?slug=avocado-cucumber-box");
  ok(co0.success === true && co0.basis === "top" && co0.items?.length === 1 && co0.items[0].id === "university-box",
    "anchored path on the quiet book: cold-start top tier, anchor self-excluded", "");

  ok((await clickRail("strawberry-lip-set", "", "r61matrix")).status === 400, "click matrix: missing target → 400", "");
  ok((await clickRail("strawberry-lip-set", "strawberry-lip-set", "r61matrix")).status === 400, "click matrix: from===target → 400", "");
  ok((await clickRail("strawberry-lip-set", "not-a-real-slug", "r61matrix")).status === 404, "click matrix: unknown target → 404", "");

  ok(!JSON.stringify(s0).includes("r61matrix"), "matrix vid never lands anywhere (all 400/404)", "");

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE ERROR", e); process.exit(1); });
