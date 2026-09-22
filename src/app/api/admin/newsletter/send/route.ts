// U71-NEWSLETTER-ADMIN — send a branded newsletter to the store subscribers.
// POST { subject, message, target: 'all'|'ar'|'en', testEmail? }
// - SMTP credentials come from the owner's «إعدادات البريد الصادر» card
//   (StoreSettings key=smtp) — without them the route fails with a clear
//   Arabic setup message instead of silently dropping the campaign.
// - Every recipient gets the same subject/message rendered through
//   buildNewsletterHtml in THEIR OWN language (per-subscriber lang, with
//   first-name greeting when known).
// - Sequential dispatch with a small gap (small list) to be gentle with the
//   SMTP relay; result logged in NewsletterLog + audit.
import { NextResponse } from "next/server";
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { buildNewsletterHtml, STORE_URL, type NewsletterLang } from "@/lib/newsletter-template";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SmtpSettings = { host?: string; port?: number; user?: string; pass?: string; fromName?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, ["customers.read"]);
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const { subject, message, target, testEmail } = await parseBody<{
      subject?: string;
      message?: string;
      target?: string;
      testEmail?: string;
    }>(req);

    const cleanSubject = (subject || "").trim().slice(0, 150);
    const cleanMessage = (message || "").trim().slice(0, 6000);
    if (!cleanSubject || !cleanMessage)
      return jsonError("اكتبي عنوان الرسالة ونصها قبل الإرسال", 400);

    // ---- recipients -------------------------------------------------
    const isTest = Boolean(testEmail?.trim());
    const testAddress = (testEmail || "").trim().toLowerCase();
    if (isTest && !EMAIL_RE.test(testAddress))
      return jsonError("بريد التجربة غير صالح", 400);

    let recipients: { email: string; name: string | null; lang: NewsletterLang }[] = [];
    if (isTest) {
      recipients = [{ email: testAddress, name: null, lang: "ar" }];
    } else {
      const seg = target === "ar" || target === "en" ? target : "all";
      const subs = await db.subscriber.findMany({
        where: seg === "all" ? {} : { lang: seg },
        orderBy: { createdAt: "asc" },
      });
      recipients = subs.map((s) => ({
        email: s.email,
        name: s.name,
        lang: s.lang === "en" ? "en" : "ar",
      }));
    }
    if (recipients.length === 0)
      return jsonError(isTest ? "—" : "لا يوجد مشتركون في هذا التقسيم بعد", 400);

    // ---- SMTP transport ---------------------------------------------
    const row = await db.storeSettings.findUnique({ where: { key: "smtp" } });
    let smtp: SmtpSettings = {};
    try {
      smtp = JSON.parse(row?.value || "{}") as SmtpSettings;
    } catch {
      /* keep empty */
    }
    if (!smtp.host?.trim() || !smtp.user?.trim() || !smtp.pass?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "إعدادات البريد الصادر (SMTP) ناقصة — أضيفيها أولًا من الإعدادات → بيانات المتجر → «إعدادات البريد الصادر (SMTP)» ثم احفظي.",
        },
        { status: 400 },
      );
    }

    const nodemailer = (await import("nodemailer")).default;
    const port = Number(smtp.port) || 587;
    const transport = nodemailer.createTransport({
      host: smtp.host.trim(),
      port,
      secure: port === 465,
      auth: { user: smtp.user.trim(), pass: smtp.pass.trim() },
      connectionTimeout: 15_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000,
    });
    const fromName = smtp.fromName?.trim() || "LUBNÉL";
    const from = `"${fromName}" <${smtp.user.trim()}>`;

    // ---- dispatch ----------------------------------------------------
    let sent = 0;
    let failed = 0;
    const firstErrors: string[] = [];
    for (const r of recipients) {
      const html = buildNewsletterHtml({
        subject: cleanSubject,
        message: cleanMessage,
        lang: r.lang,
        firstName: r.name,
      });
      try {
        await transport.sendMail({
          from,
          to: r.email,
          subject: cleanSubject,
          html,
          text: cleanMessage,
          replyTo: smtp.user.trim(),
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        if (firstErrors.length < 3)
          firstErrors.push(`${r.email}: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
      }
      if (recipients.length > 1) await new Promise((res) => setTimeout(res, 350));
    }

    const status = sent === 0 ? "failed" : failed > 0 ? "partial" : "sent";
    const errorMsg = firstErrors.length ? firstErrors.join(" | ").slice(0, 900) : null;

    await db.newsletterLog.create({
      data: {
        subject: cleanSubject,
        target: isTest ? "test" : target === "ar" || target === "en" ? target : "all",
        recipients: recipients.length,
        sent,
        failed,
        status,
        error: errorMsg,
        actor: ctx.admin?.username ?? null,
      },
    });
    await audit(ctx, "newsletter.sent", `newsletter:${status}`, isTest ? "test" : String(recipients.length));

    if (sent === 0)
      return NextResponse.json(
        { ok: false, error: `فشل الإرسال — اتأكدي من بيانات SMTP. ${errorMsg || ""}`.trim() },
        { status: 502 },
      );

    return jsonOk({
      ok: true,
      sent,
      failed,
      total: recipients.length,
      test: isTest,
      errors: errorMsg,
      storeUrl: STORE_URL,
    });
  } catch {
    return jsonError("تعذر إرسال النشرة", 500);
  }
}
