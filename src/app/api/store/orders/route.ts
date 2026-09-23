// Public order creation (WhatsApp checkout flow) + admin listing lives under /api/admin/orders
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { validateCoupon, incrementCouponUsage } from "@/lib/coupons";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { requestMeta } from "@/lib/admin-auth";
import { getMaintenanceState } from "@/lib/maintenance"; // U77-MAINTENANCE-MODE
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/lubnel-types";
import { emitLive } from "@/lib/live";

export const dynamic = "force-dynamic";

type OrderItemInput = { id: string; name: string; quantity: number; price: number };

export async function POST(req: Request) {
  try {
    await ensureSeed();
    // U77-MAINTENANCE-MODE — while the owner has the store closed, a stale tab
    // must not be able to checkout. Visitors get the maintenance screen on any
    // page load, but this server-side gate protects the money path too.
    const maintenance = await getMaintenanceState();
    if (maintenance.enabled) {
      return jsonError("الموقع مغلق حاليًا للصيانة — جرّبي تاني بعد شوية 🌸", 503);
    }
    // R35 — shipping values follow the owner's Settings (Studio "حد الشحن المجاني" /
    // "رسوم الشحن"). Before this round the API silently used the baked constants,
    // so changing the settings had no effect on real orders. Sanitized with the
    // constants as fallback (bad/missing values can't produce free-shipping abuse).
    const settingsRow = await db.storeSettings.findUnique({ where: { key: "store" } });
    let s: Record<string, unknown> = {};
    try { s = settingsRow ? JSON.parse(settingsRow.value) : {}; } catch { s = {}; }
    const thresholdRaw = Number(s.freeShippingThreshold);
    const feeRaw = Number(s.shippingFee);
    const freeThreshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 ? thresholdRaw : FREE_SHIPPING_THRESHOLD;
    const shipFee = Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : SHIPPING_FEE;
    const body = (await req.json()) as {
      orderNumber?: string;
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      items?: OrderItemInput[];
      couponCode?: string;
      giftNote?: string; // R31 — optional gift-card message
      vid?: string; // R48 — anonymous visitor id for rail-attribution (no PII)
    };
    const items = (body.items || []).filter(i => i && i.name && i.quantity > 0);
    if (!items.length) return jsonError("لا توجد منتجات في الطلب");
    if (!body.customerName || body.customerName.trim().length < 2) return jsonError("اكتبي الاسم كاملًا");
    if (!body.customerPhone || body.customerPhone.trim().length < 5) return jsonError("اكتبي رقم هاتف صحيح");

    // Recompute totals server-side from live product prices when possible
    let subtotal = 0;
    const pricedItems: OrderItemInput[] = [];
    for (const item of items) {
      const product = await db.storeProduct.findUnique({ where: { slug: item.id } });
      const price = product ? product.price : Math.max(0, Math.floor(item.price));
      subtotal += price * item.quantity;
      pricedItems.push({ id: item.id, name: item.name, quantity: item.quantity, price });
    }
    const shipping = subtotal >= freeThreshold || subtotal === 0 ? 0 : shipFee;

    let discount = 0;
    let appliedCode: string | null = null;
    if (body.couponCode) {
      const coupon = await validateCoupon(body.couponCode, subtotal);
      if (!coupon.valid) return jsonError(coupon.message);
      discount = coupon.discount;
      appliedCode = coupon.code;
    }
    const total = Math.max(0, subtotal - discount + shipping);
    // R31 — gift note: trim + hard 200-char cap (UI mirrors via maxLength)
    const giftNote = body.giftNote ? body.giftNote.trim().slice(0, 200) || null : null;
    const orderNumber = body.orderNumber?.trim() || `LN-${Date.now()}`;
    const meta = requestMeta(req);
    // R48/R50 — anonymous vid: sanitized exactly like the rail-click route
    // (8–64 chars of [A-Za-z0-9_-], else dropped → ""). Persisted on the order
    // row since R50 so the studio can show WHICH orders arrived through a
    // converted rail click (no PII — the id is a random localStorage uuid;
    // storage-disabled visitors simply send none and get "").
    const vid = /^[A-Za-z0-9_-]{8,64}$/.test(String(body.vid || "").trim()) ? String(body.vid).trim() : "";

    const order = await db.storeOrder.create({
      data: {
        orderNumber,
        customerName: body.customerName.trim(),
        customerPhone: body.customerPhone.trim(),
        customerAddress: body.customerAddress?.trim() || null,
        giftNote,
        items: JSON.stringify(pricedItems),
        subtotal,
        shipping,
        discount,
        couponCode: appliedCode,
        total,
        status: "new",
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        vid,
      },
    });
    if (appliedCode) await incrementCouponUsage(appliedCode);
    // R48 — rail-pull conversion: if this browser clicked an also-saved rail
    // card in the last 24h (same anonymous vid), stamp those unconverted
    // pulls as converted. Fire-and-forget semantics — a failure here must
    // never fail the order itself. Orders are never modified; the whole
    // attribution story lives in the RailEvent table.
    if (vid) {
      try {
        await db.railEvent.updateMany({
          where: { vid, convertedAt: null, createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
          data: { convertedAt: new Date() },
        });
      } catch { /* attribution is a nice-to-have, never a blocker */ }
    }
    await emitLive("order:new", {
      orderNumber,
      customerName: order.customerName,
      phone: order.customerPhone,
      total,
      itemCount: pricedItems.reduce((s, i) => s + i.quantity, 0),
      hasGiftNote: Boolean(giftNote),
    });
    return jsonOk({ success: true, id: order.id, orderNumber, subtotal, shipping, discount, total });
  } catch (error) {
    console.error("order create failed", error);
    return jsonError("تعذر تسجيل الطلب", 500);
  }
}
