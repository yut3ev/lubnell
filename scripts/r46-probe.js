// R46 probe — PDP cross-sell "visitors also saved" (/api/store/products/also-saved).
// DELTA-based (real customer orders live in the book and are NEVER touched).
// Flow: snapshot → empty-state check → seed wishEvents via the REAL wishlist
// route (3 distinct IPs) → co-occurrence tier → cold-start "top" tier →
// remove-does-not-retract → regressions (401 / CSV BOM). Leaves seeded data
// for the browser E2E — cleanup: scripts/r46-cleanup.js (deleteMany WishEvent
// by probe IPs only; no orders or coupons touched this round).
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
const bootstrap = async () => (await fetch(`${BASE}/api/store/bootstrap`)).json();
const alsoSaved = async (slug) => {
  const r = await fetch(`${BASE}/api/store/products/also-saved?slug=${encodeURIComponent(slug)}`);
  let json = null; try { json = await r.json(); } catch { /* no body */ }
  return { status: r.status, json };
};
const wish = async (slug, action, ip) => {
  const r = await fetch(`${BASE}/api/store/wishlist`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ slug, action }),
  });
  let json = null; try { json = await r.json(); } catch { /* no body */ }
  return { status: r.status, json };
};

(async () => {
  console.log("── R46 probe: also-saved cross-sell ──");
  ok(await adminAuth(), "admin auth");

  const s0 = await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
  console.log(`  [snapshot] book: ${s0.totals.orders} orders / ${s0.totals.revenue} gross / ${s0.totals.netRevenue} netEGP — probes create no orders this round`);

  // ── 1: unknown slug → 404 / 400 (shape checks independent of live data)
  let r = await alsoSaved("no-such-product");
  ok(r.status === 404, "unknown slug → 404", String(r.status));
  r = await alsoSaved("");
  ok(r.status === 400, "missing slug → 400", String(r.status));

  // Live-traffic delta baseline: real visitors use the wishlist through the
  // gateway (first organic wishEvents landed mid-R45). All count assertions
  // below are relative to this snapshot, never absolute.

  // ── 3: seed co-occurrence via the REAL wishlist route (throttle + ip persist)
  //   IP A: university-box + strawberry-lip-set
  //   IP B: university-box + care-makeup-box
  //   IP C: avocado-cucumber-box (no overlap with university-box)
  const b0 = (await bootstrap()).wishCounts || {}; // live-traffic delta baseline BEFORE seeding
  const seed = [
    ["university-box", "add", "10.46.0.1"], ["strawberry-lip-set", "add", "10.46.0.1"],
    ["university-box", "add", "10.46.0.2"], ["care-makeup-box", "add", "10.46.0.2"],
    ["avocado-cucumber-box", "add", "10.46.0.3"],
  ];
  const seeded = await Promise.all(seed.map(([s, a, ip]) => wish(s, a, ip)));
  ok(seeded.every(x => x.status === 200 && x.json?.success && !x.json?.throttled), "5 wishEvents seeded via real route (no throttle)", `${seeded.filter(x => x.json?.throttled).length} throttled`);

  // ── 4: bootstrap wishCounts agrees (adds only) — DELTA vs live traffic;
  // the immediate re-seed must be throttled (per slug+action+IP, 8s) so the
  // counts move exactly +2/+1/+1/+1, proving both persistence and throttle.
  const seeded2 = await Promise.all(seed.map(([s, a, ip]) => wish(s, a, ip)));
  ok(seeded2.every(x => x.status === 200 && x.json?.throttled), "re-seed throttled (per slug+action+IP window)", `${seeded2.filter(x => x.json?.throttled).length}/5`);
  const b = await bootstrap();
  ok(b.wishCounts["university-box"] === (b0["university-box"] || 0) + 2, "bootstrap wishCounts: university-box +2 over live baseline", `${b0["university-box"] || 0}→${b.wishCounts["university-box"]}`);
  ok(b.wishCounts["strawberry-lip-set"] === (b0["strawberry-lip-set"] || 0) + 1 && b.wishCounts["care-makeup-box"] === (b0["care-makeup-box"] || 0) + 1 && b.wishCounts["avocado-cucumber-box"] === (b0["avocado-cucumber-box"] || 0) + 1, "bootstrap wishCounts: singles +1 over live baseline");

  // ── 5: tier "co" — real co-occurrence for university-box
  r = await alsoSaved("university-box");
  ok(r.status === 200 && r.json?.success && Array.isArray(r.json.items), "route answers 200 with items array");
  ok(r.json.basis === "co", "university-box basis == co (real overlap exists)", r.json.basis);
  const coIds = r.json.items.map(x => x.id);
  ok(coIds.includes("strawberry-lip-set") && coIds.includes("care-makeup-box"), "co items include both overlapping products", coIds.join(","));
  ok(!coIds.includes("avocado-cucumber-box"), "non-overlapping product excluded from co tier");
  const lip = r.json.items.find(x => x.id === "strawberry-lip-set");
  ok(lip && lip.count >= 1 && lip.nameAr && lip.image && typeof lip.price === "number", "co item carries count + resolved storefront meta", lip ? `${lip.nameAr} / ${lip.price} ×${lip.count}` : "missing");
  ok(r.json.items.length <= 3, "rail capped at 3", String(r.json.items.length));

  // ── 6: tier "top" — cold start for a product nobody bridged from
  r = await alsoSaved("strawberry-body-mist");
  ok(r.json.basis === "top", "unbridged product falls back to basis top", r.json.basis);
  const topIds = r.json.items.map(x => x.id);
  const uniTop = r.json.items.find(x => x.id === "university-box");
  const maxTop = Math.max(...r.json.items.map(x => x.count));
  ok(!!uniTop && uniTop.count === b.wishCounts["university-box"] && uniTop.count === maxTop, "top tier: most-saved university-box leads with its bootstrap count", uniTop ? String(uniTop.count) : "absent");
  ok(!topIds.includes("strawberry-body-mist"), "top tier excludes the current product itself");
  ok(r.json.items.length <= 3, "top tier capped at 3", String(r.json.items.length));

  // ── 7: remove does NOT retract (adds are the demand fact)
  const pre = await alsoSaved("strawberry-lip-set");
  const uniBefore = pre.json.items.find(x => x.id === "university-box")?.count;
  const rem = await wish("university-box", "remove", "10.46.0.9");
  ok(rem.status === 200 && rem.json?.success, "remove accepted for a fresh IP");
  const b2 = await bootstrap();
  ok(b2.wishCounts["university-box"] === b.wishCounts["university-box"], "wishCounts unchanged after a remove (adds only)", String(b2.wishCounts["university-box"]));
  r = await alsoSaved("strawberry-lip-set");
  ok(r.json.items.find(x => x.id === "university-box")?.count === uniBefore, "co-occurrence counts unchanged after remove");

  // ── 8: regressions — admin auth wall + CSV BOM (book untouched)
  const unauth = await fetch(`${BASE}/api/admin/orders`);
  ok(unauth.status === 401, "admin orders unauth → 401", String(unauth.status));
  const csv = await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } });
  const buf = new Uint8Array(await csv.arrayBuffer());
  ok(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, "CSV export BOM intact (ef bb bf)");
  const s1 = await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
  ok(s1.totals.orders === s0.totals.orders && s1.totals.revenue === s0.totals.revenue, "book untouched: orders+gross identical", `${s0.totals.orders}→${s1.totals.orders}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})();
