'use client';

// U61-BLOG — client parts of the storefront journal: the blog list grid
// (lang-aware labels + AR/EN excerpt pick) and the back-to-blog bar.
// Article content itself is server-rendered; only lang-dependent chrome
// lives here (same split as the info pages).

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarDays, ChevronLeft } from 'lucide-react';
import { useT } from '@/lib/i18n';

export type BlogCard = {
  slug: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
  coverImage: string | null;
  publishedAt: string | null;
};

const fmtDay = (iso: string, ar: boolean) =>
  new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso));

export function BlogList({ posts }: { posts: BlogCard[] }) {
  const { t, ar } = useT();

  if (posts.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 px-6 py-14 text-center text-sm font-bold text-muted-foreground">
        {t.blogEmpty}
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">{t.blogAllSub}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => {
          const title = ar ? p.titleAr : p.titleEn?.trim() || p.titleAr;
          const excerpt = ar ? p.excerptAr : p.excerptEn?.trim() || p.excerptAr;
          return (
            <article
              key={p.slug}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <Link
                href={`/blog/${p.slug}`}
                className="relative block aspect-[16/10] overflow-hidden bg-secondary/50"
                aria-label={title}
              >
                {p.coverImage ? (
                  <Image
                    src={p.coverImage}
                    alt={title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-2xl font-black tracking-[0.2em] text-primary/40" aria-hidden>
                    LUBNÉL
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                {p.publishedAt && (
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground" dir={ar ? 'rtl' : 'ltr'}>
                    <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
                    {fmtDay(p.publishedAt, ar)}
                  </p>
                )}
                <h2 className="mt-1.5 text-base font-black leading-snug sm:text-lg">
                  <Link href={`/blog/${p.slug}`} className="transition-colors hover:text-primary">
                    {title}
                  </Link>
                </h2>
                {excerpt && (
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{excerpt}</p>
                )}
                <Link
                  href={`/blog/${p.slug}`}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-primary/80 sm:mt-auto sm:min-h-0 sm:self-start"
                >
                  {t.blogReadMore}
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function BlogBack() {
  const { t } = useT();
  return (
    <Link
      href="/blog"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border/60 bg-card px-5 py-2.5 text-sm font-bold transition-colors hover:border-primary/40 hover:text-primary"
    >
      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
      {t.blogBack}
    </Link>
  );
}
