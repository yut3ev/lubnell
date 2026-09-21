// Legacy store reviews endpoint (kept for compatibility).
// U18-REVIEWS — rewritten against the REAL Prisma models: the old version
// queried db.storeProduct / db.reviewVote which don't exist in the schema, so
// every GET failed silently into an empty array. Reviews are now auto-published
// (real) on POST, with product aggregates re-synced.
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { emitLive } from "@/lib/live";
import { syncProductReviewStats } from "@/lib/review-aggregates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  // Featured testimonials for the home page (approved + pinned), joined with product info
  if (searchParams.get("featured")) {
    try {
      const [featured, products] = await Promise.all([
        db.review.findMany({ where: { approved: true, featured: true }, orderBy: { createdAt: "desc" }, take: 6 }),
        db.product.findMany({ where: { published: true }, select: { slug: true, nameAr: true, nameEn: true, image: true, gallery: true } }),
      ]);
      const bySlug = new Map(products.map(p => {
        let firstImage: string | null = null;
        try {
          const arr = JSON.parse(p.gallery || "[]");
          firstImage = Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : null;
        } catch { /* ignore */ }
        return [p.slug, { name: p.nameAr, nameEn: p.nameEn, image: firstImage ?? p.image }];
      }));
      return jsonOk(featured.map(r => ({
        id: r.id,
        productId: r.productId,
        name: r.name,
        text: r.text,
        rating: r.rating,
        image: r.image,
        createdAt: r.createdAt.toISOString(),
        productTitle: bySlug.get(r.productId)?.name || bySlug.get(r.productId)?.nameEn || "",
        productImage: bySlug.get(r.productId)?.image || null,
      })));
    } catch {
      return jsonOk([]);
    }
  }

  if (!productId) return jsonOk([]);
  try {
    const reviews = await db.review.findMany({
      where: { productId, approved: true },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
    });
    return jsonOk(reviews.map(r => ({
      id: r.id,
      productId: r.productId,
      name: r.name,
      text: r.text,
      rating: r.rating,
      image: r.image,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch {
    return jsonOk([]);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ productId?: string; name?: string; text?: string; rating?: number; image?: string }>(req);
    if (!body.productId) return jsonError("منتج غير محدد");
    if (!body.name?.trim() || !body.text?.trim()) return jsonError("اكتبي اسمكِ وتجربتكِ أولًا");
    const rating = Math.min(5, Math.max(1, Math.floor(Number(body.rating) || 5)));
    const review = await db.review.create({
      data: {
        productId: body.productId,
        name: body.name.trim().slice(0, 80),
        text: body.text.trim().slice(0, 1200),
        rating,
        image: body.image || null,
        approved: true, // U18 — real reviews publish instantly (moderatable from Studio)
      },
    });
    const summary = await syncProductReviewStats(body.productId);
    let productTitle = "";
    try {
      const product = await db.product.findUnique({ where: { slug: body.productId } });
      productTitle = product?.nameAr || product?.nameEn || "";
    } catch { /* non-fatal */ }
    await emitLive("review:new", { productTitle, rating, name: review.name }).catch(() => undefined);
    return jsonOk({ success: true, published: true, summary, review });
  } catch {
    return jsonError("تعذر حفظ التقييم", 500);
  }
}
