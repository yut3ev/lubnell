// U10-HEROTEXT — turn OFF the storefront text overlay for artwork-only hero
// banners (images that already carry their own designed-in text, e.g. the
// owner's ChatGPT-generated campaign banner on "soft-ritual").
//
// Usage:
//   bun scripts/set-slide-showtext.ts                # applies to soft-ritual
//   bun scripts/set-slide-showtext.ts <id> [id...]   # applies to given ids
//   bun scripts/set-slide-showtext.ts --on <id>      # re-enable site text
//
// Idempotent: safe to run repeatedly.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const on = args.includes("--on");
  const ids = args.filter((a) => a !== "--on");
  const where = ids.length ? { id: { in: ids } } : { id: "soft-ritual" };

  const res = await db.heroSlide.updateMany({ where, data: { showText: on } });
  console.log(`showText=${on} applied to ${res.count} slide(s): ${JSON.stringify(where)}`);

  const slides = await db.heroSlide.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, showText: true, image: true },
  });
  for (const s of slides) console.log(`${s.showText ? "TEXT " : "CLEAN"}  ${s.id}  ${s.image}`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
