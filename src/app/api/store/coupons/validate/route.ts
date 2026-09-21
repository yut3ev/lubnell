import { validateCoupon } from "@/lib/coupons";
import { jsonOk } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code, subtotal } = (await req.json()) as { code?: string; subtotal?: number };
    const result = await validateCoupon(String(code || ""), Math.max(0, Math.floor(Number(subtotal) || 0)));
    return jsonOk(result);
  } catch {
    return jsonOk({ valid: false, code: "", discount: 0, message: "تعذر التحقق من الكود الآن" });
  }
}
