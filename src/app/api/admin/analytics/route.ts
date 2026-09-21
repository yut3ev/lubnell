import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

// U23-ANALYTICS — the real E-commerce analytics feed behind the rebuilt
// «التحليلات» page. One call returns everything the dashboard needs for a
// selectable window (7/14/30/90 days): KPI cards with previous-period
// comparison, a per-day revenue+orders series for the chart (current AND
// previous period so the chart can draw the ghost comparison line), the
// status funnel with completion/cancellation rates, best sellers with share
// of revenue, revenue-by-city, and the latest orders.
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [7, 14, 30, 90];
const dayFmt = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' });

const pctDelta = (cur: number, prev: number) => {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 1000) / 10;
  return cur > 0 ? 100 : 0;
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !(admin.perms.includes('dashboard.read') || admin.perms.includes('analytics.read'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = Number(url.searchParams.get('range') || 14);
  const range = (RANGES.includes(raw) ? raw : 14) as 7 | 14 | 30 | 90;
  const compare = url.searchParams.get('compare') !== '0';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const curStart = new Date(startOfToday.getTime() - (range - 1) * DAY_MS);
  const prevStart = new Date(curStart.getTime() - range * DAY_MS);

  // one order query covers current + previous period; split in memory
  const orders = await db.order.findMany({
    where: { createdAt: { gte: prevStart, lt: new Date(startOfToday.getTime() + DAY_MS) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNumber: true, customerName: true, city: true, total: true, status: true, createdAt: true },
  });

  const cur = orders.filter((o) => o.createdAt >= curStart && o.createdAt < now);
  const prev = orders.filter((o) => o.createdAt >= prevStart && o.createdAt < curStart);
  const valid = (rows: typeof cur) => rows.filter((o) => o.status !== 'cancelled');

  const curValid = valid(cur);
  const prevValid = valid(prev);
  const revenue = curValid.reduce((s, o) => s + o.total, 0);
  const prevRevenue = prevValid.reduce((s, o) => s + o.total, 0);
  const aov = curValid.length ? Math.round(revenue / curValid.length) : 0;
  const prevAov = prevValid.length ? Math.round(prevRevenue / prevValid.length) : 0;

  // per-day series (oldest → newest) for current AND previous window
  const bucket = (start: Date, days: number, rows: typeof curValid) =>
    Array.from({ length: days }, (_, i) => {
      const dayStart = new Date(start.getTime() + i * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const dayOrders = rows.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
      return {
        label: dayFmt.format(dayStart),
        revenue: Math.round(dayOrders.reduce((s, o) => s + o.total, 0)),
        orders: dayOrders.length,
      };
    });

  const series = bucket(curStart, range, curValid);
  const prevSeries = compare ? bucket(prevStart, range, prevValid) : [];

  // status funnel (current window)
  const statusCounts = cur.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const totalCur = cur.length;
  const completionRate = totalCur ? Math.round(((statusCounts.delivered || 0) / totalCur) * 100) : 0;
  const cancellationRate = totalCur ? Math.round(((statusCounts.cancelled || 0) / totalCur) * 100) : 0;

  // best sellers within the window (distinct-order count + revenue share)
  const items = await db.orderItem.findMany({
    where: { order: { createdAt: { gte: curStart, lt: now }, status: { not: 'cancelled' } } },
    select: { orderId: true, productId: true, nameAr: true, image: true, qty: true, price: true },
  });
  const byProduct = new Map<string, { nameAr: string; image: string | null; qty: number; revenue: number; orderIds: Set<string> }>();
  for (const it of items) {
    if (!it.productId) continue;
    const rec = byProduct.get(it.productId) || { nameAr: it.nameAr, image: it.image, qty: 0, revenue: 0, orderIds: new Set<string>() };
    rec.qty += it.qty;
    rec.revenue += it.qty * it.price;
    rec.orderIds.add(it.orderId);
    byProduct.set(it.productId, rec);
  }
  const itemsRevenue = revenue || 1;
  const bestSellers = [...byProduct.entries()]
    .map(([id, v]) => ({
      id,
      nameAr: v.nameAr,
      image: v.image,
      qty: v.qty,
      orders: v.orderIds.size,
      revenue: Math.round(v.revenue),
      share: Math.round((v.revenue / itemsRevenue) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // revenue by city (current window, non-cancelled)
  const cityMap = new Map<string, number>();
  for (const o of curValid) cityMap.set(o.city || 'غير محدد', (cityMap.get(o.city || 'غير محدد') || 0) + o.total);
  const cities = [...cityMap.entries()]
    .map(([city, rev]) => ({ city, revenue: Math.round(rev), share: Math.round((rev / itemsRevenue) * 100) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // low stock (catalog-wide, same <10 threshold as the overview)
  const lowProducts = await db.product.findMany({
    where: { stock: { lt: 10 } },
    orderBy: { stock: 'asc' },
    take: 5,
    select: { id: true, nameAr: true, image: true, stock: true },
  });
  const lowStockCount = await db.product.count({ where: { stock: { lt: 10 } } });

  return NextResponse.json({
    ok: true,
    range,
    compare,
    kpis: {
      revenue: { value: Math.round(revenue), prev: Math.round(prevRevenue), deltaPct: pctDelta(revenue, prevRevenue) },
      aov: { value: aov, prev: prevAov, deltaPct: pctDelta(aov, prevAov), orders: curValid.length },
      orders: { value: cur.length, prev: prev.length, deltaAbs: cur.length - prev.length },
      lowStock: { value: lowStockCount },
    },
    series,
    prevSeries,
    funnel: {
      counts: {
        pending: statusCounts.pending || 0,
        confirmed: statusCounts.confirmed || 0,
        shipped: statusCounts.shipped || 0,
        delivered: statusCounts.delivered || 0,
      },
      cancelled: statusCounts.cancelled || 0,
      total: totalCur,
      completionRate,
      cancellationRate,
    },
    bestSellers,
    cities,
    lowProducts,
    recentOrders: orders.slice(0, 8).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      city: o.city,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
