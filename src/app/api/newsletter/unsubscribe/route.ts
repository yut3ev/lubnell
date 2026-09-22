// U73-WELCOME-UNSUBSCRIBE — real one-click unsubscribe for the newsletter.
// - GET  → human flow: validates the per-address token, deletes the row and
//          renders a small branded confirmation page.
// - POST → the List-Unsubscribe=One-Click flow Gmail/Yahoo fire (no cookies,
//          query params only) — same deletion, plain response.
// Token = deterministic sha256(email|salt) (see lib/mailer) so the endpoint
// can't be abused to unsubscribe arbitrary addresses.
import { db } from "@/lib/db";
import { unsubToken } from "@/lib/mailer";
import { STORE_URL } from "@/lib/newsletter-template";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolve(req: Request): Promise<{ ok: true; email: string } | { ok: false }> {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const token = (searchParams.get("t") || "").trim();
  if (!EMAIL_RE.test(email) || !token || token !== unsubToken(email)) return { ok: false };
  return { ok: true, email };
}

function page(email: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>إلغاء الاشتراك — LUBNÉL</title></head>
<body style="margin:0;padding:24px 12px;background-color:#FAF3F0;font-family:Tahoma,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #EBDCD8;border-radius:24px;overflow:hidden;text-align:center;">
    <div style="background-color:#8E3D43;padding:28px 24px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:7px;color:#FFFFFF;font-weight:bold;">LUBNÉL</div>
    </div>
    <div style="padding:32px 24px;color:#3D2B2D;">
      <p style="margin:0 0 10px;font-size:19px;font-weight:bold;color:#8E3D43;">تم إلغاء اشتراكك 🌸</p>
      <p style="margin:0 0 6px;font-size:14px;line-height:2;">البريد <span dir="ltr" style="font-weight:bold;">${email}</span> اتشال من قايمة النشرة البريدية.</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:2;color:#8A7678;">بنفتخر إنك كانتِ معانا — وترحيب بيكي تاني في أي وقت 💕</p>
      <a href="${STORE_URL}" style="display:inline-block;padding:13px 34px;background-color:#8E3D43;color:#FFFFFF;font-weight:bold;font-size:14px;text-decoration:none;border-radius:999px;">العودة للمتجر</a>
    </div>
  </div>
</body>
</html>`;
}

function fail(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>رابط غير صالح — LUBNÉL</title></head>
<body style="margin:0;padding:48px 16px;background:#FAF3F0;font-family:Tahoma,Arial,sans-serif;text-align:center;color:#3D2B2D;">
  <p style="font-size:16px;font-weight:bold;color:#8E3D43;">الرابط غير صالح أو منتهي</p>
  <p style="font-size:13px;color:#8A7678;">لو حابة تلغي اشتراكك، راسلينا على واتساب وهننجزه فورًا 🌸</p>
</body></html>`;
}

export async function GET(req: Request) {
  const r = await resolve(req);
  if (!r.ok) return new Response(fail(), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  await db.subscriber.deleteMany({ where: { email: r.email } }); // idempotent
  return new Response(page(r.email), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  const r = await resolve(req);
  if (!r.ok) return new Response("invalid", { status: 400 });
  await db.subscriber.deleteMany({ where: { email: r.email } });
  return new Response("unsubscribed", { status: 200 });
}
