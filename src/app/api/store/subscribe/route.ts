import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { clientIpFromHeaders } from "@/lib/client-ip"; // U71-NEWSLETTER-ADMIN

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, name, lang } = await parseBody<{
      email?: string;
      name?: string;
      lang?: string;
    }>(req);
    const normalized = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return jsonError("بريد إلكتروني غير صالح");
    // U71-NEWSLETTER-ADMIN — the dashboard subscribers table shows الاسم/Lang/ip:
    // name is optional, lang follows the storefront UI language, ip is captured
    // from the standard proxy header (same source the admin auth uses).
    const cleanName = (name || "").trim().slice(0, 80) || null;
    const cleanLang = lang === "en" ? "en" : "ar";
    const ip = clientIpFromHeaders(req.headers) || null;
    await db.subscriber.upsert({
      where: { email: normalized },
      create: { email: normalized, name: cleanName, lang: cleanLang, ip },
      update: { name: cleanName ?? undefined, lang: cleanLang, ip },
    });
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذر تسجيل البريد", 500);
  }
}
