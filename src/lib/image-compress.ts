/* U76-AI-IMAGES — client-side image preparation for the AI chat.
 * Runs entirely in the browser (no server imports): every attached photo is
 * decoded with the browser's own EXIF-aware <img> path (so iPhone HEIC shots
 * and rotated photos come out upright), downscaled to ≤1280px and re-encoded
 * as JPEG — small enough for a fast upload on mobile data, yet sharp enough
 * for the vision model and for a storefront product card. */

export type PreparedImage = {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
};

const MAX_DIM = 1280;
const QUALITY = 0.82;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new Error('BAD_IMAGE'));
        return;
      }
      // keep the object URL alive until the canvas draw finishes; revoked below
      (img as HTMLImageElement & { _objectUrl?: string })._objectUrl = url;
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('BAD_IMAGE'));
    };
    img.src = url;
  });
}

/** Decode + downscale + re-encode one file. Throws Error('BAD_IMAGE') for
 * anything the browser can't decode (corrupt files, unsupported formats). */
export async function prepareImageFile(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('NOT_IMAGE');
  const img = await loadImageElement(file);
  const url = (img as HTMLImageElement & { _objectUrl?: string })._objectUrl;
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('BAD_IMAGE');
    ctx.fillStyle = '#ffffff'; // flatten transparency for JPEG (product photos)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || 'صورة',
      dataUrl,
      width: w,
      height: h,
      sizeKb: Math.round((dataUrl.length * 0.75) / 1024),
    };
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
