// R52 cleanup — removes ALL R52 probe artifacts (idempotent; safe to re-run):
//   1. the probe orders on the R52 QA phone (…053)
//   2. the probe RailEvents by the probe vid (the mix/attribution rows)
// Organic wishes, real orders and all other data untouched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_VID = "r52probevid1234567890";

(async () => {
  const orders = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000053" } });
  console.log("probe orders deleted:", orders.count);
  const rails = await db.railEvent.deleteMany({ where: { vid: PROBE_VID } });
  console.log("probe railEvents deleted:", rails.count);
  const residueVid = await db.railEvent.count({ where: { vid: PROBE_VID } });
  const residuePhone = await db.storeOrder.count({ where: { customerPhone: "011100000053" } });
  const [orderCount, gross, conversions, railTotal] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.aggregate({ _sum: { total: true } }),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / ${gross._sum.total} gross / railEvents ${railTotal} / conversions ${conversions} / probe residue (vid ${residueVid}, phone ${residuePhone})`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
