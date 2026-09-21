import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';
import { ProductDetail } from '@/components/store/product-detail';
import { EditorialCard } from '@/components/store/editorial-card';
import { ProductRelated } from '@/components/store/product-related';
import { FbtRow } from '@/components/store/fbt-row';

export const dynamic = 'force-dynamic';

// U14-SEO — per-product dynamic metadata: title, description, canonical,
// Open Graph (with the branded /p/[slug]/og card), and Product JSON-LD.
// U31-SEO-FIX — the origin is no longer derived from request headers: the
// edge forwards internal deploy hosts, which leaked into canonical/og:url/
// og:image/JSON-LD. Crawler-facing URLs now always carry the official
// production origin (see src/lib/site-url.ts).
async function getBase(): Promise<string> {
  return siteUrl();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug }, include: { category: true } });
  // U24-404 — a dead slug can render as a streamed soft-200 (dev/streaming
  // behavior: headers flush before notFound() resolves), so the metadata
  // carries the noindex — crawlers must never file a stale link as content.
  if (!product) {
    return { title: 'المنتج غير موجود | LUBNÉL', robots: { index: false, follow: true } };
  }
  if (!product.published) {
    // unpublished → the page below 404s; never let the full product meta leak
    return { title: 'المنتج غير متاح | LUBNÉL', robots: { index: false, follow: false } };
  }

  const base = await getBase();
  const title = `${product.nameAr} | LUBNÉL لوبنيل`;
  const description =
    product.description.slice(0, 155) ||
    `${product.nameAr} — ${product.category.nameAr} من لوبنيل. تغليف هدايا مجاني وتوصيل سريع.`;
  const url = `${base}/p/${product.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'LUBNÉL',
      type: 'website',
      images: [{ url: `${base}/p/${product.slug}/og`, width: 1200, height: 630, alt: product.nameAr }],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const base = await getBase();

  const product = await db.product.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!product || !product.published) notFound();

  // U18-REVIEWS — the rating/count shown on the PDP (and in JSON-LD) come
  // straight from the REAL approved reviews, not the stored columns.
  const reviewAgg = await db.review.aggregate({
    where: { productId: slug, approved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const realCount = reviewAgg._count._all;
  const realAvg =
    realCount > 0 && reviewAgg._avg.rating != null
      ? Math.round(reviewAgg._avg.rating * 10) / 10
      : 0;

  // U19-SETTINGS — orders WhatsApp number + delivery window from Studio
  let storeWhatsapp: string | undefined;
  let deliveryTime: string | undefined;
  try {
    const rows = await db.storeSettings.findMany({ where: { key: 'store' } });
    const val = JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
    if (typeof val.whatsappNumber === 'string' && val.whatsappNumber.trim()) {
      storeWhatsapp = val.whatsappNumber.trim();
    }
    if (typeof val.deliveryTime === 'string' && val.deliveryTime.trim()) {
      deliveryTime = val.deliveryTime.trim();
    }
  } catch {
    // shipped defaults
  }

  const related = await db.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, published: true },
    take: 4,
  });

  let gallery: string[] = [];
  try {
    gallery = product.gallery ? (JSON.parse(product.gallery) as string[]) : [];
  } catch {
    gallery = [];
  }
  let variants: { label: string; value: string }[] = [];
  try {
    variants = product.variants ? (JSON.parse(product.variants) as { label: string; value: string }[]) : [];
  } catch {
    variants = [];
  }

  const pdpProduct = {
    id: product.id,
    slug: product.slug,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    description: product.description,
    price: product.price,
    compareAt: product.compareAt,
    image: product.image,
    gallery,
    badgeAr: product.badgeAr,
    badgeEn: product.badgeEn,
    variants,
    stock: product.stock,
    rating: realAvg,
    reviews: realCount,
    categoryName: { ar: product.category.nameAr, en: product.category.nameEn, slug: product.category.slug },
  };

  // U14 — Product structured data (JSON-LD)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.nameAr,
    alternateName: product.nameEn,
    description: product.description.slice(0, 300),
    image: [`${base}${product.image}`],
    sku: product.slug,
    brand: { '@type': 'Brand', name: 'LUBNÉL' },
    category: product.category.nameAr,
    ...(realCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: realAvg,
            reviewCount: realCount,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url: `${base}/p/${product.slug}`,
      priceCurrency: 'EGP',
      price: product.price,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  // Related cards also show honest aggregates (single groupBy for the batch)
  const relatedSlugs = related.map((p) => p.slug);
  const relatedStats = relatedSlugs.length
    ? await db.review.groupBy({
        by: ['productId'],
        where: { productId: { in: relatedSlugs }, approved: true },
        _avg: { rating: true },
        _count: { _all: true },
      }).catch(() => [])
    : [];
  const statsBySlug = new Map(
    relatedStats.map((r) => [
      r.productId,
      {
        count: r._count._all,
        avg: r._avg.rating != null ? Math.round(r._avg.rating * 10) / 10 : 0,
      },
    ])
  );

  const toCard = (p: (typeof related)[number]) => {
    const s = statsBySlug.get(p.slug);
    return {
      id: p.id,
      slug: p.slug,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      price: p.price,
      compareAt: p.compareAt,
      image: p.image,
      rating: s && s.count > 0 ? s.avg : 0,
      reviews: s?.count ?? 0,
      stock: p.stock,
      badgeAr: p.badgeAr,
      badgeEn: p.badgeEn,
    };
  };

  return (
    <>
      <script
        type="application/ld+json"
        // SEC-AUDIT-4 — escape "<" so a product field containing "</script>"
        // can never break out of the ld+json block (stored-XSS hardening;
        // fields are admin-entered but defense-in-depth is free).
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <ProductDetail product={pdpProduct} whatsapp={storeWhatsapp} deliveryTime={deliveryTime} />

      {/* U14 — Frequently Bought Together (same-category companions) */}
      {related.length >= 2 && <FbtRow products={related.slice(0, 3).map(toCard)} />}

      {related.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
          {/* U18 — the owner's requested section title («قد يعجبك أيضًا») */}
          <ProductRelated headingAr="قد يعجبك أيضًا" headingEn="You may also like" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <EditorialCard key={p.id} product={toCard(p)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
