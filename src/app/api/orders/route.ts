import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/lib/constants';
import { incrementCouponUsage, validateCoupon } from '@/lib/coupons';
import { requestMeta } from '@/lib/admin-auth';
import { clientIpFromHeaders } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

interface IncomingItem {
  slug?: string;
  id?: string;
  qty: number;
}

/* SEC-AUDIT-3 — light in-memory spam throttle for order placement
 * (per-IP sliding window, same pattern as the share/wishlist throttles):
 * 5 orders / 10 min per IP. Real customers never hit this (they place one or
 * two orders), but a scripted flood would fill the orders panel, burn coupon
 * usage counts and spam the owner's WhatsApp. */
const ORDER_WINDOW_MS = 10 * 60 * 1000;
const ORDER_MAX_PER_WINDOW = 5;
const orderTimestamps = new Map<string, number[]>();

function orderThrottled(ip: string): { throttled: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (orderTimestamps.get(ip) || []).filter((t) => now - t < ORDER_WINDOW_MS);
  if (recent.length >= ORDER_MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((ORDER_WINDOW_MS - (now - recent[0])) / 1000);
    orderTimestamps.set(ip, recent);
    return { throttled: true, retryAfter };
  }
  recent.push(now);
  orderTimestamps.set(ip, recent);
  return { throttled: false, retryAfter: 0 };
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = clientIpFromHeaders(req.headers);
    const throttle = orderThrottled(clientIp || 'unknown');
    if (throttle.throttled) {
      return NextResponse.json(
        {
          ok: false,
          error: `تم استلام عدة طلبات من هذا الجهاز — تواصلي معنا على واتساب لإتمام طلبك (${Math.ceil(throttle.retryAfter / 60)} دقيقة)`,
        },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfter) } }
      );
    }
    const body = await req.json();
    const { customerName, phone, city, address, notes, items, couponCode } = body as {
      customerName?: string;
      phone?: string;
      city?: string;
      address?: string;
      notes?: string;
      items?: IncomingItem[];
      couponCode?: string;
    };

    if (!customerName?.trim() || !phone?.trim() || !city?.trim() || !address?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'الرجاء إكمال بيانات التوصيل كاملة' },
        { status: 400 }
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'سلة المشتريات فارغة' },
        { status: 400 }
      );
    }

    // resolve products server-side (never trust client prices)
    const slugs = [...new Set(items.map((i) => i.slug || i.id).filter(Boolean))] as string[];
    const products = await db.product.findMany({ where: { slug: { in: slugs } } });
    const bySlug = new Map(products.map((p) => [p.slug, p]));

    const orderItems = [];
    for (const it of items) {
      const p = bySlug.get(it.slug || it.id || '');
      if (!p) continue;
      const qty = Math.max(1, Math.min(20, Math.floor(Number(it.qty) || 1)));
      orderItems.push({
        productId: p.id,
        nameAr: p.nameAr,
        image: p.image,
        price: p.price,
        qty,
      });
    }

    if (orderItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'لم يتم العثور على المنتجات المطلوبة' },
        { status: 400 }
      );
    }

    const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    // coupon: always re-validated server-side against the real subtotal
    let discount = 0;
    let appliedCoupon: string | null = null;
    if (couponCode?.trim()) {
      const result = await validateCoupon(couponCode, subtotal);
      if (!result.valid) {
        return NextResponse.json({ ok: false, error: result.message }, { status: 400 });
      }
      discount = result.discount;
      appliedCoupon = result.code;
    }
    const total = Math.max(0, subtotal - discount + shipping);

    // SUP-8 — person log: stamp every order with a human-readable reference
    // plus the placement IP / user-agent so the Studio orders & customers
    // views can show name → orders → IP exactly as the owner requested.
    const meta = requestMeta(req);
    const orderNumber = `LN-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        customerName: customerName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
        notes: notes?.trim() || null,
        subtotal,
        shipping,
        discount,
        couponCode: appliedCoupon,
        total,
        customerIp: meta.ip && meta.ip !== 'unknown' ? meta.ip : null,
        userAgent: meta.userAgent && meta.userAgent !== 'unknown' ? meta.userAgent.slice(0, 300) : null,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    if (appliedCoupon) await incrementCouponUsage(appliedCoupon);

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        discount: order.discount,
        couponCode: order.couponCode,
        itemCount: order.items.length,
      },
    });
  } catch (err) {
    console.error('[orders]', err);
    return NextResponse.json(
      { ok: false, error: 'تعذر إنشاء الطلب، حاول مرة أخرى' },
      { status: 500 }
    );
  }
}
