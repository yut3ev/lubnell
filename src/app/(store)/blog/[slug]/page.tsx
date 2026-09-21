import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { db } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';
import { InfoHeader, InfoProse } from '@/components/store/info-panels';
import { ProductRelated } from '@/components/store/product-related';
import { EditorialCard } from '@/components/store/editorial-card';
import { BlogBack } from '@/components/store/blog-client';

export const dynamic = 'force-dynamic';

// U61-BLOG — article page /blog/[slug]: server-rendered prose (InfoProse
// parses paragraphs + bullet/numbered lists from the plain text the owner
// writes), cover, up to 4 shoppable product cards (REAL review aggregates,
// same honesty rule as the PDP), related articles, and a BlogPosting
// JSON-LD block for Google.

const abs = (u: string, base: string) => (/^https?:\/\//i.test(u) ? u : `${base}${u}`);

async function getPost(slug: string) {
  return db.post.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post) {
    return { title: 'المقال غير موجود | LUBNÉL', robots: { index: false, follow: true } };
  }
  if (!post.published) {
    return { title: 'المقال غير متاح | LUBNÉL', robots: { index: false, follow: false } };
  }
  const base = siteUrl();
  const title = `${post.titleAr} | مدونة لوبنيل`;
  const description =
    post.excerptAr.trim() || post.contentAr.trim().split('\n')[0]?.slice(0, 155) || post.titleAr;
  const url = `${base}/blog/${post.slug}`;
  const ogImage = post.coverImage ? abs(post.coverImage, base) : `${base}/og-image.jpg`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'LUBNÉL',
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.titleAr }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !post.published) notFound();

  const base = siteUrl();

  // featured products: keep the owner's chosen order, published only, with
  // honest per-product review aggregates (Review.productId stores the slug)
  let picks: string[] = [];
  try {
    const parsed = JSON.parse(post.productSlugs || '[]');
    picks = Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    picks = [];
  }
  const products = picks.length
    ? await db.product.findMany({ where: { slug: { in: picks }, published: true } }).catch(() => [])
    : [];
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const ordered = picks.map((s) => bySlug.get(s)).filter((p): p is (typeof products)[number] => Boolean(p));
  const stats = ordered.length
    ? await db.review
        .groupBy({
          by: ['productId'],
          where: { productId: { in: ordered.map((p) => p.slug) }, approved: true },
          _avg: { rating: true },
          _count: { _all: true },
        })
        .catch(() => [])
    : [];
  const statsBySlug = new Map(
    stats.map((r) => [
      r.productId,
      { count: r._count._all, avg: r._avg.rating != null ? Math.round(r._avg.rating * 10) / 10 : 0 },
    ])
  );

  const related = await db.post
    .findMany({ where: { published: true, id: { not: post.id } }, orderBy: { publishedAt: 'desc' }, take: 3 })
    .catch(() => []);

  // U61 — BlogPosting structured data (rich results / article indexing)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.titleAr,
    alternativeHeadline: post.titleEn || undefined,
    description: post.excerptAr || post.titleAr,
    image: [abs(post.coverImage?.trim() || '/og-image.jpg', base)],
    datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    inLanguage: 'ar',
    author: { '@type': 'Organization', name: 'LUBNÉL', url: base },
    publisher: {
      '@type': 'Organization',
      name: 'LUBNÉL',
      logo: { '@type': 'ImageObject', url: `${base}/brand/logo-dark.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${base}/blog/${post.slug}` },
  };

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(d);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        // same stored-XSS hardening as the PDP block: escape "<"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <InfoHeader titleAr={post.titleAr} titleEn={post.titleEn} />

      <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
        <time dateTime={(post.publishedAt ?? post.createdAt).toISOString()}>
          {fmtDate(post.publishedAt ?? post.createdAt)}
        </time>
      </p>

      {post.coverImage?.trim() && (
        <figure className="mt-5 overflow-hidden rounded-3xl border border-border/60 shadow-sm">
          <Image
            src={post.coverImage}
            alt={post.titleAr}
            width={1200}
            height={630}
            sizes="(max-width: 640px) 100vw, 768px"
            className="h-auto w-full object-cover"
            priority
          />
        </figure>
      )}

      <div className="mt-8">
        <InfoProse ar={post.contentAr} en={post.contentEn || undefined} />
      </div>

      {ordered.length > 0 && (
        <section className="mt-12">
          <ProductRelated headingAr="منتجات من المقال" headingEn="Featured in this article" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {ordered.map((p) => {
              const s = statsBySlug.get(p.slug);
              return (
                <EditorialCard
                  key={p.id}
                  product={{
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
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <nav aria-label="مقالات ذات صلة" className="mt-12 grid gap-3 sm:grid-cols-3">
          {related.map((r) => (
            <Link
              key={r.id}
              href={`/blog/${r.slug}`}
              className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm font-bold transition-colors hover:border-primary/40 hover:text-primary"
            >
              <span className="line-clamp-2">{r.titleAr} · {r.titleEn || r.titleAr}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-12">
        <BlogBack />
      </div>
    </div>
  );
}
