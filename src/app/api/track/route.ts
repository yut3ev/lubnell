import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Public order tracking: order number + phone → live status from the same
// Order rows the Studio dashboard manages. Both fields required (privacy).
const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'تم التأكيد — قيد التجهيز',
  shipped: 'تم الشحن — في الطريق إليكِ',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

function normalizePhone(v: string): string {
  const digits = (v || '').replace(/\D/g, '');
  return digits.startsWith('20') ? digits.slice(2) : digits;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const order = (searchParams.get('order') || '').trim().toUpperCase();
  const phone = normalizePhone(searchParams.get('phone') || '');
  if (!order || !phone) {
    return NextResponse.json({ ok: false, error: 'اكتبي رقم الطلب ورقم الموبايل' }, { status: 400 });
  }
  let row: Awaited<ReturnType<typeof findOrder>> = null;
  try {
    row = await findOrder(order, phone);
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر الوصول للطلبات الآن — جربي بعد قليل' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json(
      { ok: false, error: 'مفيش طلب بالبيانات دي — تأكدي من رقم الطلب ورقم الموبايل' },
      { status: 404 }
    );
  }
  return NextResponse.json({
    ok: true,
    order: {
      orderNumber: row.orderNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] || row.status,
      cancelled: row.status === 'cancelled',
      placedAt: row.createdAt,
      city: row.city,
      items: row.items.map((i) => ({
        name: i.nameAr,
        qty: i.qty,
        price: i.price,
        variant: i.variant || null,
      })),
      subtotal: row.subtotal,
      shipping: row.shipping,
      total: row.total,
    },
  });
}

function findOrder(order: string, phone: string) {
  return db.order.findFirst({
    where: { orderNumber: order },
    include: { items: true },
  }).then((row) => {
    if (!row) return null;
    if (normalizePhone(row.phone) !== phone) return null;
    return row;
  });
}
