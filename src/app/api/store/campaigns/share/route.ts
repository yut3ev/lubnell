import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { clientIpFromHeaders } from "@/lib/client-ip";

// R30 — campaign share analytics: hero-slide shares (the /s/[id] affordance)
// land here so the studio's share pulse + "most shared" leaderboard can show
// campaign traction next to product shares. Events are stored as
// ShareEvent { productId: "hero:<slideId>" } — no schema change needed.
// Same 8s per-slide+IP throttle as the product share route.
const recentHits = new Map<string, number>();
const THROTTLE_MS = 8_000;
const CHANNELS = new Set(["native", "copy"]);
let lastSweep = 0;

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ slideId?: string; channel?: string }>(req);
    const slideId = String(body.slideId || "").trim();
    const channel = CHANNELS.has(String(body.channel || "")) ? String(body.channel) : "copy";
    if (!slideId) return jsonError("slideId مطلوب", 400);

    // U23-REALIP — real visitor IP (gateway rewrites x-forwarded-for to its own hop)
    const ip = clientIpFromHeaders(req.headers);
    const key = `${slideId}:${ip}`;
    const now = Date.now();
    const last = recentHits.get(key) || 0;
    if (now - last < THROTTLE_MS) {
      return jsonOk({ success: true, throttled: true });
    }
    recentHits.set(key, now);
    if (now - lastSweep > 60_000) {
      lastSweep = now;
      for (const [k, t] of recentHits) if (now - t > THROTTLE_MS * 4) recentHits.delete(k);
    }

    // Only count shares of slides that actually exist (active or not — a
    // paused campaign's historical shares stay reportable).
    const slide = await db.heroSlide.findUnique({ where: { id: slideId }, select: { id: true } });
    if (!slide) return jsonError("الشريحة غير موجودة", 404);

    await db.shareEvent.create({ data: { productId: `hero:${slideId}`, channel } });
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذّر تسجيل مشاركة الحملة", 500);
  }
}
