import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

// U14-SEO — robots: crawl everything public, keep the studio out.
// (Replaces the stale public/robots.txt that previously caused a dev 500.)
// U31-SEO-FIX — sitemap now always carries the official production origin.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
