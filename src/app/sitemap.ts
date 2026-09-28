import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';

// U14-SEO — dynamic sitemap: static pages + all published products +
// categories + info pages. U31-SEO-FIX — every <loc> carries the official
// production origin (never localhost, never internal forwarded hosts).
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/c/all`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/info/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.6 }, // U61-BLOG
    { url: `${base}/info/shipping`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/info/returns`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.6 }, // GEO — canonical FAQ + FAQPage schema
  ];

  try {
    const [products, categories, posts] = await Promise.all([
      db.product.findMany({ where: { published: true }, select: { slug: true, createdAt: true } }),
      db.category.findMany({ select: { slug: true } }),
      // U61-BLOG — published journal articles
      db.post.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    ]);

    const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${base}/c/${c.slug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));

    return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...postRoutes];
  } catch {
    // DB unavailable — ship the static skeleton rather than a 500
    return staticRoutes;
  }
}
