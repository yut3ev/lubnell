// U18-REVIEWS — keep Product.rating / Product.reviews columns in sync with
// the REAL approved reviews for that product (by slug — Review.productId
// stores the slug, same convention as the admin reviews route).
// Called after every review create/approve/unpublish/delete so the product
// cards, PDP header and Product JSON-LD always show honest numbers.
import { db } from '@/lib/db';

export async function syncProductReviewStats(slug: string): Promise<{ avg: number; count: number }> {
  try {
    const [agg, product] = await Promise.all([
      db.review.aggregate({
        where: { productId: slug, approved: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      db.product.findUnique({ where: { slug }, select: { id: true } }),
    ]);
    if (!product) return { avg: 0, count: 0 };
    const count = agg._count._all;
    const avg =
      count > 0 && agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : 0;
    await db.product.update({ where: { slug }, data: { rating: avg, reviews: count } });
    return { avg, count };
  } catch {
    // never block the review flow on stats sync
    return { avg: 0, count: 0 };
  }
}
