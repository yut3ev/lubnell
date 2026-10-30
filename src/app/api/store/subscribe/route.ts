import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { clientIpFromHeaders } from "@/lib/client-ip"; // U71-NEWSLETTER-ADMIN
// U73-WELCOME-UNSUBSCRIBE — a new subscriber now gets a branded welcome
// email through the owner's own SMTP card (Studio → إعدادات البريد الصادر).
// The subscription itself must NEVER fail because of the email step: every
// mailer error is swallowed and logged, and re-subscribing an existing
// address stays silent (no duplicate welcome spam).
// NV-INVITE-2026-10 — the «نادي لوبنيل» invite card wires into this route:
//  - honeypot field (bots fill every input; humans never see it) → fake
//    success, nothing saved
//  - per-IP throttle (light bucket, same pattern as restock-alerts)
//  - every NEW subscriber gets a REAL one-time percent coupon generated
//    server-side (LUBNEL-XXXXXX, usageLimit 1) that works at checkout, and
//    the welcome email carries the code + the real percentage. The discount
//    value lives in StoreSettings key=newsletter_welcome {"percent":N}
//    (default 10) — the page itself never shows a number.
import { buildMailer, listUnsubHeaders, unsubUrlFor } from "@/lib/mailer";
import { buildNewsletterHtml, type NewsletterLang } from "@/lib/newsletter-template";
import { getSettingsRows } from "@/lib/settings-cache";
import { randomBytes } from "node:crypto";

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

function welcomeCopy(lang: NewsletterLang, gift?: { code: string; percent: number }) {
  const base = WELCOME_COPY[lang];
  if (!gift) return base;
  const giftLine =
    lang === "en"
      ? `Your club gift 🎁 use code «${gift.code}» for ${gift.percent}% off your first order.`
      : `هدية النادي ليكِ 🎁 كود «${gift.code}» يديكِ خصم ${gift.percent}% على أول طلب.`;
  return { subject: base.subject, message: `${giftLine}\n\n${base.message}` };
}

/* ---------- welcome gift coupon (NV-INVITE-2026-10) ---------- */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L lookalikes

async function welcomePercent(): Promise<number> {
  try {
    const rows = await getSettingsRows(["newsletter_welcome"]);
    const parsed = JSON.parse(rows[0]?.value || "{}") as { percent?: number };
    const p = Math.floor(Number(parsed.percent));
    if (Number.isFinite(p) && p >= 1 && p <= 90) return p;
  } catch {
    /* fall through to the default */
  }
  return 10;
}

async function createWelcomeCoupon(percent: number): Promise<string | null> {
  try {
    for (let i = 0; i < 5; i++) {
      const bytes = randomBytes(6);
      let code = "LUBNEL-";
      for (let j = 0; j < 6; j++) code += CODE_ALPHABET[bytes[j] % CODE_ALPHABET.length];
      const exists = await db.coupon.findUnique({ where: { code } });
      if (exists) continue;
      await db.coupon.create({
        data: {
          code,
          type: "percent",
          value: percent,
          label: "خصم نادي لوبنيل — أول طلب",
          active: true,
          usageLimit: 1,
        },
      });
      return code;
    }
  } catch {
    /* a coupon hiccup never blocks the signup */
  }
  return null;
}

/* ---------- light per-IP throttle ---------- */

const buckets = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  buckets.set(ip, hits);
  if (buckets.size > 500) buckets.clear();
  return hits.length > 8;
}

export async function POST(req: Request) {
  try {
    const { email, name, lang, website } = await parseBody<{
      email?: string;
      name?: string;
      lang?: string;
      website?: string; // honeypot
    }>(req);
    // honeypot — bots fill every field, humans never see this input:
    // answer success and save nothing.
    if ((website || "").trim()) return jsonOk({ success: true });
    const ip = clientIpFromHeaders(req.headers) || "local";
    if (throttled(ip)) return jsonError("محاولات كتير — جربي بعد دقيقة", 429);
    const normalized = (email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return jsonError("بريد إلكتروني غير صالح");
    // U71-NEWSLETTER-ADMIN — the dashboard subscribers table shows الاسم/Lang/ip:
    // name is optional, lang follows the storefront UI language, ip is captured
    // from the standard proxy header (same source the admin auth uses).
    const cleanName = (name || "").trim().slice(0, 80) || null;
    const cleanLang = lang === "en" ? "en" : "ar";
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
      // welcome gift: a REAL one-time coupon, generated server-side, shipped
      // in the email only (never rendered on any page)
      const percent = await welcomePercent();
      const giftCode = await createWelcomeCoupon(percent);
      const gift = giftCode ? { code: giftCode, percent } : undefined;
      // fire-and-forget welcome mail — never block or fail the signup
      try {
        const mailer = await buildMailer();
        if (mailer) {
          const nl: NewsletterLang = cleanLang === "en" ? "en" : "ar";
          const copy = welcomeCopy(nl, gift);
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
