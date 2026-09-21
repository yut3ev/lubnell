// R63 cleanup — removes the ONE accidental E2E order. LESSON (paid in full
// this round): the WhatsApp-template stub test re-seeded the bag and called
// location.reload() — the reload WIPED the window.fetch/window.open stubs,
// so the second "checkout" clicked through to the REAL POST /api/store/orders
// and wrote a real order (LN-1789063513190 / "R63 Paid Ship" / 860).
// This script deletes exactly that row (orderNumber + customerName double
// guard), then prints the full book state. railEvents were 0 in the quiet
// book so the POST's railEvent conversion touched nothing (verified below).
// Idempotent; safe to re-run.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  const gone = await db.storeOrder.deleteMany({
    where: { orderNumber: "LN-1789063513190", customerName: "R63 Paid Ship" },
  });
  console.log("accidental E2E order deleted:", gone.count);
  const [orderCount, gross, netAgg, conversions, railTotal, wishAdds, wishEvents] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.aggregate({ _sum: { total: true } }),
    db.storeOrder.aggregate({ _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
    db.wishEvent.count({ where: { action: "add" } }),
    db.wishEvent.count(),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / ${gross._sum.total} gross / ${netAgg._sum.total} net / railEvents ${railTotal} / conversions ${conversions} / wishAdds ${wishAdds} / wishEvents ${wishEvents}`);
  await db.$disconnect();
  if (orderCount !== 6 || gross._sum.total !== 2127) { console.error("BOOK NOT RESTORED"); process.exit(1); }
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
