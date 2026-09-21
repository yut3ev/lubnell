// Admin review moderation: list + approve/unpublish/delete
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { emitLive } from "@/lib/live";
import { syncProductReviewStats } from "@/lib/review-aggregates";

export const dynamic = "force-dynamic";

export type AdminReviewRecord = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  name: string;
  text: string;
  rating: number;
  image: string | null;
  approved: boolean;
  featured: boolean;
  helpfulCount: number;
  createdAt: string;
};

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "products.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  const { searchParams } = new URL(req.url);

  // Cheap stats-only mode for the sidebar pending badge
  if (searchParams.get("stats")) {
    const [pending, published] = await Promise.all([
      db.review.count({ where: { approved: false } }),
      db.review.count({ where: { approved: true } }),
    ]);
    return jsonOk({ stats: { pending, published, total: pending + published } });
  }

  const reviews = await db.review.findMany({ orderBy: [{ approved: "asc" }, { createdAt: "desc" }], take: 300 });
  const slugs = Array.from(new Set(reviews.map(r => r.productId)));
  const products = await db.product.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, nameAr: true, nameEn: true, image: true, gallery: true },
  });
  const firstImage = (p: { image: string; gallery: string | null }): string | null => {
    try {
      const arr = JSON.parse(p.gallery || "[]");
      if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
    } catch { /* ignore */ }
    return p.image || null;
  };
  const bySlug = new Map(products.map(p => [p.slug, p]));
  const mapped: AdminReviewRecord[] = reviews.map(r => {
    const product = bySlug.get(r.productId);
    return {
      id: r.id,
      productId: r.productId,
      productTitle: product?.nameAr || product?.nameEn || r.productId,
      productImage: product ? firstImage(product) : null,
      name: r.name,
      text: r.text,
      rating: r.rating,
      image: r.image,
      approved: r.approved,
      featured: r.featured,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt.toISOString(),
    };
  });
  const stats = {
    pending: reviews.filter(r => !r.approved).length,
    published: reviews.filter(r => r.approved).length,
    total: reviews.length,
  };
  return jsonOk({ reviews: mapped, stats });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "products.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  const { id, action } = await parseBody<{ id?: string; action?: string }>(req);
  if (!id || !["approve", "unpublish", "delete", "feature", "unfeature"].includes(action || "")) return jsonError("طلب غير صالح");

  const review = await db.review.findUnique({ where: { id } });
  if (!review) return jsonError("التقييم غير موجود", 404);

  if (action === "delete") {
    await db.review.delete({ where: { id } });
    await syncProductReviewStats(review.productId);
    await audit(ctx, "review.deleted", "review", id, { productId: review.productId, name: review.name });
    await emitLive("review:moderated", { action: "deleted", by: ctx.admin.displayName, productId: review.productId });
    return jsonOk({ success: true, deleted: true });
  }

  if (action === "feature" || action === "unfeature") {
    // Featuring implies approval; unfeature keeps the review published, just unpinned
    const featured = action === "feature";
    const updated = await db.review.update({ where: { id }, data: { featured, ...(featured ? { approved: true } : {}) } });
    await syncProductReviewStats(review.productId);
    await audit(ctx, featured ? "review.featured" : "review.unfeatured", "review", id, {
      productId: review.productId,
      name: review.name,
      rating: review.rating,
    });
    await emitLive("review:moderated", { action: featured ? "featured" : "unfeatured", by: ctx.admin.displayName, productId: review.productId });
    return jsonOk({ success: true, review: updated });
  }

  const approved = action === "approve";
  const updated = await db.review.update({ where: { id }, data: { approved, ...(approved ? {} : { featured: false }) } });
  await syncProductReviewStats(review.productId);
  await audit(ctx, approved ? "review.approved" : "review.unpublished", "review", id, {
    productId: review.productId,
    name: review.name,
    rating: review.rating,
  });
  await emitLive("review:moderated", { action: approved ? "approved" : "unpublished", by: ctx.admin.displayName, productId: review.productId });
  return jsonOk({ success: true, review: updated });
}
