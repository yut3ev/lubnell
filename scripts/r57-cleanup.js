// R57 cleanup — removes ALL R57 probe artifacts (idempotent; safe to re-run):
//   1. the probe orders on the R57 QA phone (…058)
//   2. the probe RailEvents by BOTH probe vids (converted + never-converted)
// Organic wishes, real orders and all other data untouched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_VIDS = ["r57probevid1234567890", "r57probevid22468noordr"];

(async () => {
  const orders = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000058" } });
  console.log("probe orders deleted:", orders.count);
  const rails = await db.railEvent.deleteMany({ where: { vid: { in: PROBE_VIDS } } });
  console.log("probe railEvents deleted:", rails.count);
  const residueVid = await db.railEvent.count({ where: { vid: { in: PROBE_VIDS } } });
  const residuePhone = await db.storeOrder.count({ where: { customerPhone: "011100000058" } });
  const [orderCount, gross, conversions, railTotal] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.aggregate({ _sum: { total: true } }),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / ${gross._sum.total} gross / railEvents ${railTotal} / conversions ${conversions} / probe residue (vids ${residueVid}, phone ${residuePhone})`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
