import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { InfoHeader } from '@/components/store/info-panels';
import { BlogList, type BlogCard } from '@/components/store/blog-client';

export const dynamic = 'force-dynamic';

// U61-BLOG — the store journal index: /blog lists every PUBLISHED post,
// newest first. Metadata carries the brand definition keywords (لوبنيل +
// Lubnel) so the section itself is a landing page for informational queries.

export const metadata: Metadata = {
  title: 'مدونة لوبنيل | نصايح الجمال والعناية والعطور | LUBNÉL',
  description:
    'مدونة لوبنيل (Lubnel) — مقالات ونصايح من متجر إلكتروني مصري لبيع مستحضرات التجميل والعناية والعطور الأصلية: روتين البشرة، اختيار العطر، أفكار هدايا وأكثر.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'مدونة لوبنيل | LUBNÉL Journal',
    description: 'نصايح ومقالات من لوبنيل في العناية والجمال والعطور.',
    url: '/blog',
    siteName: 'LUBNÉL',
    type: 'website',
  },
};

export default async function BlogIndexPage() {
  const posts = await db.post
    .findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' } })
    .catch(() => []);

  const cards: BlogCard[] = posts.map((p) => ({
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn,
    excerptAr: p.excerptAr || p.contentAr.split('\n')[0]?.slice(0, 180) || '',
    excerptEn: p.excerptEn,
    coverImage: p.coverImage,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <InfoHeader titleAr="مدونة لوبنيل" titleEn="The LUBNÉL Journal" />
      <div className="mt-9">
        <BlogList posts={cards} />
      </div>
    </div>
  );
}
