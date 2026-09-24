// U83-PHASE4 — presigned direct browser→R2 upload for large media (Vercel's
// 4.5MB request-body limit makes server-side upload impossible for 80MB
// videos). The browser PUTs straight into the bucket using a short-lived
// signed URL; /api/admin/media/confirm then records the MediaAsset row.
import { jsonOk, jsonError, parseBody, requireAdmin } from "@/lib/api-helpers";
import { r2Configured, r2PresignPut } from "@/lib/r2";

export const dynamic = "force-dynamic";

const WRITE_PERMS = ["media.write", "products.write", "categories.write", "homepage.write", "pages.write", "settings.write"];

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, WRITE_PERMS);
  if (!ctx) return jsonError("غير مصرح", 401);
  if (!r2Configured()) return jsonError("الرفع المباشر غير مفعّل — لا توجد إعدادات R2", 501);
  try {
    const body = await parseBody<{ fileName?: string; contentType?: string }>(req);
    const rawName = String(body.fileName || "file").slice(0, 180);
    const contentType = String(body.contentType || "application/octet-stream");
    if (!/^(video|image)\//.test(contentType)) return jsonError("نوع الملف غير مدعوم (فيديو أو صورة فقط)");
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
    const key = `uploads/${Date.now()}-${safeName}`;
    const uploadUrl = await r2PresignPut(key, contentType);
    return jsonOk({ ok: true, uploadUrl, key, contentType });
  } catch {
    return jsonError("تعذر تجهيز الرفع المباشر", 500);
  }
}
