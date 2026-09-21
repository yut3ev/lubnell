import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { clientIpFromHeaders } from "@/lib/client-ip";

// Share-count analytics: every explicit share action (WhatsApp / Facebook / X / copy link)
// bumps the product's shareCount. Light in-memory throttle (per slug+IP, 8s) keeps
// rapid double-clicks from inflating the number without needing a table.
const recentHits = new Map<string, number>();
const THROTTLE_MS = 8_000;
const CHANNELS = new Set(["wa", "fb", "x", "copy"]);
// Map can grow unbounded in theory — sweep expired entries opportunistically.
let lastSweep = 0;

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ slug?: string; channel?: string }>(req);
    const slug = String(body.slug || "").trim();
    const channel = CHANNELS.has(String(body.channel || "")) ? String(body.channel) : "copy";
    if (!slug) return jsonError("slug مطلوب", 400);

    // U23-REALIP — real visitor IP (gateway rewrites x-forwarded-for to its own hop)
    const ip = clientIpFromHeaders(req.headers);
    const key = `${slug}:${ip}`;
    const now = Date.now();
    const last = recentHits.get(key) || 0;
    if (now - last < THROTTLE_MS) {
      const product = await db.storeProduct.findUnique({ where: { slug }, select: { shareCount: true } });
      return jsonOk({ success: true, throttled: true, shareCount: product?.shareCount ?? 0 });
    }
    recentHits.set(key, now);
    if (now - lastSweep > 60_000) {
      lastSweep = now;
      for (const [k, t] of recentHits) if (now - t > THROTTLE_MS * 4) recentHits.delete(k);
    }

    const [updated] = await Promise.all([
      db.storeProduct.update({
        where: { slug },
        data: { shareCount: { increment: 1 } },
        select: { shareCount: true },
      }),
      // Time-series row for the admin 14-day sparkline + weekly deltas
      db.shareEvent.create({ data: { productId: slug, channel } }),
    ]);
    return jsonOk({ success: true, shareCount: updated.shareCount });
  } catch {
    return jsonError("تعذّر تسجيل المشاركة", 500);
  }
}
