'use client';

import { useMemo, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { EditorialCard } from '@/components/store/editorial-card';
import { ProductTrack } from '@/components/store/product-track';
import { Reveal } from '@/components/store/reveal';
import type { ProductCardData } from '@/components/store/product-card';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface CatalogProduct extends ProductCardData {
  categorySlug: string;
}

interface CatalogCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
}

export function CatalogSection({
  categories,
  products,
  template = 'grid',
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  /** U17-HOME-EDITOR — 'grid' (filters + grid) or 'rail' (horizontal scroll of the newest) */
  template?: 'grid' | 'rail';
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

  // rail template — the newest products in a horizontal snap rail, no filters
  // (U28 — same editorial card + widths as the offers rail, one language)
  if (template === 'rail') {
    return (
      <section id="catalog" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-12">
        <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{t.allProducts}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.catalogSub}</p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {products.length} {t.products}
          </p>
        </div>
        </Reveal>
        <Reveal delay={80} className="mt-6 sm:mt-8">
        <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.slice(0, 10).map((p) => (
            <div key={p.id} className="w-[calc(100%-3.5rem)] max-w-[320px] shrink-0 snap-start sm:w-[42%] sm:max-w-none lg:w-[31%]">
              <EditorialCard product={p} />
            </div>
          ))}
        </div>
        </Reveal>
      </section>
    );
  }

  return (
    <section id="catalog" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-12">
      <Reveal>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{t.allProducts}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.catalogSub}</p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {visible.length} {t.products}
        </p>
      </div>
      </Reveal>

      {/* category filter tabs */}
      <Reveal delay={60}>
      <div
        role="tablist"
        aria-label={t.shopByCat}
        className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1 sm:mt-8"
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
                : 'border-border/70 bg-card text-foreground/75 hover:border-primary/40 hover:text-primary'
            )}
          >
            {ar ? tab.nameAr : tab.nameEn}
            <span
              className={cn(
                'grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold',
                active === tab.slug ? 'bg-primary-foreground/20' : 'bg-secondary text-muted-foreground'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      </Reveal>

      {/* products — U23-CATALOG-RAIL: mobile snap rail (the owner: «المستخدم
          مش هيقعد يعمل اسكرول لحت») instead of ~10 rows of 2-col grid;
          md+ keeps the 3/4-col grid. U28 — key={active} remounts the track
          on every filter-tab switch so the editorial cards replay their
          staggered reveal: flipping categories feels alive, not abrupt. */}
      {visible.length > 0 ? (
        <ProductTrack key={active} products={visible} ariaLabel={t.allProducts} className="mt-6 sm:mt-8" />
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-14 text-center sm:mt-8">
          <PackageSearch className="h-10 w-10 text-muted-foreground/60" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">{t.noProducts}</p>
        </div>
      )}
    </section>
  );
}
