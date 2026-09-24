import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { db } from '@/lib/db';
import { queryProducts } from '@/lib/product-query';
import { FilterableProductGrid } from '@/components/store/catalog-filters';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'نتائج البحث — LUBNÉL',
  description: 'ابحثي في منتجات لوبنيل — مكياج، عناية بالبشرة والجسم، وعطور أصلية.',
  robots: { index: false },
};

// Popular search terms shown as quick suggestion chips.
const POPULAR_TERMS = ['مكياج', 'سيروم', 'هدية', 'عطر'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q || '').trim();

  const [categories, result] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    term
      ? queryProducts({ q: term })
      : Promise.resolve({ products: [], total: 0, page: 1, pageSize: 0 }),
  ]);

  const { products, total } = result;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black sm:text-3xl">
        {term ? (
          <>
            نتائج البحث عن: <span className="text-primary">«{term}»</span>
          </>
        ) : (
          'ابحثي في المتجر'
        )}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {term
          ? `${total} ${total === 1 ? 'نتيجة' : 'نتائج'} مطابقة`
          : 'استخدمي أيقونة البحث في الأعلى — أو جرّبي أحد الاقتراحات أدناه.'}
      </p>

      {term && products.length > 0 && (
        <FilterableProductGrid products={products} className="mt-4" />
      )}

      {term && products.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-secondary/30 px-6 py-14 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground/60" aria-hidden />
          <p className="max-w-md text-sm font-semibold text-foreground/80">
            لا توجد نتائج لـ «{term}» — جرّبي كلمة أخرى أو تصفّحي فئاتنا:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
              >
                {c.nameAr}
              </Link>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">أو جرّبي:</span>
            {POPULAR_TERMS.map((s) => (
              <Link
                key={s}
                href={`/search?q=${encodeURIComponent(s)}`}
                className="rounded-full bg-secondary px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!term && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {POPULAR_TERMS.map((s) => (
            <Link
              key={s}
              href={`/search?q=${encodeURIComponent(s)}`}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
            >
              {s}
            </Link>
          ))}
          {categories.slice(0, 4).map((c) => (
            <Link
              key={c.slug}
              href={`/c/${c.slug}`}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
            >
              {c.nameAr}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
