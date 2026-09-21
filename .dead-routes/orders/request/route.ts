// Customer order-cancel request (from #/track): validates phone ownership,
// only allows for new/confirmed orders, flags the order + writes an audit entry.
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { requestMeta, writeAudit } from "@/lib/admin-auth";
import { emitLive } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await parseBody<{ orderNumber?: string; phone?: string; reason?: string }>(req);
    const orderNumber = body.orderNumber?.trim();
    const phone = (body.phone || "").replace(/[\s-]/g, "");
    if (!orderNumber || phone.length < 5) return jsonError("بيانات الطلب غير مكتملة");

    const order = await db.storeOrder.findUnique({ where: { orderNumber } });
    if (!order || !order.customerPhone.includes(phone)) return jsonError("لم نتمكن من التحقق من هذا الطلب", 403);

    if (["cancelled", "completed", "shipped"].includes(order.status)) {
      return jsonError("لا يمكن طلب إلغاء هذا الطلب — تواصلي معنا على واتساب لمساعدتكِ");
    }
    if (order.cancelRequested) return jsonError("طلب الإلغاء قيد المراجعة بالفعل");

    await db.storeOrder.update({
      where: { id: order.id },
      data: { cancelRequested: true, cancelRequestedAt: new Date() },
    });

    const meta = requestMeta(req);
    await writeAudit({
      actor: null,
      action: "order.cancel_requested",
      entity: "store_order",
      entityId: order.orderNumber,
      meta,
      metadata: { customerName: order.customerName, status: order.status, total: order.total, reason: body.reason?.slice(0, 300) || null },
    });

    await emitLive("order:cancel_requested", {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
    });

    return jsonOk({ success: true, message: "تم إرسال طلب الإلغاء — سيراجعه فريقنا ويتواصل معكِ عبر واتساب" });
  } catch (error) {
    console.error("cancel request failed", error);
    return jsonError("تعذر إرسال طلب الإلغاء الآن", 500);
  }
}
