// R38 cleanup — deletes probe orders on the R38 QA phone (…039, coupon probe)
// and prints the baseline for verification. Also restores GLOW20 usageCount
// (the orders API increments it on redemption; deleting the order does not
// decrement it) so the coupon table matches its baseline state.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const del = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000039" } });
  console.log("deleted R38 probe orders:", del.count);
  // restore GLOW20 usageCount = 0 (baseline had zero GLOW20 redemptions)
  const glow = await db.storeCoupon.updateMany({ where: { code: "GLOW20", usageCount: { gt: 0 } }, data: { usageCount: 0 } });
  console.log("GLOW20 usageCount reset rows:", glow.count);
  const orders = await db.storeOrder.findMany({ select: { total: true, status: true, giftNote: true, shipping: true, couponCode: true } });
  const gross = orders.reduce((a, o) => a + o.total, 0);
  const net = orders.filter(o => o.status !== "cancelled");
  const netEGP = net.reduce((a, o) => a + o.total, 0);
  const gifts = orders.filter(o => o.giftNote).length;
  console.log(`baseline: ${orders.length} orders / ${gross} gross / ${net.length} net / ${netEGP} netEGP / ${gifts} gifts`);
  const shippingValues = [...new Set(orders.map(o => o.shipping))].sort((a, b) => a - b);
  console.log("shipping values in baseline:", shippingValues, "(owner settings 900/60 → expect 60 or 0)");
  console.log("coupon codes in baseline:", JSON.stringify([...new Set(orders.map(o => o.couponCode))]), "(expect LUBNEL10 ×4 incl. 1 cancelled)");
  await db.$disconnect();
})();
