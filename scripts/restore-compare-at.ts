// U10-OFFERS-DATA — restore the owner's product discount prices (compareAt)
// that were wiped from the DB by the platform snapshot restore (21:07).
// Values are reconstructed EXACTLY from the owner's own screenshots of the
// approved storefront (brave_*.png uploads), cross-checked against the
// discount % badges visible on the cards:
//   معطر جسم 200 → 250 (-20%) · بلاشر 95 → 120 (-21%) · مزيل 95 → 115 (-17%)
//   زبدة بوم 85 → 105 (-19%) · فازلين 150 → 185 (-19%) · قفاز 80 → 95 (-16%)
// Idempotent: only fills compareAt when it is null/0 — never touches rows the
// owner has already set herself.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DISCOUNTS: Array<{ slug: string; compareAt: number }> = [
  { slug: 'strawberry-body-mist', compareAt: 250 },
  { slug: 'yardbeauty-liquid-blush', compareAt: 120 },
  { slug: 'sheglam-clear-away-remover', compareAt: 115 },
  { slug: 'bom-watermelon-body-butter', compareAt: 105 },
  { slug: 'vaseline-hair-tonic', compareAt: 185 },
  { slug: 'soap-glory-scrub-glove', compareAt: 95 },
];

async function main() {
  for (const { slug, compareAt } of DISCOUNTS) {
    const p = await prisma.product.findUnique({ where: { slug } });
    if (!p) {
      console.log(`SKIP ${slug} — not found`);
      continue;
    }
    if (p.compareAt && p.compareAt > 0) {
      console.log(`KEEP ${slug} — owner value already set (${p.compareAt})`);
      continue;
    }
    await prisma.product.update({ where: { slug }, data: { compareAt } });
    console.log(`SET ${slug}: ${p.price} → was ${compareAt}`);
  }
  const live = await prisma.product.count({ where: { compareAt: { gt: 0 } } });
  console.log(`products with live discounts now: ${live}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
