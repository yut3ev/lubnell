// Admin media library: GET list, POST multipart upload → public/uploads
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import sharp from "sharp";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireAdmin, audit } from "@/lib/api-helpers";
import { r2Configured, r2Delete, r2Put, r2PublicUrl } from "@/lib/r2";

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
  // U79 — الرفع يخدم محررات المنتجات/الأقسام/الرئيسية/المدونة/الإعدادات:
  // مفتاح الكتابة الخاص بالقسم يفتح الرفع (عرض/حذف المكتبة يبقى media.read/media.write)
  const ctx = await requireAdmin(req, [
    "media.write",
    "products.write",
    "categories.write",
    "homepage.write",
    "pages.write",
    "settings.write",
  ]);
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

    // U15 — WebP pipeline: every IMAGE upload is recompressed (max 1600px, q82)
    // so storefront images load fast; also normalizes iPhone HEIC shots when
    // libheif is available. Falls back to the original bytes on any error.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
    const base = safeName.replace(/\.[^/.]+$/, "");
    let fileName = `${Date.now()}-${safeName}`;
    let stored: Buffer | null = null;
    let mimeType = file.type;
    const useR2 = r2Configured();
    if (useR2) {
      // U83 — R2 mode: ONE buffer copy → straight into the bucket; nothing on
      // the (ephemeral) server disk and nothing in the DB. Images keep their
      // WebP pass; videos store byte-for-byte.
      const buffer = Buffer.from(await file.arrayBuffer());
      stored = buffer;
      if (!isVideo) {
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
      }
      await r2Put(`uploads/${fileName}`, new Uint8Array(stored), mimeType, stored.length);
    } else if (isVideo) {
      // U81-VIDEO-STREAM — videos stream straight to disk: no arrayBuffer copy
      // and NO MediaAsset blob. The old path copied a 60-80MB file ~3× into
      // the heap AND wrote it whole into SQLite — the heap spike crashed the
      // dev server (OOM → the whole site went down), and every later view
      // re-loaded the entire blob from the DB. The serve route's disk path
      // already streams with Range support, so `data` stays null for videos.
      await pipeline(
        Readable.fromWeb(file.stream() as unknown as import("stream/web").ReadableStream),
        fs.createWriteStream(path.join(UPLOAD_DIR, fileName))
      );
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      stored = buffer;
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
    }
    // U75-IMAGE-MOBILE-PREVIEW — report the FINAL stored image's dimensions so
    // the studio can tell the owner immediately whether the photo is sharp
    // enough for mobile (product cards render aspect-square, so tiny/oddly
    // shaped uploads get heavily cropped/stretched).
    let width: number | null = null;
    let height: number | null = null;
    if (!isVideo) {
      try {
        const meta = await sharp(stored).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        /* keep nulls — badge simply won't show */
      }
    }
    // U20 — new uploads get a DYNAMIC url (/api/uploads/…): the bytes are also
    // stored in the MediaAsset row and the serving route prefers the DB blob,
    // so no static-file snapshot / platform pinning can ever hide them again.
    const url = r2PublicUrl(`uploads/${fileName}`) ?? `/api/uploads/${fileName}`;

    const asset = await db.mediaAsset.create({
      data: {
        fileName: file.name,
        storageKey: `uploads/${fileName}`,
        url,
        mimeType,
        altText: altText || file.name.replace(/\.[^/.]+$/, ""),
        crop,
        createdBy: ctx.admin.id,
        data: useR2 ? null : stored,
      },
    });
    await audit(ctx, "media.uploaded", "media_asset", String(asset.id), { fileName: file.name, crop });
    // U15 — include ok:true: the studio UI checks data.ok; before this the
    // upload SUCCEEDED but the panel always showed «تعذر رفع الصورة».
    // U81 — never echo the raw bytes back to the studio: an 8MB image
    // serialized as base64 made the upload response ~11MB (data stays in
    // the row only for images; videos keep data=null and serve from disk)
    const assetSafe = { ...asset, data: undefined };
    return jsonOk({ ok: true, success: true, url, asset: assetSafe, width, height });
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
    // U81 — reference guard: a file still used by the storefront must never
    // leave the disk (products image/gallery/variants, hero slides, and any
    // settings value — maintenance/brand/seo/pages). Cleanup deletes stay
    // safe: only true orphans are removed. `contains` on URLs is broader
    // than exact (LIKE wildcards), which fails SAFE here.
    const url = asset.url;
    const [settingsHit, productHit, slideHit] = await Promise.all([
      db.storeSettings.findFirst({ where: { value: { contains: url } }, select: { key: true } }),
      db.product.findFirst({
        where: { OR: [{ image: url }, { gallery: { contains: url } }, { variants: { contains: url } }] },
        select: { id: true },
      }),
      db.heroSlide.findFirst({
        where: { OR: [{ image: url }, { imageMobile: url }, { video: url }] },
        select: { id: true },
      }),
    ]);
    if (settingsHit || productHit || slideHit) {
      return jsonError("الملف لسه مستخدم في الموقع (منتج/سلايدر/إعدادات) — شيل المرجع الأول قبل المسح", 409);
    }
    if (r2Configured()) {
      await r2Delete(asset.storageKey).catch(() => undefined); // U83 — bucket copy
    }
    try {
      const filePath = path.join(process.cwd(), "public", asset.storageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore unlink errors */ }
    await db.mediaAsset.delete({ where: { id } });
  }
  return jsonOk({ success: true });
}
