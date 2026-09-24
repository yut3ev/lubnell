// R48 probe — rail-pull → conversion loop: rail clicks carrying an anonymous
// vid get stamped convertedAt when an order lands from the same vid (≤24h).
// Flow: snapshot → validation (bad vid dropped) → seed 2 converted-candidate
// clicks with the probe vid → order POST with the same vid → conversions +1
// → order with a bogus vid → conversions unchanged → regressions. Probe
// orders use the QA phone (…049) — cleanup: scripts/r48-cleanup.js (removes
// them plus the probe vid's rail rows; real orders NEVER touched).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r48probevid1234567890";
const PHONE = "011100000049";
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
const railClick = async (from, target, vid) => {
  const r = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, target, vid }),
  });
  let json = null; try { json = await r.json(); } catch { /* no body */ }
  return { status: r.status, json };
};

(async () => {
  console.log("── R48 probe: rail conversion loop ──");
  ok(await adminAuth(), "admin auth");

  const s0 = await stats();
  const conv0 = s0.railConversions ?? 0;
  console.log(`  [snapshot] book: ${s0.totals.orders} orders / ${s0.totals.revenue} gross / railConversions ${conv0}`);

  // ── 1: bogus vids are dropped server-side (row created with vid "")
  let r = await railClick("strawberry-lip-set", "university-box", "<script>alert(1)</script>");
  ok(r.status === 200 && r.json?.success, "click with hostile vid accepted but sanitized", JSON.stringify(r.json));

  // ── 2: seed two candidate clicks with the clean probe vid
  r = await railClick("strawberry-lip-set", "university-box", VID);
  ok(r.status === 200 && r.json?.success, "candidate click #1 (lip-set rail → box)");
  r = await railClick("care-makeup-box", "university-box", VID);
  ok(r.status === 200 && r.json?.success, "candidate click #2 (care rail → box)");

  // ── 3: order from the SAME vid converts the candidate pulls
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R48 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "university-box", name: "University Beauty Box", quantity: 1, price: 500 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with vid", order.orderNumber || "?");
  const s1 = await stats();
  ok((s1.railConversions ?? 0) === conv0 + 1, "railConversions +1 after same-vid order", `${conv0}→${s1.railConversions}`);
  ok(s1.totals.orders === s0.totals.orders + 1 && s1.totals.revenue === s0.totals.revenue + order.total, "book moved by exactly the probe order", `+${order.total} EGP`);

  // ── 4: an order with a bogus vid converts nothing more
  const order2 = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R48 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: "no",
    }),
  });
  ok(order2.ok, "second probe order (bogus vid) accepted", "");
  const s2 = await stats();
  ok((s2.railConversions ?? 0) === conv0 + 1, "bogus vid converts nothing", `${s2.railConversions}`);

  // ── 5: regressions — 401 + CSV BOM
  const unauth = await fetch(`${BASE}/api/admin/orders`);
  ok(unauth.status === 401, "admin orders unauth → 401", String(unauth.status));
  const csv = await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } });
  const buf = new Uint8Array(await csv.arrayBuffer());
  ok(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, "CSV export BOM intact (ef bb bf)");

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})();
