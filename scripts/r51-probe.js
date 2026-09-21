// R51 probe — orders CSV rail column + order-mix panel.
// Flow: unauth guards → CSV BOM regressions → b0 snapshot (book + orderMix +
// orders CSV with the NEW rail column) → seed a rail click + same-vid order
// (classified rail) and a no-vid order (organic) → orderMix moves by exactly
// +1 rail / +1 organic / coupon unchanged / both 0 → the CSV's probe order
// rows carry rail=yes / rail=no while every legacy row stays rail=no → book
// moved by exactly the two probe orders. Probe orders use the QA phone
// (…052) — cleanup: scripts/r51-cleanup.js (probe phone + probe vid only).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r51probevid1234567890";
const PHONE = "011100000052";
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
const ordersCsv = async () => {
  const res = await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } });
  const text = Buffer.from(await res.arrayBuffer()).toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split("\r\n").filter(Boolean);
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
  const header = parseLine(lines[0]);
  const byNumber = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    byNumber.set(cells[0], Object.fromEntries(header.map((h, i) => [h, cells[i]])));
  }
  return { res, header, byNumber };
};
const bom = async (path) => {
  const bytes = new Uint8Array(await (await fetch(`${BASE}${path}`, { headers: { cookie } })).arrayBuffer());
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
};

(async () => {
  console.log("── R51 probe: orders CSV rail column + order mix ──");

  // ── 0: unauth guards + hygiene regressions
  const s401 = await fetch(`${BASE}/api/admin/stats`);
  ok(s401.status === 401, "stats unauth → 401", String(s401.status));
  const e401 = await fetch(`${BASE}/api/admin/orders/export`);
  ok(e401.status === 401, "orders export unauth → 401", String(e401.status));
  ok(await adminAuth(), "admin auth");
  ok(await bom("/api/admin/orders/export"), "orders CSV BOM regression (ef bb bf)");
  ok(await bom("/api/admin/wishlist/export"), "wishlist CSV BOM regression (ef bb bf)");

  // ── 1: b0 snapshot — orderMix baseline + CSV rail column present
  const s0 = await stats();
  const m0 = s0.orderMix || { net: 0, coupon: 0, rail: 0, both: 0, organic: 0 };
  console.log(`  [b0] book: ${s0.totals.orders} orders / ${s0.totals.revenue} gross / mix net ${m0.net} = coupon ${m0.coupon} + rail ${m0.rail} (both ${m0.both}) + organic ${m0.organic}`);
  ok(m0.net === s0.totals.netOrders, "orderMix.net == totals.netOrders (same non-cancelled universe)", `${m0.net}==${s0.totals.netOrders}`);
  const c0 = await ordersCsv();
  ok(c0.header[c0.header.length - 1] === "rail", "NEW: orders CSV header ends with the rail column", c0.header.join(","));
  ok([...c0.byNumber.values()].every(r => r.rail === "no" || r.rail === "yes"), "every CSV row carries a yes/no rail value", "");
  ok([...c0.byNumber.values()].every(r => r.rail === "no"), "b0: all legacy rows rail=no (no converted rails yet)", "");

  // ── 2: seed — rail click + same-vid order (rail) + no-vid order (organic)
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target: "university-box", vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", "→ university-box");
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R51 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with vid (rail-classified)", order.orderNumber || "?");
  const order2Res = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R51 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
    }),
  });
  const order2 = await order2Res.json();
  ok(order2Res.ok && order2.orderNumber, "second probe order created without vid (organic)", order2.orderNumber || "?");

  // ── 3: orderMix moved by exactly +1 rail / +1 organic; coupon & both frozen
  const s1 = await stats();
  const m1 = s1.orderMix;
  ok(m1.rail === m0.rail + 1, "orderMix.rail +1 (vid order classified)", `${m0.rail}→${m1.rail}`);
  ok(m1.organic === m0.organic + 1, "orderMix.organic +1 (no-vid order classified)", `${m0.organic}→${m1.organic}`);
  ok(m1.coupon === m0.coupon, "orderMix.coupon unchanged (no coupon orders seeded)", `${m0.coupon}==${m1.coupon}`);
  ok(m1.both === m0.both, "orderMix.both unchanged", `${m0.both}==${m1.both}`);
  ok(m1.net === m0.net + 2 && m1.coupon + Math.max(0, m1.rail - m1.both) + m1.organic === m1.net,
    "mix segments sum to net (internal consistency)", `${m1.coupon}+${Math.max(0, m1.rail - m1.both)}+${m1.organic}==${m1.net}`);

  // ── 4: the CSV rows agree with the screen
  const c1 = await ordersCsv();
  ok(c1.byNumber.get(order.orderNumber)?.rail === "yes", "NEW: vid probe order CSV row rail=yes", c1.byNumber.get(order.orderNumber)?.rail);
  ok(c1.byNumber.get(order2.orderNumber)?.rail === "no", "NEW: no-vid probe order CSV row rail=no", c1.byNumber.get(order2.orderNumber)?.rail);
  ok([...c1.byNumber.entries()].filter(([n]) => n !== order.orderNumber && n !== order2.orderNumber).every(([, r]) => r.rail === "no"),
    "all legacy rows still rail=no after the probe orders", "");

  // ── 5: book moved by exactly the two probe orders + regressions
  const orderTotal = (order.total || 0) + (order2.total || 0);
  ok(s1.totals.orders === s0.totals.orders + 2 && s1.totals.revenue === s0.totals.revenue + orderTotal,
    "book moved by exactly the probe orders", `+${orderTotal} EGP`);
  const soldSum = [...new Map((s1.railSold || []).map(r => [r.slug, r.count])).values()].reduce((a, b) => a + b, 0);
  ok(soldSum === (s1.railConversions ?? -1), "R49 invariant: sum(railSold) == railConversions", `${soldSum}==${s1.railConversions}`);
  ok((s1.railBoard?.[0]?.pulls || 0) >= 1, "R50 railBoard regression (top row has pulls)", JSON.stringify(s1.railBoard?.[0] || {}));
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
