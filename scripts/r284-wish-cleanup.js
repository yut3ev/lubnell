// r284-wish-cleanup.js — one-off: remove the wish rows the r45-PROBE (wrongly
// invoked this round) left behind. Row forensics: the probe rides spoofed
// 10.45.0.11..14 (the R46-era cleanup list says 10.46.0.x — one segment off,
// which is why its sweep matched 0). Deletion is pinned to the EXACT four
// observed IPs; the organic pair (ip="local", 2026-09-10) is untouchable.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const PROBE_WISH_IPS = ["10.45.0.11", "10.45.0.12", "10.45.0.13", "10.45.0.14"];

(async () => {
  const before = await db.wishEvent.findMany({
    where: { ip: { in: PROBE_WISH_IPS } },
    select: { id: true, ip: true, action: true, productId: true, createdAt: true },
  });
  console.log("matched probe wish rows:", JSON.stringify(before, null, 1));
  const del = await db.wishEvent.deleteMany({ where: { ip: { in: PROBE_WISH_IPS } } });
  const organic = await db.wishEvent.count();
  console.log(`deleted: ${del.count} | wishEvents remaining (all-time): ${organic}`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
