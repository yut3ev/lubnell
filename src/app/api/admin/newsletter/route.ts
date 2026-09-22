// U71-NEWSLETTER-ADMIN — dashboard «النشرة البريدية» data: subscribers table
// (email / name / lang / date / ip — exactly the owner's requested columns)
// + send history + whether SMTP is configured. Read-only; sending lives in
// ./send to keep this endpoint fast and cache-free.
import { jsonOk, jsonError, requireAdmin } from "@/lib/api-helpers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // marketing data rides the customers permission (owner implicit; staff can
  // be granted customers.read from «الفريق»)
  const ctx = await requireAdmin(req, ["customers.read"]);
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const [subscribers, logs, smtpRow] = await Promise.all([
      db.subscriber.findMany({ orderBy: { createdAt: "desc" } }),
      db.newsletterLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      db.storeSettings.findUnique({ where: { key: "smtp" } }),
    ]);
    let smtp = { host: "", user: "", fromName: "", fromEmail: "" };
    try {
      const parsed = JSON.parse(smtpRow?.value || "{}") as Partial<typeof smtp>;
      smtp = {
        host: parsed.host || "",
        user: parsed.user || "",
        fromName: parsed.fromName || "",
        fromEmail: parsed.fromEmail || "", // U72-SMTP-BREVO — visible sender
      };
    } catch {
      /* keep defaults — never leak the password here */
    }
    return jsonOk({
      ok: true,
      subscribers: subscribers.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        lang: s.lang,
        ip: s.ip,
        createdAt: s.createdAt,
      })),
      logs,
      smtpReady: Boolean(smtp.host && smtp.user),
      smtpUser: smtp.user,
      smtpFromName: smtp.fromName,
      smtpFromEmail: smtp.fromEmail,
    });
  } catch {
    return jsonError("تعذر تحميل بيانات النشرة", 500);
  }
}
