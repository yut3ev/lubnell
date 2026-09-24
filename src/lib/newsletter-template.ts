// U71-NEWSLETTER-ADMIN — branded email template for the newsletter sends.
// ISOMORPHIC on purpose: the admin composer imports the same function to
// render a live preview iframe, and the send API uses it for the actual
// delivery — what she previews is EXACTLY what subscribers receive.
//
// Email-client-safe markup: table layout + inline styles only (Gmail/Outlook
// strip <style> tags and flex/grid), 600px width, web-safe fallback fonts.
// Brand: LUBNÉL wine ≈ #8E3D43 (oklch 0.47 0.11 18 — see U48-CLUB-PRIMARY),
// soft blush background ≈ the storefront's bg-secondary tone.

export const STORE_URL = 'https://lubnel.vercel.app';
export const STORE_WA_URL = 'https://wa.me/201228405377';

export type NewsletterLang = 'ar' | 'en';

const C = {
  wine: '#8E3D43',
  wineDark: '#6E2E33',
  blush: '#FAF3F0',
  ink: '#3D2B2D',
  muted: '#8A7678',
  line: '#EBDCD8',
  white: '#FFFFFF',
} as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** newlines → <br /> + auto-link plain URLs (escape first, then linkify) */
function richText(raw: string): string {
  const escaped = escapeHtml(raw);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (m) => `<a href="${m}" style="color:${C.wine};font-weight:bold;">${m}</a>`,
  );
  return linked.replace(/\n/g, '<br />');
}

const COPY = {
  ar: {
    dir: 'rtl' as const,
    lang: 'ar',
    align: 'right' as const,
    cta: 'تسوقي الآن',
    preheader: 'نشرة لوبنيل',
    footerNote: 'وصلك الرسالة لأنك مشتركة في نشرة لوبنيل البريدية 💕',
    unsubscribe: 'إلغاء الاشتراك',
    orWa: 'أو راسلينا على واتساب',
    tagline: 'جمالٌ يُهدى بكل حب',
    heroWord: 'نشرة لوبنيل',
  },
  en: {
    dir: 'ltr' as const,
    lang: 'en',
    align: 'left' as const,
    cta: 'Shop now',
    preheader: 'LUBNÉL newsletter',
    footerNote: 'You are receiving this because you joined the LUBNÉL newsletter 💕',
    unsubscribe: 'Unsubscribe',
    orWa: 'or message us on WhatsApp',
    tagline: 'Beauty, gifted with love',
    heroWord: 'LUBNÉL LETTER',
  },
} as const;

export function buildNewsletterHtml(opts: {
  subject: string;
  message: string;
  lang?: NewsletterLang;
  /** optional greeting name for per-recipient personalization */
  firstName?: string | null;
  /** U73 — real one-click unsubscribe link for this recipient; when omitted
   *  (composer preview) the footer falls back to the WhatsApp line only. */
  unsubUrl?: string;
  /** U74-EMAIL-LOGO — base for the header logo asset: real sends point at the
   *  live site; the admin preview passes '' so the iframe resolves it on the
   *  panel origin (works before the site is republished). */
  assetBase?: string;
}): string {
  const assetBase = opts.assetBase !== undefined ? opts.assetBase : STORE_URL;
  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const c = COPY[lang];
  const subject = escapeHtml(opts.subject || (lang === 'ar' ? 'رسالة من لوبنيل' : 'A note from LUBNÉL'));
  const body = richText(opts.message || '');
  const greet = opts.firstName
    ? `<p style="margin:0 0 14px;font-size:16px;font-weight:bold;color:${C.ink};">` +
      (lang === 'ar' ? `أهلًا ${escapeHtml(opts.firstName)} 🌸` : `Hi ${escapeHtml(opts.firstName)} 🌸`) +
      `</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${c.lang}" dir="${c.dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.blush};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${C.white};border-radius:24px;overflow:hidden;border:1px solid ${C.line};">
        <!-- header — U74-EMAIL-LOGO: the owner's real LUBNÉL wordmark band
             (white on the brand's pure black) instead of live text -->
        <tr>
          <td style="background-color:#000000;padding:0;text-align:center;">
            <img
              src="${assetBase}/brand/lubnel-band.jpg"
              width="600"
              alt="LUBNÉL"
              style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"
            />
            <div style="padding:2px 0 24px;font-family:Tahoma,Arial,sans-serif;font-size:11px;letter-spacing:4px;color:rgba(255,255,255,0.72);text-transform:uppercase;">${c.heroWord}</div>
          </td>
        </tr>
        <!-- body -->
        <tr>
          <td dir="${c.dir}" align="${c.align}" style="padding:36px 32px 8px;font-family:Tahoma,Arial,'Segoe UI',sans-serif;color:${C.ink};">
            <h1 style="margin:0 0 18px;font-size:21px;line-height:1.5;color:${C.wine};">${subject}</h1>
            ${greet}
            <div style="font-size:15px;line-height:2;color:${C.ink};">${body}</div>
            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
              <tr>
                <td style="background-color:${C.wine};border-radius:999px;">
                  <a href="${STORE_URL}" style="display:inline-block;padding:14px 38px;font-family:Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:${C.white};text-decoration:none;border-radius:999px;background-color:${C.wine};">${c.cta}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- divider -->
        <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid ${C.line};margin:22px 0;" /></td></tr>
        <!-- footer -->
        <tr>
          <td dir="${c.dir}" align="center" style="padding:0 32px 30px;font-family:Tahoma,Arial,sans-serif;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:${C.muted};">${c.footerNote}</p>
            <p style="margin:0 0 6px;font-size:12px;color:${C.muted};">
              ${
                opts.unsubUrl
                  ? `<a href="${escapeHtml(opts.unsubUrl)}" style="color:${C.wine};font-weight:bold;text-decoration:none;">${c.unsubscribe}</a> — <a href="${STORE_WA_URL}" style="color:${C.muted};text-decoration:none;">${c.orWa}</a>`
                  : `<a href="${STORE_WA_URL}" style="color:${C.wine};font-weight:bold;text-decoration:none;">${c.unsubscribe}</a>`
              }
            </p>
            <p style="margin:0;font-size:11px;color:${C.muted};">
              ${c.tagline} — © LUBNÉL ${new Date().getFullYear()}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** The owner's ready-made professional template («تمبلت جاهز») — prefilled in
 *  the composer; she edits subject/body freely before sending. */
export const READY_TEMPLATE_AR = {
  subject: 'جديد لوبنيل 🌸 خصم خاص لمشتركات النشرة',
  message: `أهلًا بحبكِ في عالم لوبنيل 🌸

وصلت قطع جديدة من مكياج وعناية وعطور أصلية 100% — مختارة قطعة قطعة علشان كل تفصيلة تستاهلي الأحسن.

🎁 خصم خاص لمشتركات النشرة: استخدمي كود CLUB10 واحصلي على خصم 10% على أول طلب.

📦 توصيل لكل محافظات مصر خلال 2–5 أيام عمل، ومجاني للطلبات فوق 900 ج.م.

الكمية محدودة — ابدئي من زر «تسوقي الآن» تحت 👇`,
} as const;

export const READY_TEMPLATE_EN = {
  subject: 'New at LUBNÉL 🌸 A special treat for our subscribers',
  message: `Welcome to the LUBNÉL letter 🌸

Fresh arrivals just landed — original makeup, skincare and fragrances, handpicked piece by piece because every detail matters.

🎁 Subscriber perk: use code CLUB10 for 10% off your first order.

📦 Nationwide delivery in 2–5 business days — free over 900 EGP.

Limited stock — tap “Shop now” below 👇`,
} as const;
