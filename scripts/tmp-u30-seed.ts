// U30 QA — temporary seed to exercise the trend chips (green ▲ / red ▼),
// cleaned up right after verification. NOT part of the app.
// Usage: bun scripts/tmp-u30-seed.ts seed | bun scripts/tmp-u30-seed.ts clean
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const day = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
};

const mk = (when: Date, total: number) => ({
  orderNumber: 'QA-U30-' + total,
  customerName: 'QA-U30',
  phone: '010000000000',
  city: 'القاهرة',
  address: 'عنوان اختبار',
  subtotal: total,
  shipping: 0,
  discount: 0,
  total,
  status: 'confirmed',
  createdAt: when,
});

async function main() {
  const mode = process.argv[2] || 'seed';
  if (mode === 'clean') {
    const gone = await db.order.deleteMany({ where: { customerName: 'QA-U30' } });
    console.log('cleaned', gone.count);
    return;
  }
  await db.order.createMany({ data: [mk(day(1), 300), mk(day(10), 200)] });
  console.log('seeded QA orders (yesterday 300 + 10 days ago 200)');
}

main().finally(() => db.$disconnect());
