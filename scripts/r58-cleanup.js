// R58 cleanup — removes ALL R58 probe artifacts (idempotent; safe to re-run):
//   1. the probe visitor's wishEvents (co-occurrence seeding, IP 203.0.113.58)
//   2. the probe railEvent (valid rail-click with the probe vid)
// Organic wishes, real orders and all other data untouched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_IP = "203.0.113.58";
const PROBE_VID = "r58probevid1234567890";

(async () => {
  const wishes = await db.wishEvent.deleteMany({ where: { ip: PROBE_IP } });
  console.log("probe wishEvents deleted:", wishes.count);
  const rails = await db.railEvent.deleteMany({ where: { vid: PROBE_VID } });
  console.log("probe railEvents deleted:", rails.count);
  const residueWish = await db.wishEvent.count({ where: { ip: PROBE_IP } });
  const residueVid = await db.railEvent.count({ where: { vid: PROBE_VID } });
  const [orderCount, gross, conversions, railTotal, wishAdds] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.aggregate({ _sum: { total: true } }),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
    db.wishEvent.count({ where: { action: "add" } }),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / ${gross._sum.total} gross / railEvents ${railTotal} / conversions ${conversions} / wishAdds ${wishAdds} / probe residue (ip ${residueWish}, vid ${residueVid})`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
