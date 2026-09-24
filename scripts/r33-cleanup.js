#!/usr/bin/env node
// R33 QA cleanup — remove the gift-nudge test order and confirm the R31/R32
// baseline (4 orders / 952 gross / 3 net / 806 net / 0 gifts).
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
async function main() {
  const res = await db.storeOrder.deleteMany({
    where: { customerPhone: "011100000034" }, // QA-only phone — covers note & no-note probes
  });
  console.log("deleted:", res.count);
  const [agg, netAgg, gifts] = await Promise.all([
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
  ]);
  console.log("baseline:", {
    orders: Number(agg._count._all),
    gross: Number(agg._sum.total),
    netOrders: Number(netAgg._count._all),
    net: Number(netAgg._sum.total),
    gifts,
  });
}
main().finally(() => db.$disconnect());
