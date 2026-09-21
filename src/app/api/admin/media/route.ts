// Admin media library: GET list, POST multipart upload → public/uploads
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireAdmin, audit } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "media.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  // U20 — never select the `data` blob column here (heavy payloads).
  const assets = await db.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, fileName: true, storageKey: true, url: true, mimeType: true,
      altText: true, crop: true, createdBy: true, createdAt: true,
    },
  });
  return jsonOk({ ok: true, media: assets });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "media.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    await ensureUploadDir();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const altText = (form.get("altText") as string) || "";
    const crop = (form.get("crop") as string) || "cover";
    if (!file) return jsonError("لم يتم اختيار ملف");
    // U19-VIDEO — videos skip the sharp pipeline and are stored as-is (capped).
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) return jsonError("الملف يجب أن يكون صورة أو فيديو MP4");
    if (isVideo && file.size > 80_000_000) return jsonError("حجم الفيديو يجب أن يكون أقل من 80MB");
    if (!isVideo && file.size > 8_000_000) return jsonError("حجم الصورة يجب أن يكون أقل من 8MB");

    // U15 — WebP pipeline: every upload is recompressed (max 1600px, q82) so
    // storefront images load fast; also normalizes iPhone HEIC shots when
    // libheif is available. Falls back to the original bytes on any error.
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
    const base = safeName.replace(/\.[^/.]+$/, "");
    let fileName = `${Date.now()}-${safeName}`;
    let stored = buffer;
    let mimeType = file.type;
    if (isVideo) {
      // videos stored byte-for-byte (name already sanitized, extension kept)
    } else
    try {
      const webp = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      if (webp.length > 0 && webp.length < buffer.length * 1.1) {
        fileName = `${Date.now()}-${base}.webp`;
        stored = webp;
        mimeType = "image/webp";
      }
    } catch {
      // unsupported input (rare) → keep original bytes as-is
    }
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), stored);
    // U20 — new uploads get a DYNAMIC url (/api/uploads/…): the bytes are also
    // stored in the MediaAsset row and the serving route prefers the DB blob,
    // so no static-file snapshot / platform pinning can ever hide them again.
    const url = `/api/uploads/${fileName}`;

    const asset = await db.mediaAsset.create({
      data: {
        fileName: file.name,
        storageKey: `uploads/${fileName}`,
        url,
        mimeType,
        altText: altText || file.name.replace(/\.[^/.]+$/, ""),
        crop,
        createdBy: ctx.admin.id,
        data: stored,
      },
    });
    await audit(ctx, "media.uploaded", "media_asset", String(asset.id), { fileName: file.name, crop });
    // U15 — include ok:true: the studio UI checks data.ok; before this the
    // upload SUCCEEDED but the panel always showed «تعذر رفع الصورة».
    return jsonOk({ ok: true, success: true, url, asset });
  } catch (error) {
    console.error("media upload failed", error);
    return jsonError("تعذر رفع الصورة", 500);
  }
}

export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req, "media.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  const { searchParams } = new URL(req.url);
  // U20 — MediaAsset.id is a cuid STRING; Number() turned every id into NaN
  // and the delete always answered 400 («صورة غير محددة»).
  const id = (searchParams.get("id") || "").trim();
  if (!id) return jsonError("صورة غير محددة");
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (asset) {
    try {
      const filePath = path.join(process.cwd(), "public", asset.storageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore unlink errors */ }
    await db.mediaAsset.delete({ where: { id } });
  }
  return jsonOk({ success: true });
}
