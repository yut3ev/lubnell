// R35 cleanup — delete probe orders created during best-sellers + shipping QA.
// Safety: deletes ONLY orders whose customerPhone matches the QA probe numbers.
// Also verifies shipping settings are back at 900/60 (they were toggled to 500/30
// mid-round to prove the settings-driven shipping fix).
// Baseline to restore: 4 orders / 952 gross / 3 net(806 EGP) / 0 gifts.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const QA_PHONES = ["011100000037", "011100000038", "011100000039", "011100000040"];

(async () => {
  const victims = await db.storeOrder.findMany({
    where: { customerPhone: { in: QA_PHONES } },
    select: { id: true, orderNumber: true, customerPhone: true, shipping: true },
  });
  console.log("found", victims.length, "probe orders:", victims.map(v => `${v.orderNumber}(ship:${v.shipping})`).join(", "));
  for (const v of victims) {
    await db.storeOrder.delete({ where: { id: v.id } });
    console.log("deleted", v.orderNumber);
  }
  const [agg, netAgg, gifts, settingsRow] = await Promise.all([
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    db.storeOrder.aggregate({ _count: { _all: true }, _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    db.storeOrder.count({ where: { giftNote: { not: null } } }),
    db.storeSettings.findUnique({ where: { key: "store" } }),
  ]);
  const s = JSON.parse(settingsRow?.value || "{}");
  console.log("baseline:", agg._count._all, "orders /", Number(agg._sum.total), "gross /", netAgg._count._all, "net /", Number(netAgg._sum.total), "netEGP /", gifts, "gifts");
  console.log("settings:", "thr", s.freeShippingThreshold, "fee", s.shippingFee, "(expect 900/60)");
  await db.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
