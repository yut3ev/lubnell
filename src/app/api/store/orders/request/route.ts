// Customer order-cancel request (from order tracking): validates phone
// ownership, only allows for new orders, flags the order + writes an audit
// entry. (U13 — rewritten against the live Order model; the recovered copy
// referenced a phantom storeOrder model.)
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

    const order = await db.order.findUnique({ where: { orderNumber } });
    if (!order || !order.phone.replace(/[\s-]/g, "").includes(phone)) {
      return jsonError("لم نتمكن من التحقق من هذا الطلب", 403);
    }

    if (["cancelled", "delivered", "shipped"].includes(order.status)) {
      return jsonError("لا يمكن طلب إلغاء هذا الطلب — تواصلي معنا على واتساب لمساعدتكِ");
    }
    if (order.cancelRequested) return jsonError("طلب الإلغاء قيد المراجعة بالفعل");

    await db.order.update({
      where: { id: order.id },
      data: { cancelRequested: true, cancelRequestedAt: new Date() },
    });

    const meta = requestMeta(req);
    await writeAudit({
      actor: null,
      action: "order.cancel_requested",
      entity: "order",
      entityId: order.orderNumber ?? order.id,
      meta,
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
