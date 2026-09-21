// R36+R37 cleanup — deletes all probe orders on the QA phones used by
// scripts/r36-probe.js (…037) and scripts/r37-probe.js (…038) and prints the
// baseline for verification.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const del = await db.storeOrder.deleteMany({ where: { customerPhone: { in: ["011100000037", "011100000038"] } } });
  console.log("deleted probe orders:", del.count);
  const orders = await db.storeOrder.findMany({ select: { total: true, status: true, giftNote: true, shipping: true } });
  const gross = orders.reduce((a, o) => a + o.total, 0);
  const net = orders.filter(o => o.status !== "cancelled");
  const netEGP = net.reduce((a, o) => a + o.total, 0);
  const gifts = orders.filter(o => o.giftNote).length;
  console.log(`baseline: ${orders.length} orders / ${gross} gross / ${net.length} net / ${netEGP} netEGP / ${gifts} gifts`);
  const shippingValues = [...new Set(orders.map(o => o.shipping))].sort((a, b) => a - b);
  console.log("shipping values in baseline:", shippingValues, "(owner settings 900/60 → expect 60 or 0)");
  await db.$disconnect();
})();
