import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('orders.read'))
    return NextResponse.json({ ok: false }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status');
  const orders = await db.order.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return NextResponse.json({
    ok: true,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      phone: o.phone,
      city: o.city,
      address: o.address,
      notes: o.notes,
      giftNote: o.giftNote,
      customerIp: o.customerIp,
      userAgent: o.userAgent,
      cancelRequested: o.cancelRequested,
      subtotal: o.subtotal,
      shipping: o.shipping,
      discount: o.discount,
      couponCode: o.couponCode,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({ nameAr: i.nameAr, qty: i.qty, price: i.price })),
    })),
  });
}
