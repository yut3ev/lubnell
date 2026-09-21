// R59 cleanup — removes ALL R59 probe artifacts (idempotent; safe to re-run):
//   1. the probe orders on the R59 QA phone (…059)
//   2. the probe railEvent by the probe vid
//   3. the probe visitor's wishEvents (co-occurrence seeding, IP 203.0.113.59)
// Organic wishes, real orders and all other data untouched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_IP = "203.0.113.59";
const PROBE_VID = "r59probevid1234567890";
const PROBE_PHONE = "011100000059";

(async () => {
  const orders = await db.storeOrder.deleteMany({ where: { customerPhone: PROBE_PHONE } });
  console.log("probe orders deleted:", orders.count);
  const rails = await db.railEvent.deleteMany({ where: { vid: PROBE_VID } });
  console.log("probe railEvents deleted:", rails.count);
  const wishes = await db.wishEvent.deleteMany({ where: { ip: PROBE_IP } });
  console.log("probe wishEvents deleted:", wishes.count);
  const [residueVid, residuePhone, residueIp] = await Promise.all([
    db.railEvent.count({ where: { vid: PROBE_VID } }),
    db.storeOrder.count({ where: { customerPhone: PROBE_PHONE } }),
    db.wishEvent.count({ where: { ip: PROBE_IP } }),
  ]);
  const [orderCount, gross, conversions, railTotal, wishAdds] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.aggregate({ _sum: { total: true } }),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
    db.wishEvent.count({ where: { action: "add" } }),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / ${gross._sum.total} gross / railEvents ${railTotal} / conversions ${conversions} / wishAdds ${wishAdds} / probe residue (phone ${residuePhone}, vid ${residueVid}, ip ${residueIp})`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
