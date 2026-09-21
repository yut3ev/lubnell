// Public order tracking: look up orders by phone number (U13 — rewritten
// against the live Order/OrderItem models; the recovered copy referenced a
// phantom storeOrder model and 500'd on first use).
import { db } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get("phone") || "").replace(/[\s-]/g, "");
  if (phone.length < 5) return jsonError("اكتبي رقم هاتف صحيح (5 أرقام على الأقل)");
  try {
    const orders = await db.order.findMany({
      where: { phone: { contains: phone } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true },
    });
    const mapped = orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      items: o.items.map((it) => ({ id: it.productId || it.id, name: it.nameAr, quantity: it.qty, price: it.price })),
      subtotal: o.subtotal,
      shipping: o.shipping,
      discount: o.discount,
      total: o.total,
      status: o.status,
      cancelRequested: o.cancelRequested,
      couponCode: o.couponCode,
      createdAt: o.createdAt.toISOString(),
    }));
    return jsonOk({ orders: mapped });
  } catch (error) {
    console.error("track lookup failed", error);
    return jsonError("تعذر البحث عن الطلبات الآن", 500);
  }
}
