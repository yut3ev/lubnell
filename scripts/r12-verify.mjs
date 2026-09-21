// Round 12 verification: bulk audit trail + restored visibility + live log tail
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const db = new PrismaClient();

const audits = await db.auditLog.findMany({
  where: { action: "product.bulk_updated" },
  orderBy: { id: "desc" },
  take: 2,
  select: { action: true, actorUsername: true, createdAt: true, metadata: true },
});
for (const a of audits) {
  const meta = JSON.parse(a.metadata || "{}");
  console.log(`audit: ${a.action} by=${a.actorUsername} at=${a.createdAt.toISOString()} via=${meta.via} affected=${(meta.affected || []).length}`);
}

const vis = await db.storeProduct.findFirst({ where: { slug: "care-more-body-lotion" }, select: { visible: true } });
console.log("lotion restored visible=", vis?.visible);

try {
  const live = fs.readFileSync("mini-services/lubnel-live/live.log", "utf8").trim().split("\n").slice(-4);
  console.log("live.log tail:\n" + live.join("\n"));
} catch { console.log("live.log not readable"); }

const visibleCount = await db.storeProduct.count({ where: { visible: true } });
const total = await db.storeProduct.count();
console.log(`catalog: ${visibleCount}/${total} visible`);
await db.$disconnect();
