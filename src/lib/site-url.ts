// U31-SEO-FIX — single source of truth for the origin used by every
// crawler-facing URL (robots.txt, sitemap.xml, canonical/OG, Product JSON-LD).
//
// Why not request headers? In this deployment the edge forwards internal
// deploy hosts (e.g. *.fcapp.run) as host/x-forwarded-host — trusting them
// leaked internal URLs into canonical/og tags. Why not a localhost fallback?
// localhost in sitemap/robots/canonical breaks production indexing.
//
// NEXT_PUBLIC_SITE_URL stays the documented override; the default is the
// official production domain. Dev-only, internal localhost usage elsewhere
// is untouched.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://lubnel.vercel.app';

export function siteUrl(): string {
  return SITE_URL;
}
