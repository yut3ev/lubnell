// R42 cleanup — deletes the probe orders on the R42 QA phone (…039) and
// restores GLOW20 usageCount (the orders API increments it on redemption;
// deleting the order does not decrement it). Prints the baseline for
// verification: 4 orders / 952 gross / 3 net / 806 netEGP / 0 gifts.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const del = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000039" } });
  console.log("deleted R42 probe orders:", del.count);
  const glow = await db.storeCoupon.updateMany({ where: { code: "GLOW20", usageCount: { gt: 0 } }, data: { usageCount: 0 } });
  console.log("GLOW20 usageCount reset rows:", glow.count);
  const [orders, giftOrders, wishes] = await Promise.all([
    db.storeOrder.findMany({ select: { total: true, status: true, giftNote: true, couponCode: true } }),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
    db.wishEvent.count(),
  ]);
  const gross = orders.reduce((a, o) => a + o.total, 0);
  const net = orders.filter(o => o.status !== "cancelled");
  const netEGP = net.reduce((a, o) => a + o.total, 0);
  console.log(`baseline: ${orders.length} orders / ${gross} gross / ${net.length} net / ${netEGP} netEGP / ${giftOrders} gifts / ${wishes} wishEvents`);
  console.log("coupon codes in baseline:", JSON.stringify([...new Set(orders.map(o => o.couponCode))]), "(expect LUBNEL10 ×4 incl. 1 cancelled)");
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
