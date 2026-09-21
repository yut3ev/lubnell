// Public order tracking: look up orders by phone number (last 4 digits of order number shown masked)
import { db } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get("phone") || "").replace(/[\s-]/g, "");
  if (phone.length < 5) return jsonError("اكتبي رقم هاتف صحيح (5 أرقام على الأقل)");
  try {
    const orders = await db.storeOrder.findMany({
      where: {
        customerPhone: { contains: phone },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        orderNumber: true, customerName: true, customerAddress: true,
        items: true, subtotal: true, shipping: true, discount: true,
        total: true, status: true, cancelRequested: true, cancelRequestedAt: true, couponCode: true, createdAt: true, updatedAt: true,
      },
    });
    const mapped = orders.map(order => {
      let items: { id: string; name: string; quantity: number; price: number }[] = [];
      try { items = JSON.parse(order.items || "[]"); } catch { items = []; }
      return { ...order, items, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(), cancelRequestedAt: order.cancelRequestedAt ? order.cancelRequestedAt.toISOString() : null };
    });
    return jsonOk({ orders: mapped });
  } catch (error) {
    console.error("track lookup failed", error);
    return jsonError("تعذر البحث عن الطلبات الآن", 500);
  }
}
