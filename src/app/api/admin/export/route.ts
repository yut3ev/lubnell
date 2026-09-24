import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]): string {
  return '\ufeff' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type') || 'orders';

  // U22 — full JSON backup (everything: settings + catalog + orders).
  // Owner-only because it dumps the entire database content.
  if (type === 'full') {
    if (admin.role !== 'owner')
      return NextResponse.json({ ok: false, error: 'owner only' }, { status: 401 });
    const [
      settings,
      categories,
      products,
      orders,
      coupons,
      reviews,
      subscribers,
      rolePermissions,
      slides,
      mediaAssets,
    ] = await Promise.all([
      db.storeSettings.findMany(),
      db.category.findMany({ orderBy: { createdAt: 'asc' } }),
      db.product.findMany({ include: { category: { select: { slug: true } } }, orderBy: { createdAt: 'asc' } }),
      db.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }),
      db.coupon.findMany({ orderBy: { createdAt: 'desc' } }),
      db.review.findMany({ orderBy: { createdAt: 'desc' } }),
      db.subscriber.findMany({ orderBy: { createdAt: 'desc' } }),
      db.rolePermission.findMany(),
      db.heroSlide.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      store: 'LUBNÉL',
      counts: {
        settings: settings.length,
        categories: categories.length,
        products: products.length,
        orders: orders.length,
        coupons: coupons.length,
        reviews: reviews.length,
        subscribers: subscribers.length,
        slides: slides.length,
        mediaAssets: mediaAssets.length,
      },
      settings,
      categories,
      products,
      orders,
      coupons,
      reviews,
      subscribers,
      rolePermissions,
      slides,
      mediaAssets,
    };
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="lubnel-backup-${date}.json"`,
      },
    });
  }

  if (type === 'products') {
    if (!admin.perms.includes('products.read'))
      return NextResponse.json({ ok: false }, { status: 401 });
    const products = await db.product.findMany({ include: { category: true }, orderBy: { createdAt: 'desc' } });
    const rows: (string | number | null)[][] = [
      ['slug', 'nameAr', 'nameEn', 'category', 'price', 'compareAt', 'stock', 'featured', 'badgeAr'],
      ...products.map((p) => [
        p.slug,
        p.nameAr,
        p.nameEn,
        p.category.nameAr,
        p.price,
        p.compareAt,
        p.stock,
        p.featured ? 'yes' : 'no',
        p.badgeAr,
      ]),
    ];
    return new NextResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lubnel-products.csv"`,
      },
    });
  }

  if (!admin.perms.includes('orders.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const orders = await db.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } });
  const rows: (string | number | null)[][] = [
    ['id', 'date', 'customer', 'phone', 'city', 'address', 'subtotal', 'shipping', 'discount', 'coupon', 'total', 'status', 'items'],
    ...orders.map((o) => [
      `LN-${o.id.slice(-6).toUpperCase()}`,
      o.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      o.customerName,
      o.phone,
      o.city,
      o.address,
      o.subtotal,
      o.shipping,
      o.discount,
      o.couponCode,
      o.total,
      o.status,
      o.items.map((i) => `${i.nameAr} x${i.qty}`).join(' | '),
    ]),
  ];
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lubnel-orders.csv"`,
    },
  });
}
