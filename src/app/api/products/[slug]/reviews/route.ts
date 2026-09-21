import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emitLive } from '@/lib/live';
import { syncProductReviewStats } from '@/lib/review-aggregates';

export const dynamic = 'force-dynamic';

// Public PDP reviews endpoint — approved reviews for one product (by slug).
// Review.productId stores the product SLUG (same convention as the admin
// reviews route); `text` is exposed to clients as `comment`.
// U18-REVIEWS — reviews are REAL: POST publishes instantly (auto-approved)
// and re-syncs the product's aggregate rating/count so cards + JSON-LD stay
// honest. The photo URL comes pre-uploaded from /api/store/reviews/upload.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const product = await db.product.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!product) {
      return NextResponse.json(
        { ok: false, error: 'المنتج غير موجود' },
        { status: 404 }
      );
    }

    const where = { productId: slug, approved: true };
    const [agg, rows] = await Promise.all([
      db.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
      db.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, name: true, rating: true, text: true, image: true, createdAt: true },
      }),
    ]);

    const count = agg._count._all;
    const avg = count > 0 && agg._avg.rating != null
      ? Math.round(agg._avg.rating * 10) / 10
      : 0;

    return NextResponse.json({
      ok: true,
      summary: { avg, count },
      reviews: rows.map((r) => ({
        id: r.id,
        name: r.name,
        rating: r.rating,
        comment: r.text,
        image: r.image,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('[products/reviews]', err);
    return NextResponse.json(
      { ok: false, error: 'تعذر تحميل التقييمات' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      text?: unknown;
      comment?: unknown;
      rating?: unknown;
      image?: unknown;
    } | null;

    const name = String(body?.name ?? '').trim().slice(0, 80);
    const text = String(body?.text ?? body?.comment ?? '').trim().slice(0, 1200);
    const rating = Math.min(5, Math.max(1, Math.floor(Number(body?.rating) || 5)));
    const image =
      typeof body?.image === 'string' && body.image.startsWith('/') ? body.image : null;

    if (!name || !text) {
      return NextResponse.json(
        { ok: false, error: 'اكتبي اسمكِ وتجربتكِ أولًا' },
        { status: 400 }
      );
    }

    const product = await db.product.findUnique({
      where: { slug },
      select: { id: true, nameAr: true, nameEn: true, published: true },
    });
    if (!product || !product.published) {
      return NextResponse.json(
        { ok: false, error: 'المنتج غير موجود' },
        { status: 404 }
      );
    }

    // REAL reviews — published immediately, moderated afterwards from Studio
    // (Studio can unpublish/delete; the aggregates re-sync either way).
    const review = await db.review.create({
      data: { productId: slug, name, text, rating, image, approved: true },
    });
    const summary = await syncProductReviewStats(slug);

    await emitLive('review:new', {
      productTitle: product.nameAr || product.nameEn,
      rating,
      name,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      success: true,
      published: true,
      summary,
      review: {
        id: review.id,
        name: review.name,
        rating: review.rating,
        comment: review.text,
        image: review.image,
        createdAt: review.createdAt,
      },
    });
  } catch (err) {
    console.error('[products/reviews POST]', err);
    return NextResponse.json(
      { ok: false, error: 'تعذر حفظ التقييم' },
      { status: 500 }
    );
  }
}
