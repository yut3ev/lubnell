import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

// R47 — cross-sell attribution: the storefront fires this (fire-and-forget)
// whenever a visitor clicks an also-saved rail card. productId is the PDP the
// rail lived on, targetId the card that was clicked. Aggregate-only (no
// visitor data) — the studio wish board shows "from rail" pulls per product
// so the owner can see the rail actually pulling demand. Same light
// in-memory throttle as the wishlist route (per from+target+IP, 8s) keeps
// double-clicks from inflating the counts.
// R48 — an optional vid (anonymous localStorage uuid, no PII) rides along so
// a later order from the same visitor can stamp convertedAt on the pull.
const recentHits = new Map<string, number>();
const THROTTLE_MS = 8_000;
let lastSweep = 0;

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ from?: string; target?: string; vid?: string }>(req);
    const from = String(body.from || "").trim();
    const target = String(body.target || "").trim();
    // vid is a random client uuid — sanitize hard: trim, cap at 64 chars of
    // url-safe characters, anything else is dropped (aggregate value only).
    const vid = /^[A-Za-z0-9_-]{8,64}$/.test(String(body.vid || "").trim()) ? String(body.vid).trim() : "";
    if (!from || !target) return jsonError("from و target مطلوبان", 400);
    if (from === target) return jsonError("الهدف لا يمكن أن يكون نفسه", 400);

    const ok = await db.storeProduct.findMany({
      where: { slug: { in: [from, target] } },
      select: { slug: true },
    });
    const found = new Set(ok.map(r => r.slug));
    if (!found.has(from)) return jsonError("منتج غير معروف", 404);
    if (!found.has(target)) return jsonError("منتج غير معروف", 404);

    const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    const key = `${from}:${target}:${ip}`;
    const now = Date.now();
    const last = recentHits.get(key) || 0;
    if (now - last < THROTTLE_MS) return jsonOk({ success: true, throttled: true });
    recentHits.set(key, now);
    if (now - lastSweep > 60_000) {
      lastSweep = now;
      for (const [k, t] of recentHits) if (now - t > THROTTLE_MS * 4) recentHits.delete(k);
    }

    await db.railEvent.create({ data: { productId: from, targetId: target, vid } });
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذّر تسجيل النقرة", 500);
  }
}
