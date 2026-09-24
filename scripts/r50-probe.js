// R50 probe — rail leaderboard board + per-order rail attribution badge.
// Flow: unauth guards → CSV BOM regressions → snapshot b0 (book + railBoard +
// railConversions + orders listing) → seed a rail click on the top-saves slug
// with the probe vid → same-vid order converts it → NEW: orders listing row
// for that order carries railConverted=true and railBoard[target] shows
// pulls+1/sold+1 → a no-vid order must NOT be flagged → book moved by exactly
// the two probe orders. Probe orders use the QA phone (…051) — cleanup:
// scripts/r50-cleanup.js (removes them plus the probe vid's rail rows;
// organic data NEVER touched).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r50probevid1234567890";
const PHONE = "011100000051";
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
const ordersPage = async (phone) =>
  (await fetch(`${BASE}/api/admin/orders?page=1&limit=12${phone ? `&q=${encodeURIComponent(phone)}` : ""}`, { headers: { cookie } })).json();
const bom = async (path) => {
  const bytes = new Uint8Array(await (await fetch(`${BASE}${path}`, { headers: { cookie } })).arrayBuffer());
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
};

(async () => {
  console.log("── R50 probe: rail leaderboard + per-order attribution ──");

  // ── 0: unauth guards + CSV hygiene regressions (before auth)
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  const o401 = await fetch(`${BASE}/api/admin/orders`);
  ok(o401.status === 401, "admin orders unauth → 401", String(o401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");

  // ── 1: b0 snapshot (delta convention — live traffic may move the book)
  const s0 = await stats();
  const conv0 = s0.railConversions ?? 0;
  const board0 = new Map((s0.railBoard || []).map(r => [r.slug, r]));
  const sold0 = new Map((s0.railSold || []).map(r => [r.slug, r.count]));
  const pulls0 = new Map((s0.railPulls || []).map(r => [r.slug, r.count]));
  const op0 = await ordersPage(PHONE);
  ok(op0.total === 0, "b0: no probe-phone orders yet (clean delta baseline)", `total ${op0.total}`);
  console.log(`  [b0] book: ${s0.totals.orders} orders / ${s0.totals.revenue} gross / conversions ${conv0} / board targets ${board0.size}`);

  // ── 2: pick the CSV's top-saves slug as the click target (stable across rounds)
  const wl = await fetch(`${BASE}/api/admin/wishlist/export`, { headers: { cookie } });
  const wlText = Buffer.from(await wl.arrayBuffer()).toString("utf8").replace(/^\uFEFF/, "");
  const parseLine = (line) => {
    const out = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
      else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur); return out;
  };
  const wlLines = wlText.split("\r\n").filter(Boolean);
  const wlRows = wlLines.slice(1).map(l => parseLine(l));
  const target = wlRows.sort((a, b) => Number(b[3]) - Number(a[3]))[0]?.[0];
  ok(!!target, "top-saves target resolved from wishlist CSV", target || "?");

  // ── 3: seed the rail click with the probe vid, then convert it via order
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target, vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", `→ ${target}`);
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R50 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with same vid", order.orderNumber || "?");

  // ── 4: NEW — the orders listing row itself carries the attribution
  const op1 = await ordersPage(PHONE);
  const row1 = (op1.orders || []).find(o => o.orderNumber === order.orderNumber);
  ok(!!row1 && row1.railConverted === true, "NEW: probe order row shows railConverted=true (vid bridge)", String(row1?.railConverted));

  // ── 5: NEW — railBoard reflects pulls+1 / sold+1 on the right row
  const s1 = await stats();
  const board1 = new Map((s1.railBoard || []).map(r => [r.slug, r]));
  const b1 = board1.get(target);
  const b0row = board0.get(target);
  ok(!!b1 && b1.pulls === ((b0row?.pulls ?? pulls0.get(target) ?? 0) + 1), "NEW: railBoard[target].pulls +1", `${b0row?.pulls ?? pulls0.get(target) ?? 0}→${b1?.pulls}`);
  ok(!!b1 && b1.sold === ((b0row?.sold ?? 0) + 1), "NEW: railBoard[target].sold +1 (gold bar lands on the right row)", `${b0row?.sold ?? 0}→${b1?.sold}`);
  ok(!!b1 && !!b1.name && b1.name !== target, "NEW: railBoard row resolved to catalog meta (name, not slug)", b1?.name || "?");
  ok((s1.railConversions ?? 0) === conv0 + 1, "railConversions +1 (R48 regression)", `${conv0}→${s1.railConversions}`);
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);

  // ── 6: a no-vid order must NOT be flagged (honest absence)
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R50 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "second probe order created WITHOUT vid", order2.orderNumber || "?");
  const op2 = await ordersPage(PHONE);
  const row2a = (op2.orders || []).find(o => o.orderNumber === order2.orderNumber);
  const row2b = (op2.orders || []).find(o => o.orderNumber === order.orderNumber);
  ok(!!row2a && row2a.railConverted === false, "NEW: no-vid order row stays railConverted=false", String(row2a?.railConverted));
  ok(!!row2b && row2b.railConverted === true, "vid order still flagged after second order", "");

  // ── 7: book moved by exactly the two probe orders + regression
  const s2 = await stats();
  const orderTotal = (order.total || 0) + (order2.total || 0);
  ok(s2.totals.orders === s0.totals.orders + 2 && s2.totals.revenue === s0.totals.revenue + orderTotal,
    "book moved by exactly the probe orders", `+${orderTotal} EGP`);
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
