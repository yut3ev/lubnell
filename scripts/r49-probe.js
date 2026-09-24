// R49 probe — per-target rail conversion breakdown + wishlist CSV export.
// Flow: snapshot → CSV export checks (401 / BOM / header / saves-sum ==
// stats wishAdds) → NEW invariant sum(railSold) == railConversions → seed a
// rail click on the board's top-saves slug with the probe vid → same-vid
// order converts it (railSold[target] +1, CSV row rail_converted +1) →
// bogus-vid order converts nothing → book moved by exactly the probe orders.
// Probe orders use the QA phone (…050) — cleanup: scripts/r49-cleanup.js
// (removes them plus the probe vid's rail rows; organic data NEVER touched).
const BASE = "http://127.0.0.1:3000"; // 127.0.0.1 — node fetch resolves localhost to ::1
const VID = "r49probevid1234567890";
const PHONE = "011100000050";
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
const parseCsvLine = (line) => {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};
const csvMap = async () => {
  const res = await fetch(`${BASE}/api/admin/wishlist/export`, { headers: { cookie } });
  const text = Buffer.from(await res.arrayBuffer()).toString("utf8");
  const lines = text.replace(/^\uFEFF/, "").split("\r\n").filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const rows = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    rows.set(cells[0], {
      saves: Number(cells[3]), sold: Number(cells[4]),
      pulls: Number(cells[5]), converted: Number(cells[6]),
    });
  }
  return { res, header, rows, text };
};

(async () => {
  console.log("── R49 probe: per-target conversions + wishlist CSV ──");
  ok(await adminAuth(), "admin auth");

  const s0 = await stats();
  const conv0 = s0.railConversions ?? 0;
  const sold0 = new Map((s0.railSold || []).map(r => [r.slug, r.count]));
  console.log(`  [snapshot] book: ${s0.totals.orders} orders / ${s0.totals.revenue} gross / railConversions ${conv0} / railSold targets ${sold0.size}`);

  // ── 1: export auth + hygiene
  const unauth = await fetch(`${BASE}/api/admin/wishlist/export`);
  ok(unauth.status === 401, "wishlist export unauth → 401", String(unauth.status));
  const c0 = await csvMap();
  const bom = c0.text.charCodeAt(0) === 0xfeff || (c0.res.ok && Buffer.from(await (await fetch(`${BASE}/api/admin/wishlist/export`, { headers: { cookie } })).arrayBuffer()).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
  const raw = await fetch(`${BASE}/api/admin/wishlist/export`, { headers: { cookie } });
  const bytes = new Uint8Array(await raw.arrayBuffer());
  ok(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, "wishlist CSV BOM intact (ef bb bf)");
  const needCols = ["product_slug", "name_ar", "name_en", "saves", "sold_units", "rail_pulls", "rail_converted"];
  ok(needCols.every(col => c0.header.includes(col)), "CSV header carries all 7 columns", c0.header.join(","));
  const savesSum = [...c0.rows.values()].reduce((s, r) => s + r.saves, 0);
  ok(savesSum === (s0.wishAdds ?? -1), "CSV saves sum == stats wishAdds (same adds-only convention)", `${savesSum}==${s0.wishAdds}`);
  const soldSum = [...sold0.values()].reduce((s, v) => s + v, 0);
  ok(soldSum === conv0, "NEW invariant: sum(railSold) == railConversions", `${soldSum}==${conv0}`);

  // ── 2: pick the board's top-saves slug (guaranteed a CSV row) as target
  const target = [...c0.rows.entries()].sort((a, b) => b[1].saves - a[1].saves)[0]?.[0];
  const t0 = c0.rows.get(target) || { saves: 0, pulls: 0, converted: 0 };
  ok(!!target, "top-saves target resolved from CSV", `${target} (pulls ${t0.pulls} / converted ${t0.converted})`);

  // ── 3: seed a rail click on the target with the probe vid, then convert it
  const click = await fetch(`${BASE}/api/store/products/rail-click`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "strawberry-lip-set", target, vid: VID }),
  });
  ok(click.status === 200, "probe rail click recorded", `→ ${target}`);
  const orderRes = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R49 Probe", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: VID,
    }),
  });
  const order = await orderRes.json();
  ok(orderRes.ok && order.orderNumber, "probe order created with same vid", order.orderNumber || "?");

  const s1 = await stats();
  const sold1 = new Map((s1.railSold || []).map(r => [r.slug, r.count]));
  ok((s1.railConversions ?? 0) === conv0 + 1, "railConversions +1 after same-vid order", `${conv0}→${s1.railConversions}`);
  ok((sold1.get(target) || 0) === (sold0.get(target) || 0) + 1, "railSold[target] +1 — breakdown lands on the right row", `${sold0.get(target) || 0}→${sold1.get(target) || 0}`);
  const othersIntact = [...sold1.entries()].every(([slug, n]) => slug === target || n === (sold0.get(slug) || 0));
  ok(othersIntact, "all other railSold targets unchanged", "");

  // ── 4: the CSV join reflects the conversion live
  const c1 = await csvMap();
  const t1 = c1.rows.get(target);
  ok(!!t1 && t1.pulls === t0.pulls + 1 && t1.converted === t0.converted + 1,
    "CSV row rail_pulls +1 / rail_converted +1", `${target}: pulls ${t0.pulls}→${t1?.pulls}, conv ${t0.converted}→${t1?.converted}`);

  // ── 5: a bogus-vid order converts nothing more
  const order2 = await fetch(`${BASE}/api/store/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "R49 Probe 2", customerPhone: PHONE, customerAddress: "QA street",
      items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", quantity: 1, price: 200 }],
      vid: "no",
    }),
  });
  const order2Json = await order2.json().catch(() => ({}));
  ok(order2.ok, "second probe order (bogus vid) accepted", "");
  const s2 = await stats();
  const sold2 = new Map((s2.railSold || []).map(r => [r.slug, r.count]));
  ok((s2.railConversions ?? 0) === conv0 + 1 && (sold2.get(target) || 0) === (sold1.get(target) || 0),
    "bogus vid converts nothing (aggregate + breakdown agree)", "");

  // ── 6: book moved by exactly the two probe orders + regressions
  const orderTotal = (order.total || 0) + (order2Json.total || 0);
  ok(s2.totals.orders === s0.totals.orders + 2 && s2.totals.revenue === s0.totals.revenue + orderTotal,
    "book moved by exactly the probe orders", `+${orderTotal} EGP`);
  const admin401 = await fetch(`${BASE}/api/admin/orders`);
  ok(admin401.status === 401, "admin orders unauth → 401", String(admin401.status));
  const ocsv = new Uint8Array(await (await fetch(`${BASE}/api/admin/orders/export`, { headers: { cookie } })).arrayBuffer());
  ok(ocsv[0] === 0xef && ocsv[1] === 0xbb && ocsv[2] === 0xbf, "orders CSV BOM regression intact");
  const also = await fetch(`${BASE}/api/store/products/also-saved?slug=strawberry-lip-set`);
  const alsoJson = await also.json().catch(() => null);
  ok(also.status === 200 && Array.isArray(alsoJson?.items), "R46 also-saved regression (200 + items)", `basis ${alsoJson?.basis || "?"}`);

  console.log(`\n── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("PROBE CRASH", e); process.exit(1); });
