import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

// R40 — wishlist demand tracking. Every explicit wishlist toggle (heart on
// cards / PDP / wishlist view) lands here as a WishEvent row so the admin
// analytics "most wishlisted" board can compare DESIRE (adds) against actual
// SALES (units sold). Adds are intent moments; removes are recorded too but
// the board counts adds only — a remove doesn't un-wish the fact that the
// visitor once wanted the product.
// Same light in-memory throttle as the share route (per slug+action+IP, 8s)
// keeps rapid double-toggles from inflating the board. Fire-and-forget on
// the client: failures are silently ignored, the wishlist never breaks.
const recentHits = new Map<string, number>();
const THROTTLE_MS = 8_000;
const ACTIONS = new Set(["add", "remove"]);
let lastSweep = 0;

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ slug?: string; action?: string }>(req);
    const slug = String(body.slug || "").trim();
    const action = ACTIONS.has(String(body.action || "")) ? String(body.action) : "add";
    if (!slug) return jsonError("slug مطلوب", 400);

    const exists = await db.storeProduct.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return jsonError("منتج غير معروف", 404);

    const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    const key = `${slug}:${action}:${ip}`;
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

    // R46 — the visitor IP rides along (feeds the PDP "visitors also saved"
    // co-occurrence cross-sell; aggregated only, never surfaced per IP).
    await db.wishEvent.create({ data: { productId: slug, action, ip } });
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذّر تسجيل الأمنية", 500);
  }
}
