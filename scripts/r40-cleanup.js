// R40 cleanup — wishlist events are the ONLY R40 footprint:
// baseline has ZERO WishEvent rows, so deleteMany({}) is an exact restore.
// No counters to reset (unlike coupons' usageCount) — the board counts rows.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const before = await db.wishEvent.count();
  const del = await db.wishEvent.deleteMany({});
  console.log(`wishEvent rows before: ${before}, deleted: ${del.count}`);

  // Baseline re-check straight from the source of truth
  const [orders, giftOrders, wishes] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
    db.wishEvent.count(),
  ]);
  const agg = await db.storeOrder.aggregate({ _sum: { total: true } });
  const netAgg = await db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true }, where: { status: { not: "cancelled" } } });
  console.log(`baseline: orders ${orders} / gross ${agg._sum.total} / net orders+rev ${netAgg._count._all || 0}+${netAgg._sum.total} / gifts ${giftOrders} / wishEvents ${wishes}`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
