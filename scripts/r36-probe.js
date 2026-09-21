// R36 probe — verify bestSellersWeek window math + ordersByHour histogram.
// Creates 2 probe orders on QA phone 011100000037, shifts createdAt, then
// logs in (cookie-based session!) and prints the new stats fields.
// Cleanup = scripts/r36-cleanup.js (deletes both by phone).
const BASE = "http://localhost:3000";
const PHONE = "011100000037";

async function post(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, setCookie: r.headers.get("set-cookie"), json: await r.json().catch(() => null) };
}

(async () => {
  // baseline snapshot
  const login0 = await post(`${BASE}/api/admin/auth`, { username: "owner", password: "lubnel1234", verificationCode: "7777" });
  const cookie = (login0.setCookie || "").split(";")[0];
  if (!cookie) { console.log("LOGIN FAILED", login0.status, JSON.stringify(login0.json)); process.exit(1); }
  const s0 = await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
  console.log("BASELINE orders:", s0.totals.orders, "gross:", s0.totals.revenue, "| bestSellersAll:", JSON.stringify(s0.bestSellers?.map(b => `${b.slug}:${b.qty}`)), "| week:", JSON.stringify(s0.bestSellersWeek?.map(b => `${b.slug}:${b.qty}`)), "| hoursSum:", (s0.ordersByHour || []).reduce((a, b) => a + b, 0));

  // probe A — today 03:00 local, in the 7-day window
  const a = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R36 أ", customerPhone: PHONE, customerAddress: "القاهرة",
    items: [{ id: "university-box", name: "University Box", price: 700, quantity: 2 }],
    paymentMethod: "cod",
  });
  if (a.status !== 200) { console.log("PROBE A FAILED", a.status, JSON.stringify(a.json)); process.exit(1); }

  // probe B — 9 days ago 15:00 local, OUTSIDE the 7-day window but inside 30d
  const b = await post(`${BASE}/api/store/orders`, {
    customerName: "QA R36 ب", customerPhone: PHONE, customerAddress: "الجيزة",
    items: [{ id: "strawberry-lip-set", name: "Strawberry Lip Set", price: 200, quantity: 1 }],
    paymentMethod: "cod",
  });
  if (b.status !== 200) { console.log("PROBE B FAILED", b.status, JSON.stringify(b.json)); process.exit(1); }

  // shift createdAt via Prisma
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  const now = new Date();
  const at3am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3, 15, 0);
  const d9 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 9, 15, 40, 0);
  await db.storeOrder.update({ where: { orderNumber: a.json.orderNumber }, data: { createdAt: at3am } });
  await db.storeOrder.update({ where: { orderNumber: b.json.orderNumber }, data: { createdAt: d9 } });
  await db.$disconnect();
  console.log("probes:", a.json.orderNumber, "@", at3am.toString(), "|", b.json.orderNumber, "@", d9.toString());

  // re-read stats
  const s1 = await (await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } })).json();
  const all = s1.bestSellers?.map(b => `${b.slug}:${b.qty}:${b.revenue}`);
  const wk = s1.bestSellersWeek?.map(b => `${b.slug}:${b.qty}:${b.revenue}`);
  console.log("AFTER orders:", s1.totals.orders, "| bestSellersAll:", JSON.stringify(all));
  console.log("bestSellersWeek:", JSON.stringify(wk));
  console.log("ordersByHour:", JSON.stringify(s1.ordersByHour), "sum:", s1.ordersByHour.reduce((x, y) => x + y, 0));

  // assertions
  const uni = all.find(x => x.startsWith("university-box:"));
  const strawAll = all.find(x => x.startsWith("strawberry-lip-set:"));
  const strawWk = (wk || []).find(x => x.startsWith("strawberry-lip-set:"));
  const uniWk = (wk || []).find(x => x.startsWith("university-box:"));
  const h3 = s1.ordersByHour[3], h15 = s1.ordersByHour[15];
  // university-box catalog price is 200 (server recomputes); baseline held qty 3 in-week
  const assert = (name, ok) => console.log(ok ? `PASS ${name}` : `FAIL ${name}`);
  assert("A in week window (university-box week qty=5 = 3 baseline + 2)", uniWk === "university-box:5:1000");
  assert("A in all-time (university-box 5:1000)", uni === "university-box:5:1000");
  assert("B excluded from week (no strawberry in week)", !strawWk);
  assert("B in all-time (strawberry 1:200)", strawAll === "strawberry-lip-set:1:200");
  assert("A lands in hour bucket 3", h3 >= 1);
  assert("B lands in hour bucket 15", h15 >= 1);
  assert("histogram sum == 30d orders (all 6)", s1.ordersByHour.reduce((x, y) => x + y, 0) === 6);
  assert("week slice <= all-time totals", s1.bestSellersWeek.reduce((x, y) => x + y.qty, 0) <= s1.bestSellers.reduce((x, y) => x + y.qty, 0));
})();
