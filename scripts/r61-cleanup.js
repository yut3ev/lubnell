// R61 cleanup — removes ALL R61 E2E artifacts (idempotent; safe to re-run):
//   1. the probe visitor's wishEvents (top-saves seeding for the E2E strip,
//      IP 203.0.113.61)
//   2. the browser wishlist toggle's events on care-makeup-box — LESSON
//      (recon verified the hard way): browser-originated toggles arrive with
//      x-forwarded-for "::1" (IPv6 loopback), NOT the "local" fallback the
//      curl seeds get — so the toggle cleanup covers BOTH ips. The
//      pre-existing residual local pair on university-box is NOT touched.
// Organic wishes, real orders and all other data untouched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_IP = "203.0.113.61";
const TOGGLE_SLUG = "care-makeup-box";

(async () => {
  const probeWishes = await db.wishEvent.deleteMany({ where: { ip: PROBE_IP } });
  console.log("probe wishEvents deleted:", probeWishes.count);
  const toggleWishes = await db.wishEvent.deleteMany({ where: { productId: TOGGLE_SLUG, ip: { in: ["local", "::1", "127.0.0.1"] } } });
  console.log("browser toggle wishEvents deleted:", toggleWishes.count);
  const [residueIp, toggleResidue] = await Promise.all([
    db.wishEvent.count({ where: { ip: PROBE_IP } }),
    db.wishEvent.count({ where: { productId: TOGGLE_SLUG, ip: { in: ["local", "::1", "127.0.0.1"] } } }),
  ]);
  const [orderCount, gross, conversions, railTotal, wishAdds, wishEvents] = await Promise.all([
    db.storeOrder.count(),
    db.storeOrder.aggregate({ _sum: { total: true } }),
    db.railEvent.count({ where: { convertedAt: { not: null } } }),
    db.railEvent.count(),
    db.wishEvent.count({ where: { action: "add" } }),
    db.wishEvent.count(),
  ]);
  console.log(`book after cleanup: ${orderCount} orders / ${gross._sum.total} gross / railEvents ${railTotal} / conversions ${conversions} / wishAdds ${wishAdds} / wishEvents ${wishEvents} / residue (ip61 ${residueIp}, toggle ${toggleResidue})`);
  await db.$disconnect();
})().catch(e => { console.error("CLEANUP FAIL", e); process.exit(1); });
