// Storefront reviews endpoint
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { emitLive } from "@/lib/live";
import { syncProductReviewStats } from "@/lib/review-aggregates";
import { notifyReviewsChanged } from "@/lib/reviews-events";

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

  // Product reviews for specific product detail page
  if (productId) {
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

  // RW-WALL-2026-10: Storefront wall of customer reviews (approved only, newest first, max 24)
  try {
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 24));
    const reviews = await db.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const slugs = Array.from(new Set(reviews.map((r) => r.productId)));
    const products = await db.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, nameAr: true, nameEn: true },
    });
    const bySlug = new Map(products.map((p) => [p.slug, p.nameAr || p.nameEn || ""]));

    const items = reviews.map((r) => ({
      id: r.id,
      name: r.name,
      text: r.text,
      product: bySlug.get(r.productId) || "",
      verified: true,
      createdAt: r.createdAt.toISOString(),
    }));

    const etag = `W/"${items.map((i) => i.id).join("-")}:${items.length}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304 });
    }

    const response = jsonOk(items);
    response.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    response.headers.set("ETag", etag);
    return response;
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
    notifyReviewsChanged();
    return jsonOk({ success: true, published: true, summary, review });
  } catch {
    return jsonError("تعذر حفظ التقييم", 500);
  }
}
