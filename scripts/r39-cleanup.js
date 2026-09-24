// R39 cleanup — deletes the probe order on QA phone …040 and restores
// WELCOME50 usageCount (baseline is 18 from seed history; the orders API
// incremented it on redemption and deleting the order does not decrement).
// Then prints the baseline for verification.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const del = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000040" } });
  console.log("deleted R39 probe orders:", del.count);
  const coupon = await db.storeCoupon.findUnique({ where: { code: "WELCOME50" } });
  if (coupon && coupon.usageCount > 18) {
    await db.storeCoupon.update({ where: { code: "WELCOME50" }, data: { usageCount: 18 } });
    console.log("WELCOME50 usageCount restored:", coupon.usageCount, "→ 18");
  } else {
    console.log("WELCOME50 usageCount already ≤ 18:", coupon?.usageCount);
  }
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
