import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = await parseBody<{ email?: string }>(req);
    const normalized = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return jsonError("بريد إلكتروني غير صالح");
    await db.subscriber.upsert({ where: { email: normalized }, create: { email: normalized }, update: {} });
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذر تسجيل البريد", 500);
  }
}
