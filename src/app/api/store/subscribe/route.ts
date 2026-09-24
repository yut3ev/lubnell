import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { clientIpFromHeaders } from "@/lib/client-ip"; // U71-NEWSLETTER-ADMIN
// U73-WELCOME-UNSUBSCRIBE — a new subscriber now gets a branded welcome
// email through the owner's own SMTP card (Studio → إعدادات البريد الصادر).
// The subscription itself must NEVER fail because of the email step: every
// mailer error is swallowed and logged, and re-subscribing an existing
// address stays silent (no duplicate welcome spam).
import { buildMailer, listUnsubHeaders, unsubUrlFor } from "@/lib/mailer";
import { buildNewsletterHtml, type NewsletterLang } from "@/lib/newsletter-template";

export const dynamic = "force-dynamic";

const WELCOME_COPY: Record<NewsletterLang, { subject: string; message: string }> = {
  ar: {
    subject: "أهلاً بيكي في نادي لوبنيل 🌸",
    message: `نفخر إنك انضمّتي لينا 💕

إنتِ دلوقتي أول من يعرف: القطع الجديدة أول ما توصل، عروض خاصة للمشتركات بس، ونصايح مختارة من عالم المكياج والعناية والعطور الأصلية 100%.

تشوفي كل الجديد أول بأول من زر «تسوقي الآن» تحت 👇`,
  },
  en: {
    subject: "Welcome to the LUBNÉL Club 🌸",
    message: `We're so happy you joined 💕

You're now first to know: fresh arrivals the moment they land, subscriber-only offers, and handpicked notes on makeup, skincare and 100% original fragrances.

Explore everything new through the “Shop now” button below 👇`,
  },
};

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
    const existing = await db.subscriber.findUnique({ where: { email: normalized } });
    if (existing) {
      await db.subscriber.update({
        where: { email: normalized },
        data: { name: cleanName ?? undefined, lang: cleanLang, ip },
      });
    } else {
      const sub = await db.subscriber.create({
        data: { email: normalized, name: cleanName, lang: cleanLang, ip },
      });
      // fire-and-forget welcome mail — never block or fail the signup
      try {
        const mailer = await buildMailer();
        if (mailer) {
          const nl: NewsletterLang = cleanLang === "en" ? "en" : "ar";
          const copy = WELCOME_COPY[nl];
          await mailer.transport.sendMail({
            from: mailer.from,
            to: sub.email,
            subject: copy.subject,
            html: buildNewsletterHtml({
              subject: copy.subject,
              message: copy.message,
              lang: nl,
              firstName: sub.name,
              unsubUrl: unsubUrlFor(sub.email),
            }),
            text: copy.message,
            replyTo: mailer.senderEmail,
            headers: listUnsubHeaders(sub.email),
          });
          await db.newsletterLog.create({
            data: {
              subject: copy.subject,
              target: "welcome",
              recipients: 1,
              sent: 1,
              failed: 0,
              status: "sent",
              actor: "subscribe",
            },
          });
        }
      } catch (mailErr) {
        await db.newsletterLog
          .create({
            data: {
              subject: "welcome",
              target: "welcome",
              recipients: 1,
              sent: 0,
              failed: 1,
              status: "failed",
              error: (mailErr instanceof Error ? mailErr.message : "welcome mail error").slice(0, 900),
              actor: "subscribe",
            },
          })
          .catch(() => {});
      }
    }
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذر تسجيل البريد", 500);
  }
}
