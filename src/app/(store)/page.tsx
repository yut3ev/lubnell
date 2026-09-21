import { db } from '@/lib/db';
import type { Metadata } from 'next';
import { HeroSlider } from '@/components/store/hero-slider';
import { HomeSections } from '@/components/store/home-sections';
import { OffersSection } from '@/components/store/offers-section';
import { CatalogSection } from '@/components/store/catalog-section';
import { ReviewsSection } from '@/components/store/reviews-section';
import { NewsletterSection } from '@/components/store/newsletter-section';
import { resolveSectionTexts } from '@/lib/section-texts';
import { resolveHomeSections } from '@/lib/home-sections-config';
import { siteUrl } from '@/lib/site-url'; // U61-JSONLD

export const dynamic = 'force-dynamic';

// SEC-AUDIT-6 — self-canonical on the homepage segment ONLY (never on the
// root layout: a root-level canonical would be inherited by pages that don't
// set one, e.g. /cart, and wrongly point them at the homepage).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function Home() {
  const base = siteUrl();
  const [categories, products, reviews, sectionRows, homeSectionRows, reviewStats, heroSlideRows] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.product.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { createdAt: 'asc' }],
    }),
    db.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: 'desc' },
      // U23-REVIEWS-SWIPE — the carousel costs no vertical height, so let
      // more real customer reviews flow in as they accumulate
      take: 12,
    }),
    // SUP-9 — Studio → «أقسام الموقع» copy; a missing row falls back to defaults
    db.storeSettings.findMany({ where: { key: 'sections' } }).catch(() => []),
    // U17-HOME-EDITOR — Studio → «الصفحة الرئيسية» → أقسام الصفحة (visibility + templates)
    db.storeSettings.findMany({ where: { key: 'home_sections' } }).catch(() => []),
    // U18-REVIEWS — real per-product aggregates so card ratings are honest
    db.review
      .groupBy({
        by: ['productId'],
        where: { approved: true },
        _avg: { rating: true },
        _count: { _all: true },
      })
      .catch(() => []),
    // U60-CACHE-FLASH — hero slides render SERVER-SIDE now: the first paint is
    // the owner's CURRENT slides, so visitors never see the hardcoded fallback
    // hero flash for a second before the old client fetch swapped it in.
    db.heroSlide
      .findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } })
      .catch(() => []),
  ]);

  let storedSections: unknown = {};
  try {
    storedSections = JSON.parse(sectionRows[0]?.value ?? '{}');
  } catch {
    storedSections = {};
  }
  const sectionTexts = resolveSectionTexts(storedSections);

  // U22 — newsletter copy from Studio → النصوص والفوتر (نص النشرة البريدية)
  let newsletterCopy: { ar?: string; en?: string } = {};
  // U61-JSONLD — real social profiles for the Organization sameAs block
  const socialUrls: string[] = [];
  try {
    const textRows = await db.storeSettings.findMany({ where: { key: 'texts' } });
    const t = JSON.parse(textRows[0]?.value ?? '{}') as Record<string, unknown>;
    if (typeof t.newsletterAr === 'string' && t.newsletterAr.trim()) newsletterCopy.ar = t.newsletterAr.trim();
    if (typeof t.newsletterEn === 'string' && t.newsletterEn.trim()) newsletterCopy.en = t.newsletterEn.trim();
    for (const key of ['instagramUrl', 'facebookUrl', 'tiktokUrl', 'whatsappChannelUrl']) {
      const v = t[key];
      if (typeof v === 'string' && v.trim()) socialUrls.push(v.trim());
    }
  } catch {
    // defaults stay in the component
  }

  // U17-HOME-EDITOR — hideable/templatable homepage sections
  let homeCfgRaw: unknown = {};
  try {
    homeCfgRaw = JSON.parse(homeSectionRows[0]?.value ?? '{}');
  } catch {
    homeCfgRaw = {};
  }
  const homeCfg = resolveHomeSections(homeCfgRaw);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const productBySlug = new Map(products.map((p) => [p.slug, p]));
  // U18-REVIEWS — real aggregates by slug (Review.productId stores the slug)
  const statsBySlug = new Map(
    reviewStats.map((r) => [
      r.productId,
      {
        count: r._count._all,
        avg: r._avg.rating != null ? Math.round(r._avg.rating * 10) / 10 : 0,
      },
    ])
  );

  const mapProduct = (p: (typeof products)[number]) => {
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

  // U60-CACHE-FLASH — same mapping the old client fetch used; empty DB → the
  // component keeps its shipped fallback slides.
  const heroSlides = heroSlideRows.map((s) => ({
    id: String(s.id),
    image: String(s.image),
    imageMobile: s.imageMobile || undefined,
    video: s.video || undefined,
    eyebrowAr: s.eyebrow || 'LUBNÉL',
    eyebrowEn: s.eyebrow || 'LUBNÉL',
    titleAr: s.titleAr || '',
    titleEn: s.titleEn || '',
    bodyAr: s.bodyAr || '',
    bodyEn: s.bodyEn || '',
    ctaAr: s.ctaAr || 'تسوقي الآن',
    ctaEn: s.ctaEn || 'Shop now',
    href: s.href || '/',
  }));

  return (
    <div className="flex flex-col">
      {/* U61-JSONLD — Organization (brand entity + social profiles) and WebSite
          (sitelinks SearchAction → /search?q=) structured data for the homepage. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': `${base}/#org`,
                name: 'LUBNÉL',
                alternateName: 'لوبنيل',
                url: base,
                logo: `${base}/brand/logo-dark.png`,
                ...(socialUrls.length ? { sameAs: socialUrls } : {}),
              },
              {
                '@type': 'WebSite',
                '@id': `${base}/#site`,
                url: base,
                name: 'LUBNÉL — لوبنيل',
                inLanguage: 'ar',
                publisher: { '@id': `${base}/#org` },
                potentialAction: {
                  '@type': 'SearchAction',
                  target: { '@type': 'EntryPoint', urlTemplate: `${base}/search?q={search_term_string}` },
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      {homeCfg.hero.visible && (
        <HeroSlider template={homeCfg.hero.template} layout={homeCfg.hero} initialSlides={heroSlides} />
      )}
      {/* U10-MIDNIGHT — her approved homepage (screenshot: brave_nA0QaJ79Nn.jpg)
          shows «عروض اليوم» DIRECTLY under the hero — the offers section leads
          the page; trust/categories/best-sellers follow below. */}
      {homeCfg.offers.visible && (
      <OffersSection
        template={homeCfg.offers.template}
        products={products
          .filter((p) => p.compareAt && p.compareAt > p.price)
          .map(mapProduct)}
      />
      )}
      <HomeSections
        texts={sectionTexts}
        layout={{
          categories: homeCfg.categories,
          featured: homeCfg.featured,
          whatsapp: homeCfg.whatsapp,
        }}
        categories={categories.map((c) => ({
          slug: c.slug,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          description: c.description,
          image: c.image,
        }))}
        // U23-FEATURED-SWIPE — the mobile rail costs zero vertical height, so
        // more best-sellers flow in (was 8 in a tall 2-col grid)
        featured={products.filter((p) => p.featured).slice(0, 12).map(mapProduct)}
      />
      {homeCfg.arrivals.visible && (
      <CatalogSection
        template={homeCfg.arrivals.template}
        categories={categories.map((c) => ({
          slug: c.slug,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
        }))}
        products={products.map((p) => ({
          ...mapProduct(p),
          categorySlug: catById.get(p.categoryId)?.slug ?? 'all',
        }))}
      />
      )}
      {reviews.length > 0 && (
        <ReviewsSection
          reviews={reviews.map((r) => {
            const product = productBySlug.get(r.productId);
            return {
              id: r.id,
              name: r.name,
              text: r.text,
              rating: r.rating,
              productNameAr: product?.nameAr ?? null,
              productNameEn: product?.nameEn ?? null,
            };
          })}
        />
      )}
      <NewsletterSection copy={newsletterCopy} />
    </div>
  );
}
