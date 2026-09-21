// U6 heroHeight E2E roundtrip: set tall -> check API -> restore standard
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const key = "homeSections";
  const row = await db.storeSettings.findUnique({ where: { key } });
  let cfg: Record<string, unknown> = row ? JSON.parse(row.value) : {};
  console.log("before:", JSON.stringify(cfg.heroHeight));

  cfg.heroHeight = "tall";
  await db.storeSettings.upsert({
    where: { key },
    create: { key, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });

  const res = await fetch("http://localhost:3000/api/store/slides");
  const d = await res.json();
  console.log("api-after-tall:", d.heroHeight);

  // restore
  cfg.heroHeight = "standard";
  await db.storeSettings.upsert({
    where: { key },
    create: { key, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });
  const res2 = await fetch("http://localhost:3000/api/store/slides");
  const d2 = await res2.json();
  console.log("api-after-restore:", d2.heroHeight);
}

main().finally(() => db.$disconnect());
