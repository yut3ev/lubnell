// R47 probe — (A) rail click-through attribution (/api/store/products/rail-click
// → stats.railPulls); (B) wish-row → orders hand-off plumbing stays intact
// (the product= filter regression from R45). DELTA-based: live visitors may
// click rails through the gateway mid-probe, so counts assert relative moves.
// Leaves seeded RailEvents for the browser E2E — cleanup: scripts/r47-cleanup.js
// (deletes RailEvents created after the probe start timestamp; real clicks in
// that tiny window are aggregate-only and acceptable losses).
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
const railClick = async (from, target, ip) => {
  const r = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: JSON.stringify({ from, target }),
  });
  let json = null; try { json = await r.json(); } catch { /* no body */ }
  return { status: r.status, json };
};

(async () => {
  console.log("── R47 probe: rail attribution + hand-off regression ──");
  ok(await adminAuth(), "admin auth");
  const probeStart = new Date(Date.now() - 1000);

  const s0 = await stats();
  const pulls0 = new Map((s0.railPulls || []).map(p => [p.slug, p.count]));
  console.log(`  [snapshot] book: ${s0.totals.orders} orders / ${s0.totals.revenue} gross · railPulls groups: ${pulls0.size}`);

  // ── 1: validation
  let r = await railClick("", "university-box", "10.47.0.1");
  ok(r.status === 400, "missing from → 400", String(r.status));
  r = await railClick("strawberry-lip-set", "", "10.47.0.1");
  ok(r.status === 400, "missing target → 400", String(r.status));
  r = await railClick("strawberry-lip-set", "strawberry-lip-set", "10.47.0.1");
  ok(r.status === 400, "from == target rejected → 400", String(r.status));
  r = await railClick("no-such-product", "university-box", "10.47.0.1");
  ok(r.status === 404, "unknown from → 404", String(r.status));
  r = await railClick("strawberry-lip-set", "no-such-product", "10.47.0.1");
  ok(r.status === 404, "unknown target → 404", String(r.status));

  // ── 2: seed two real clicks on university-box cards (distinct IPs), one repeat throttled
  r = await railClick("strawberry-lip-set", "university-box", "10.47.0.1");
  ok(r.status === 200 && r.json?.success && !r.json?.throttled, "click #1 recorded", JSON.stringify(r.json));
  r = await railClick("strawberry-lip-set", "university-box", "10.47.0.1");
  ok(r.status === 200 && r.json?.throttled, "repeat within 8s throttled", JSON.stringify(r.json));
  r = await railClick("care-makeup-box", "university-box", "10.47.0.2");
  ok(r.status === 200 && r.json?.success && !r.json?.throttled, "click #2 recorded (other rail, other IP)");

  // ── 3: stats delta — university-box pulls +2 over the live baseline
  const s1 = await stats();
  const pulls1 = new Map((s1.railPulls || []).map(p => [p.slug, p.count]));
  const before = pulls0.get("university-box") || 0;
  const after = pulls1.get("university-box") || 0;
  ok(after === before + 2, "stats railPulls: university-box +2 over baseline", `${before}→${after}`);
  ok((s1.railPulls || []).every(p => p.count > 0), "railPulls rows all positive");

  // ── 4: R46 regression — also-saved still answers with an items array
  const als = await (await fetch(`${BASE}/api/store/products/also-saved?slug=university-box`)).json();
  ok(als?.success && Array.isArray(als.items), "also-saved route intact (R46 regression)", `basis=${als.basis} items=${als.items.length}`);

  // ── 5: hand-off plumbing regression — product= filter (R45) still exact
  const f = await (await fetch(`${BASE}/api/admin/orders?page=1&limit=100&product=university-box`, { headers: { cookie } })).json();
  ok(f.orders?.every(o => (typeof o.items === "string" ? o.items : JSON.stringify(o.items)).includes('"id":"university-box"')), "product= filter still exact-anchored", `${f.orders?.length} orders`);

  // ── 6: regressions — 401 + CSV BOM + book untouched
  const unauth = await fetch(`${BASE}/api/admin/orders`);
  ok(unauth.status === 401, "admin orders unauth → 401", String(unauth.status));
  const csv = await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } });
  const buf = new Uint8Array(await csv.arrayBuffer());
  ok(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, "CSV export BOM intact (ef bb bf)");
  const s2 = await stats();
  ok(s2.totals.orders === s0.totals.orders && s2.totals.revenue === s0.totals.revenue, "book untouched: orders+gross identical", `${s0.totals.orders}→${s2.totals.orders}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})();
