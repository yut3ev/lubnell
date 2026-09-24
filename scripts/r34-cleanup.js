// R34 cleanup — delete probe orders created during gift-pulse QA.
// Safety: deletes ONLY orders whose customerPhone matches the two QA probe
// numbers AND whose orderNumber carries the LN- R34 timestamp window prefix.
// Baseline to restore: 4 orders / 952 gross / 3 net(806 EGP) / 0 gifts.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const QA_PHONES = ["011100000035", "011100000036"];

(async () => {
  const victims = await db.storeOrder.findMany({
    where: { customerPhone: { in: QA_PHONES } },
    select: { id: true, orderNumber: true, customerPhone: true, giftNote: true },
  });
  console.log("found", victims.length, "probe orders:", victims.map(v => `${v.orderNumber}(gift:${v.giftNote ? "y" : "n"})`).join(", "));
  for (const v of victims) {
    await db.storeOrder.delete({ where: { id: v.id } });
    console.log("deleted", v.orderNumber);
  }
  const [agg, netAgg, gifts] = await Promise.all([
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
  ]);
  console.log("baseline:", agg._count._all, "orders /", Number(agg._sum.total), "gross /", netAgg._count._all, "net /", Number(netAgg._sum.total), "netEGP /", gifts, "gifts");
  await db.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
