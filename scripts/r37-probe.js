// R37 probe — verify repeat-purchase KPI + daily gift-rate sparkline math.
// Two probe orders on NEW phone 011100000038 (one with giftNote) made today:
//  → that phone becomes a repeat customer (2 orders in 30d)
//  → today's sparkline point gains 1 gift / 2 orders
// Cleanup = scripts/r36-cleanup.js pattern (see r37-cleanup: same phone list).
const BASE = "http://localhost:3000";

async function post(url, body, headers = {}) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: r.status, setCookie: r.headers.get("set-cookie"), json: await r.json().catch(() => null) };
}

(async () => {
  const login = await post(`${BASE}/api/admin/auth`, { username: "owner", password: "lubnel1234", verificationCode: "7777" });
  const cookie = (login.setCookie || "").split(";")[0];
  if (!cookie) { console.log("LOGIN FAILED", login.status); process.exit(1); }
  const get = () => fetch(`${BASE}/api/admin/stats`, { headers: { cookie } }).then(r => r.json());

  const s0 = await get();
  const b = s0.repeat30, bt = s0.giftRateTrend;
  console.log("BASELINE repeat30:", JSON.stringify(b), "| trend:", JSON.stringify(bt.map(p => `${p.date.slice(5)}:${p.gift}/${p.orders}:${p.rate}`)));
  const giftWeek0 = s0.totals.giftOrdersWeek, ordersWeek0 = s0.totals.ordersWeek;

  // probe C — gift order, new phone
  const c = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R37 ج", customerPhone: "011100000038", customerAddress: "القاهرة",
    items: [{ id: "university-box", name: "University Box", price: 200, quantity: 1 }],
    giftNote: "مبروك يا دكتورة، عقبال الفرحة الكبيرة",
    paymentMethod: "cod",
  });
  if (c.status !== 200) { console.log("PROBE C FAILED", c.status, JSON.stringify(c.json)); process.exit(1); }
  // probe D — second order, same phone → repeat customer
  const d = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R37 ج", customerPhone: "011100000038", customerAddress: "القاهرة",
    items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", price: 200, quantity: 1 }],
    paymentMethod: "cod",
  });
  if (d.status !== 200) { console.log("PROBE D FAILED", d.status, JSON.stringify(d.json)); process.exit(1); }
  console.log("probes:", c.json.orderNumber, d.json.orderNumber);

  const s1 = await get();
  const a = s1.repeat30, at = s1.giftRateTrend;
  console.log("AFTER repeat30:", JSON.stringify(a), "| trend:", JSON.stringify(at.map(p => `${p.date.slice(5)}:${p.gift}/${p.orders}:${p.rate}`)));

  const today = at[at.length - 1];
  const today0 = bt[bt.length - 1];
  const expGiftRate = Math.round(((giftWeek0 + 1) / (ordersWeek0 + 2)) * 100);
  const assert = (name, ok) => console.log(ok ? `PASS ${name}` : `FAIL ${name}`);
  assert("repeat total +1 (new phone)", a.total === b.total + 1);
  assert("repeat count +1 (2 orders same phone)", a.repeat === b.repeat + 1);
  assert("repeat rate = round(" + a.repeat + "/" + a.total + ")", a.rate === Math.round((a.repeat / a.total) * 100));
  assert("today trend gift +1", today.gift === today0.gift + 1);
  assert("today trend orders +2", today.orders === today0.orders + 2);
  assert("today trend rate exact", today.rate === Math.round((today.gift / today.orders) * 100));
  assert("weekly giftRate consistent with trend sum", s1.totals.giftOrdersWeek === giftWeek0 + 1);
  assert("weekly rate = round(gift/orders)", s1.totals.giftRateWeek === expGiftRate);
  assert("trend has 7 points", at.length === 7);
})();
