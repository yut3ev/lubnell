// ORDER-NOTIFY-2026-10 — branded order-confirmation email.
// The customer email is TRANSIENT (the Order model has no email column yet):
// checkout passes it per-order, this module sends once, nothing is stored.
// Status updates ride the Studio orders WhatsApp button (wa.me) until an
// email column migration is possible.
import { buildMailer } from "@/lib/mailer";
import { siteUrl } from "@/lib/site-url";

export type OrderEmailPayload = {
  orderNumber: string | null;
  customerName: string;
  city: string;
  subtotal: number;
  shipping: number;
  total: number;
  items: { nameAr: string; qty: number; price: number; variant?: string | null }[];
};

const money = (n: number) => `${Number(n).toLocaleString("en-US")} ج.م`;

export async function sendOrderConfirmationEmail(email: string, o: OrderEmailPayload): Promise<boolean> {
  const to = (email || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return false;
  try {
    const mailer = await buildMailer();
    if (!mailer) return false;

    const rows = o.items
      .map(
        (i) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee8e2;font-weight:bold">${i.nameAr}${i.variant ? ` <span style="color:#999;font-weight:normal">(${i.variant})</span>` : ""}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee8e2;text-align:center">× ${i.qty}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee8e2;text-align:left;white-space:nowrap">${money(i.price * i.qty)}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#faf6f1;font-family:Tahoma,Arial,sans-serif;color:#2b211d">
      <div style="max-width:560px;margin:0 auto;padding:24px 16px">
        <div style="background:#7a2e3b;border-radius:16px 16px 0 0;padding:18px;text-align:center">
          <span style="color:#fdfcfa;font-size:22px;font-weight:bold;letter-spacing:3px">LUBNÉL</span>
        </div>
        <div style="background:#ffffff;border:1px solid #eee8e2;border-top:0;border-radius:0 0 16px 16px;padding:24px">
          <h1 style="margin:0 0 8px;font-size:18px;color:#7a2e3b">شكرًا لطلبكِ يا ${o.customerName} 🌸</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.7">
            استلمنا طلبكِ <strong dir="ltr">${o.orderNumber || ""}</strong> وبدأنا نجهزه فورًا.
            تقدري تتابعين حالته في أي وقت برقم الطلب ورقم موبايلكِ:
            <a href="${siteUrl()}/track" style="color:#7a2e3b;font-weight:bold">تتبعي طلبكِ</a>
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${rows}
          </table>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
            <tr><td style="padding:4px 0;color:#666">المجموع</td><td style="text-align:left">${money(o.subtotal)}</td></tr>
            <tr><td style="padding:4px 0;color:#666">الشحن</td><td style="text-align:left">${o.shipping === 0 ? "مجاني" : money(o.shipping)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;border-top:2px solid #7a2e3b">الإجمالي (الدفع عند الاستلام)</td><td style="text-align:left;font-weight:bold;color:#7a2e3b;border-top:2px solid #7a2e3b">${money(o.total)}</td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#666;line-height:1.7">التوصيل إلى ${o.city} خلال 2–5 أيام عمل. لو في أي استفسار راسلينا واتساب وسنكون سعداء بمساعدتكِ.</p>
        </div>
        <p style="text-align:center;font-size:11px;color:#b3a89f;margin-top:12px">LUBNÉL — جمالٌ يُهدى بكل حب</p>
      </div>
    </body></html>`;

    const text = `شكرًا لطلبكِ ${o.customerName} — طلبكِ ${o.orderNumber || ""} قيد التجهيز. الإجمالي ${money(o.total)} (الدفع عند الاستلام). تتبعي طلبكِ: ${siteUrl()}/track`;

    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `تأكيد طلبكِ ${o.orderNumber || ""} — LUBNÉL`,
      html,
      text,
      replyTo: mailer.senderEmail,
    });
    return true;
  } catch {
    return false; // never fail the order because the email failed
  }
}
