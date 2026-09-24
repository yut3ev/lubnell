#!/usr/bin/env node
// R32 QA cleanup — remove the two gift-note test orders and restore the exact
// R31 baseline (4 orders / 952 gross / 806 net). Safe by design: only deletes
// rows whose phone matches the R32 test numbers AND whose note mentions R32.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
async function main() {
  const targets = await db.storeOrder.findMany({
    where: { customerPhone: { in: ["011100000032", "011100000033"] }, giftNote: { contains: "R32" } },
    select: { id: true, orderNumber: true, giftNote: true },
  });
  console.log("deleting:", targets);
  const res = await db.storeOrder.deleteMany({
    where: { id: { in: targets.map(t => t.id) } },
  });
  console.log("deleted:", res.count);
  const [agg, netAgg, gifts] = await Promise.all([
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
  ]);
  console.log("baseline check:", {
    orders: Number(agg._count._all),
    gross: Number(agg._sum.total),
    netOrders: Number(netAgg._count._all),
    net: Number(netAgg._sum.total),
    gifts,
  });
}
main().finally(() => db.$disconnect());
