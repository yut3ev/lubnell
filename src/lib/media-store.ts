// U76-AI-IMAGES — shared server-side image storage (single WebP pipeline).
// Extracted from /api/admin/media so the AI agent can store the images the
// owner attaches in chat through the EXACT same path (max 1600px, q82 WebP,
// file in public/uploads + MediaAsset row with the bytes as DB fallback).
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export type StoredImage = {
  fileName: string;
  url: string;
  storageKey: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
};

function safeBaseName(input: string) {
  const base = input
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 80);
  return base || "image";
}

/** Store an image buffer through the U15 WebP pipeline. Falls back to the
 * original bytes when sharp can't process the input (rare) or when the WebP
 * result would be larger than the source. */
export async function storeImageBuffer(
  buffer: Buffer,
  baseName: string
): Promise<StoredImage> {
  ensureUploadDir();
  const base = safeBaseName(baseName);
  let fileName = `${Date.now()}-${base}.img`;
  let stored = buffer;
  let mimeType = "application/octet-stream";

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

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(stored).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    /* keep nulls */
  }

  return {
    fileName,
    url: `/api/uploads/${fileName}`,
    storageKey: `uploads/${fileName}`,
    mimeType,
    size: stored.length,
    width,
    height,
  };
}

/** Parse a `data:image/…;base64,…` URL (the AI chat transport format) into
 * bytes + mime. Returns null for anything that isn't a sane image data URL. */
export function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif|bmp|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl.trim()
  );
  if (!match) return null;
  try {
    const buffer = Buffer.from(match[2], "base64");
    // < 1KB is almost certainly a broken/blank payload; > 10MB is abuse.
    if (buffer.length < 1024 || buffer.length > 10_000_000) return null;
    return { buffer, mime: match[1] };
  } catch {
    return null;
  }
}

/** Store a data-URL image and register it in the media library. Returns the
 * served URL (or null when the payload is unusable). */
export async function storeDataUrlImage(
  dataUrl: string,
  baseName: string,
  createdBy?: string
): Promise<StoredImage | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const stored = await storeImageBuffer(parsed.buffer, baseName);
  await db.mediaAsset
    .create({
      data: {
        fileName: `${baseName}${stored.fileName.includes(".webp") ? ".webp" : ""}`,
        storageKey: stored.storageKey,
        url: stored.url,
        mimeType: stored.mimeType,
        altText: baseName,
        crop: "cover",
        createdBy: createdBy ?? null,
        data: fs.readFileSync(path.join(UPLOAD_DIR, stored.fileName)),
      },
    })
    .catch(() => undefined); // library row is a convenience — never block the flow
  return stored;
}
