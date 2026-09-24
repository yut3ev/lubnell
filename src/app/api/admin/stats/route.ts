import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  // U22-TEAM-PERMS — the overview/analytics data endpoint was previously
  // unguarded beyond a valid login; now it needs dashboard.read OR
  // analytics.read so team members only see reports they were granted.
  if (!admin || !(admin.perms.includes('dashboard.read') || admin.perms.includes('analytics.read'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(startOfToday.getTime() - 6 * DAY_MS);
  const weekAgoPrev = new Date(weekAgo.getTime() - 7 * DAY_MS);
  const startOfYesterday = new Date(startOfToday.getTime() - DAY_MS);

  const [orders, products, items] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: weekAgo } }, orderBy: { createdAt: 'desc' } }),
    db.product.findMany({ select: { id: true, slug: true, nameAr: true, image: true, price: true, stock: true, featured: true } }),
    db.orderItem.findMany({ select: { productId: true, qty: true, price: true, nameAr: true, image: true } }),
  ]);

  // U30-DASHBOARD-POLISH — previous 7-day window ([weekAgo-7d, weekAgo)) powers
  // the KPI period-over-period comparisons (revenue + avg order value).
  const [allOrders, prevWeekOrders] = await Promise.all([
    db.order.findMany({ select: { total: true, status: true, createdAt: true } }),
    db.order.findMany({ where: { createdAt: { gte: weekAgoPrev, lt: weekAgo } }, select: { total: true, status: true, createdAt: true } }),
  ]);
  const valid = allOrders.filter((o) => o.status !== 'cancelled');
  const revenueTotal = valid.reduce((s, o) => s + o.total, 0);
  const ordersToday = orders.filter((o) => o.createdAt >= startOfToday).length;
  const avgOrder = valid.length ? Math.round(revenueTotal / valid.length) : 0;
  const lowStock = products.filter((p) => p.stock < 10).length;

  // U30-DASHBOARD-POLISH — KPI trend data: money metrics compare the last 7
  // days vs the 7 days before them; order counts compare today vs yesterday.
  // pct = null when there is no prior period to compare against (prev = 0).
  const pctChange = (cur: number, prev: number): number | null =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const validWeek = orders.filter((o) => o.status !== 'cancelled');
  const prevValidWeek = prevWeekOrders.filter((o) => o.status !== 'cancelled');
  const revenueWeek = validWeek.reduce((s, o) => s + o.total, 0);
  const revenuePrevWeek = prevValidWeek.reduce((s, o) => s + o.total, 0);
  const ordersYesterday = orders.filter((o) => o.createdAt >= startOfYesterday && o.createdAt < startOfToday).length;
  const avgWeek = validWeek.length ? Math.round(revenueWeek / validWeek.length) : 0;
  const avgPrevWeek = prevValidWeek.length ? Math.round(revenuePrevWeek / prevValidWeek.length) : 0;
  const trends = {
    revenue: { cur: Math.round(revenueWeek), prev: Math.round(revenuePrevWeek), pct: pctChange(revenueWeek, revenuePrevWeek) },
    ordersToday: { cur: ordersToday, prev: ordersYesterday, pct: pctChange(ordersToday, ordersYesterday) },
    avg: { cur: avgWeek, prev: avgPrevWeek, pct: pctChange(avgWeek, avgPrevWeek) },
  };

  // last 7 days series (oldest → newest)
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const series = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(startOfToday.getTime() - (6 - i) * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const total = orders
      .filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd && o.status !== 'cancelled')
      .reduce((s, o) => s + o.total, 0);
    return { label: i === 6 ? 'اليوم' : dayNames[dayStart.getDay()], total: Math.round(total) };
  });

  // top products by qty sold
  const byProduct = new Map<string, { qty: number; revenue: number; nameAr: string; image: string | null }>();
  for (const it of items) {
    if (!it.productId) continue;
    const cur = byProduct.get(it.productId) || { qty: 0, revenue: 0, nameAr: it.nameAr, image: it.image };
    cur.qty += it.qty;
    cur.revenue += it.qty * it.price;
    byProduct.set(it.productId, cur);
  }
  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 4)
    .map(([id, v]) => ({ id, ...v }));

  // U14 — most-viewed products (StoreSettings "views" counter, from /api/store/track-view)
  let topViewed: { slug: string; nameAr: string; image: string | null; views: number }[] = [];
  try {
    const viewsRow = await db.storeSettings.findUnique({ where: { key: 'views' } });
    if (viewsRow) {
      const views = JSON.parse(viewsRow.value) as Record<string, number>;
      topViewed = Object.entries(views)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 5)
        .map(([slug, views]) => {
          const prod = products.find((p) => p.slug === slug);
          return { slug, nameAr: prod?.nameAr || slug, image: prod?.image || null, views: views || 0 };
        })
        .filter((x) => x.views > 0);
    }
  } catch {
    topViewed = [];
  }

  const statusCounts = allOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    stats: {
      ordersToday,
      revenueTotal: Math.round(revenueTotal),
      avgOrder,
      lowStock,
      totalOrders: allOrders.length,
      totalProducts: products.length,
      series,
      topProducts,
      statusCounts,
      topViewed,
      trends,
    },
    recentOrders: orders.slice(0, 5).map((o) => ({
      id: o.id,
      customer: o.customerName,
      total: o.total,
      status: o.status,
      date: o.createdAt.toISOString(),
    })),
  });
}
