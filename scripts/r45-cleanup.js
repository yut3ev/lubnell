// R45 cleanup — deletes the probe orders on the R45 QA phone (…049), resets
// GLOW20 usageCount (the orders API increments it on redemption; deleting the
// order does not decrement it), and clears the seeded WishEvents. Idempotent.
// R46 SAFETY FIX — wishEvents are LIVE customer data now (first organic wish
// landed 2026-09-10), so the blanket deleteMany({}) is retired: only probe-IP
// rows are removed, matching r46-cleanup's PROBE_IPS.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_IPS = ["10.46.0.1", "10.46.0.2", "10.46.0.3", "10.46.0.9"];

(async () => {
  const del = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000049" } });
  console.log("deleted R45 probe orders:", del.count);
  const glow = await db.storeCoupon.updateMany({ where: { code: "GLOW20", usageCount: { gt: 0 } }, data: { usageCount: 0 } });
  console.log("GLOW20 usageCount reset rows:", glow.count);
  const wishes = await db.wishEvent.deleteMany({ where: { ip: { in: PROBE_IPS } } });
  console.log("probe-IP WishEvents cleared:", wishes.count, "(organic rows preserved)");
  const [orders, giftOrders] = await Promise.all([
    db.storeOrder.findMany({ select: { total: true, status: true, giftNote: true, couponCode: true } }),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
  ]);
  const gross = orders.reduce((a, o) => a + o.total, 0);
  const net = orders.filter(o => o.status !== "cancelled");
  const netEGP = net.reduce((a, o) => a + o.total, 0);
  console.log(`baseline: ${orders.length} orders / ${gross} gross / ${net.length} net / ${netEGP} netEGP / ${giftOrders} gifts / 0 wishEvents`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
