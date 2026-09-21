// U10-SAMESLIDE — mobile now renders the SAME slide image as desktop; this
// sets which side of the artwork stays in frame on the narrow phone crop.
//
// Usage:
//   bun scripts/set-slide-mobilepos.ts <left|center|right> [id...]   # default id: soft-ritual
//   bun scripts/set-slide-mobilepos.ts                                # soft-ritual → right
//
// Idempotent: safe to run repeatedly.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--on");
  const pos = ["left", "center", "right"].includes(args[0]) ? args[0] : "right";
  const ids = args[0] && ["left", "center", "right"].includes(args[0]) ? args.slice(1) : args;
  const where = ids.length ? { id: { in: ids } } : { id: "soft-ritual" };

  const res = await db.heroSlide.updateMany({ where, data: { mobilePos: pos } });
  console.log(`mobilePos=${pos} applied to ${res.count} slide(s)`);

  const slides = await db.heroSlide.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, mobilePos: true, showText: true, mobileImage: true },
  });
  for (const s of slides)
    console.log(`${s.id.padEnd(14)} mobilePos=${s.mobilePos.padEnd(6)} showText=${s.showText} legacyMobileImage=${s.mobileImage ?? "—"}`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
