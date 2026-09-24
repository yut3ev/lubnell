// R47 cleanup — remove RailEvents created during the probe window
// (idempotent; safe to re-run). Rail clicks are aggregate-only signals, so a
// time-window delete is the right hygiene here; no orders, coupons, wishes
// or products touched. Real customer records are NEVER touched.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const since = new Date(Date.now() - 30 * 60 * 1000); // last 30 minutes is plenty for a probe round

(async () => {
  const gone = await db.railEvent.deleteMany({ where: { createdAt: { gte: since } } });
  console.log(`[r47-cleanup] railEvents deleted: ${gone.count} (created after ${since.toISOString()})`);
  const total = await db.railEvent.count();
  console.log(`[r47-cleanup] railEvents remaining in book: ${total}`);
  await db.$disconnect();
})();
