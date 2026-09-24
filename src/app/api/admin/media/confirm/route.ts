// U83-PHASE4 — finalize a direct browser→R2 upload: verify the object really
// landed in the bucket, then record the MediaAsset row (data stays null — the
// bucket IS the store; serving happens through /api/uploads or the public URL).
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { r2Configured, r2Get, r2PublicUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

const WRITE_PERMS = ["media.write", "products.write", "categories.write", "homepage.write", "pages.write", "settings.write"];

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, WRITE_PERMS);
  if (!ctx) return jsonError("غير مصرح", 401);
  if (!r2Configured()) return jsonError("الرفع المباشر غير مفعّل", 501);
  try {
    const body = await parseBody<{
      key?: string;
      fileName?: string;
      mimeType?: string;
      altText?: string;
      crop?: string;
    }>(req);
    const key = String(body.key || "");
    if (!/^uploads\/[\w.-]+$/.test(key)) return jsonError("مفتاح غير صالح");

    const head = await r2Get(key);
    if (!head.ok) {
      return jsonError("لم يتم العثور على الملف في التخزين — أعد رفع الفيديو", 400);
    }
    const mimeType = String(body.mimeType || head.headers.get("content-type") || "application/octet-stream");
    const rawName = String(body.fileName || key.split("/").pop() || "file");
    const url = r2PublicUrl(key) ?? `/api/${key}`;

    const asset = await db.mediaAsset.create({
      data: {
        fileName: rawName,
        storageKey: key,
        url,
        mimeType,
        altText: String(body.altText || "") || rawName.replace(/\.[^/.]+$/, ""),
        crop: String(body.crop || "cover"),
        createdBy: ctx.admin.id,
        data: null,
      },
    });
    await audit(ctx, "media.uploaded.direct", "media_asset", String(asset.id), { fileName: rawName });
    const assetSafe = { ...asset, data: undefined };
    return jsonOk({ ok: true, success: true, url, asset: assetSafe });
  } catch {
    return jsonError("تعذر تسجيل الملف", 500);
  }
}
