// R48 cleanup — removes ALL R48 probe artifacts (idempotent; safe to re-run):
//   1. the probe orders on the R45/R48 QA phone (…049)
//   2. the probe RailEvents by the probe vid (the conversion experiment rows)
// Organic wishes, real orders and all other data untouched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_VID = "r48probevid1234567890";

(async () => {
  const orders = await db.storeOrder.deleteMany({ where: { customerPhone: "011100000049" } });
  console.log("probe orders deleted:", orders.count);
  const rails = await db.railEvent.deleteMany({ where: { vid: PROBE_VID } });
  console.log("probe railEvents deleted:", rails.count);
  const residue = await db.railEvent.count({ where: { vid: PROBE_VID } });
  const [orderCount, conversions, organicRails] = await Promise.all([
    db.storeOrder.count(),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / railEvents total ${organicRails} / conversions ${conversions} / probe-vid residue ${residue}`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
