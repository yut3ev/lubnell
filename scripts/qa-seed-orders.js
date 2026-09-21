#!/usr/bin/env node
// QA seed: insert 320 fake orders (customerName='QA-PAGING') to exercise
// server-side pagination. Idempotent-ish: skips if a seed batch already exists.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
async function main() {
  const existing = await db.storeOrder.count({ where: { customerName: "QA-PAGING" } });
  if (existing > 0) { console.log("already seeded:", existing); return; }
  const statuses = ["new", "confirmed", "preparing", "shipped", "completed", "cancelled"];
  const rows = [];
  const base = Date.now();
  for (let i = 1; i <= 320; i++) {
    const st = statuses[i % statuses.length];
    const created = new Date(base - i * 3600_000);
    rows.push({
      orderNumber: `QA-${String(i).padStart(4, "0")}`,
      customerName: "QA-PAGING",
      customerPhone: `010000${String(i).padStart(5, "0")}`,
      items: JSON.stringify([{ nameAr: "اختبار", name: "QA item", qty: 1, price: 50 }]),
      subtotal: 50, shipping: 0, discount: 0, total: 50,
      status: st,
      createdAt: created, updatedAt: created,
    });
  }
  await db.storeOrder.createMany({ data: rows });
  console.log("seeded 320 QA orders");
}
main().finally(() => db.$disconnect());
