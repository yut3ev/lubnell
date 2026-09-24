'use client';

import { useMemo, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { AiStylistBanner } from '@/components/store/ai-stylist-banner';
import { FilterableProductGrid } from '@/components/store/catalog-filters';
import { type ProductCardData } from '@/components/store/product-card';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface CatalogCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface CatalogPageProduct extends ProductCardData {
  categorySlug: string;
}

// U10-CATALOG-PAGE — the standalone «كل المنتجات» page from the owner's
// approved screenshots: AI stylist banner on top, heading + live count,
// category count-pills, then the filter toolbar + product grid.
export function CatalogPageView({
  categories,
  products,
}: {
  categories: CatalogCategory[];
  products: CatalogPageProduct[];
}) {
  const { ar, t } = useT();
  const [active, setActive] = useState<string>('all');

  const tabs = useMemo(
    () => [
      { slug: 'all', nameAr: t.allCat, nameEn: 'All', count: products.length },
      ...categories.map((c) => ({
        slug: c.slug,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        count: products.filter((p) => p.categorySlug === c.slug).length,
      })),
    ],
    [categories, products, t.allCat]
  );

  const visible = active === 'all' ? products : products.filter((p) => p.categorySlug === active);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <AiStylistBanner />

      {/* heading */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{t.allProducts}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.catalogSub}</p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {visible.length} {t.products}
        </p>
      </div>

      {/* category count-pills */}
      <div
        role="tablist"
        aria-label={t.shopByCat}
        className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.slug}
            role="tab"
            aria-selected={active === tab.slug}
            onClick={() => setActive(tab.slug)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-all duration-200',
              active === tab.slug
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-foreground/75 hover:border-primary/40 hover:text-primary'
            )}
          >
            {ar ? tab.nameAr : tab.nameEn}
            <span
              className={cn(
                'grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold',
                active === tab.slug ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-primary'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* toolbar + grid */}
      {visible.length > 0 ? (
        <FilterableProductGrid key={active} products={visible} className="mt-6" />
      ) : (
        <p className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <PackageSearch className="h-8 w-8 text-muted-foreground/60" aria-hidden />
          {t.noProducts}
        </p>
      )}
    </div>
  );
}
