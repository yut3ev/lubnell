'use client';

// Reusable sort + filter toolbar + product grid (used by /search).
import { useMemo, useState, useEffect } from 'react';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { EditorialCard } from '@/components/store/editorial-card';
import { Reveal } from '@/components/store/reveal';
import type { ProductCardData } from '@/components/store/product-card';
import { useT } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'best';

export function CatalogToolbar({ products }: { products: ProductCardData[] }) {
  const { ar } = useT();
  const [sort, setSort] = useState<SortKey>('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);

  const filtered = useMemo(() => {
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Infinity;
    let list = products.filter(
      (p) =>
        p.price >= min &&
        p.price <= max &&
        (!inStockOnly || p.stock > 0) &&
        (!offersOnly || (p.compareAt && p.compareAt > p.price))
    );
    list = [...list];
    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
        break;
      case 'best':
        list.sort((a, b) => b.reviews - a.reviews || b.rating - a.rating);
        break;
      default:
        list.sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));
    }
    return list;
  }, [products, sort, minPrice, maxPrice, inStockOnly, offersOnly]);

  const hasFilters = minPrice !== '' || maxPrice !== '' || inStockOnly || offersOnly || sort !== 'featured';

  // ترقيم الصفحات — 12 منتجًا لكل صفحة
  const PAGE_SIZE = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [sort, minPrice, maxPrice, inStockOnly, offersOnly]);

  const pagedFiltered = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      const gridEl = document.getElementById('catalog-toolbar-grid');
      if (gridEl) {
        const top = gridEl.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
          {ar ? 'ترتيب وفلترة' : 'Sort & filter'}
        </p>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-10 w-[190px] rounded-full bg-background text-sm font-bold" aria-label={ar ? 'الترتيب' : 'Sort'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">{ar ? 'المميزة أولًا' : 'Featured'}</SelectItem>
            <SelectItem value="newest">{ar ? 'الأحدث' : 'Newest'}</SelectItem>
            <SelectItem value="price-asc">{ar ? 'السعر: من الأقل' : 'Price: low to high'}</SelectItem>
            <SelectItem value="price-desc">{ar ? 'السعر: من الأعلى' : 'Price: high to low'}</SelectItem>
            <SelectItem value="rating">{ar ? 'الأعلى تقييمًا' : 'Top rated'}</SelectItem>
            <SelectItem value="best">{ar ? 'الأكثر مبيعًا' : 'Best sellers'}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder={ar ? 'من' : 'Min'}
            aria-label={ar ? 'أقل سعر' : 'Min price'}
            className="h-10 w-24 rounded-full bg-background text-center text-sm"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={ar ? 'إلى' : 'Max'}
            aria-label={ar ? 'أعلى سعر' : 'Max price'}
            className="h-10 w-24 rounded-full bg-background text-center text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => setInStockOnly((v) => !v)}
          aria-pressed={inStockOnly}
          className={`h-10 rounded-full border px-4 text-xs font-bold transition-colors ${
            inStockOnly
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground/75 hover:border-primary/40 hover:text-primary'
          }`}
        >
          {ar ? 'المتوفر فقط' : 'In stock only'}
        </button>
        <button
          type="button"
          onClick={() => setOffersOnly((v) => !v)}
          aria-pressed={offersOnly}
          className={`h-10 rounded-full border px-4 text-xs font-bold transition-colors ${
            offersOnly
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground/75 hover:border-primary/40 hover:text-primary'
          }`}
        >
          {ar ? 'العروض والخصومات' : 'On sale'}
        </button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMinPrice('');
              setMaxPrice('');
              setInStockOnly(false);
              setOffersOnly(false);
              setSort('featured');
            }}
            className="mr-auto gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {ar ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      {/* U28 — editorial cards with a staggered entrance cascade and pagination */}
      <div id="catalog-toolbar-grid" className="scroll-mt-24">
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>
              {ar
                ? `عرض ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} من أصل ${filtered.length} منتج`
                : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} products`}
            </span>
            <span className="rounded-full bg-secondary/80 px-2.5 py-1 text-primary">
              {ar ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {pagedFiltered.map((p, i) => (
            <Reveal key={`${currentPage}-${p.id}`} delay={Math.min(i * 45, 250)}>
              <EditorialCard product={p} />
            </Reveal>
          ))}
        </div>

        {totalPages > 1 && (
          <nav
            role="navigation"
            aria-label={ar ? 'ترقيم الصفحات' : 'Pagination'}
            className="mt-10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
          >
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}
              className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-30 shadow-sm"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
              <span>{ar ? 'السابق' : 'Prev'}</span>
            </button>

            {getPageNumbers().map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="grid h-10 w-8 place-items-center text-xs font-bold text-muted-foreground select-none"
                  >
                    …
                  </span>
                );
              }
              const pageNum = item as number;
              const isAct = pageNum === currentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => handlePageChange(pageNum)}
                  aria-current={isAct ? 'page' : undefined}
                  aria-label={`${ar ? 'صفحة' : 'Page'} ${pageNum}`}
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-full text-xs font-extrabold transition-all duration-200 active:scale-95 shadow-sm',
                    isAct
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/20'
                      : 'border border-border bg-card text-foreground/80 hover:border-primary/50 hover:bg-secondary/40 hover:text-primary'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label={ar ? 'الصفحة التالية' : 'Next page'}
              className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-30 shadow-sm"
            >
              <span>{ar ? 'التالي' : 'Next'}</span>
              <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
