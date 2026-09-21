// R46 cleanup — remove probe wishEvents by probe IP (idempotent; safe to
// re-run). Probe IPs live in the 10.46.0.x space and are never issued to real
// visitors (private range + probe-specific). No orders, coupons or products
// touched this round; real customer orders are NEVER touched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_IPS = ["10.46.0.1", "10.46.0.2", "10.46.0.3", "10.46.0.9"];

(async () => {
  const gone = await db.wishEvent.deleteMany({ where: { ip: { in: PROBE_IPS } } });
  console.log(`[r46-cleanup] wishEvents deleted: ${gone.count} (probe IPs: ${PROBE_IPS.join(", ")})`);
  const residue = await db.wishEvent.count({ where: { ip: { in: PROBE_IPS } } });
  const total = await db.wishEvent.count();
  console.log(`[r46-cleanup] probe-ip residue: ${residue} | wishEvents remaining in book: ${total}`);
  await db.$disconnect();
})();
