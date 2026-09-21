'use client';

// Shared sort & filter toolbar for product listings.
// Used by: catalog-section (home) + category-grid (/c/[slug]) + /search grid.
// Pure client-side filtering of the already-fetched product arrays — instant,
// no extra fetches.

import { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/store/product-card';
import { ProductTrack } from '@/components/store/product-track';
import { useT } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type CatalogSortKey =
  | 'featured'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'best';

export interface CatalogFilterState {
  sort: CatalogSortKey;
  minPrice: string;
  maxPrice: string;
  inStockOnly: boolean;
  offersOnly: boolean;
}

export interface FilterableProduct {
  price: number;
  stock: number;
  compareAt?: number | null;
  rating?: number;
  reviews?: number;
  featured?: boolean;
  createdAt?: string | Date | null;
}

const NEW_IN_MS = 14 * 24 * 60 * 60 * 1000;

/** Pure client-side filter + sort over an already-loaded product array. */
export function applyProductFilters<T extends FilterableProduct>(
  products: T[],
  s: CatalogFilterState
): T[] {
  const min = Number(s.minPrice) || 0;
  const max = s.maxPrice === '' ? Infinity : Number(s.maxPrice) || Infinity;

  const list = products.filter(
    (p) =>
      p.price >= min &&
      p.price <= max &&
      (!s.inStockOnly || p.stock > 0) &&
      (!s.offersOnly || (!!p.compareAt && p.compareAt > p.price))
  );

  const createdMs = (p: FilterableProduct) =>
    p.createdAt ? new Date(p.createdAt).getTime() : 0;

  switch (s.sort) {
    case 'price-asc':
      return [...list].sort((a, b) => a.price - b.price);
    case 'price-desc':
      return [...list].sort((a, b) => b.price - a.price);
    case 'rating':
      return [...list].sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0)
      );
    case 'best':
      // no per-product sales data client-side — approximate with reviews
      return [...list].sort(
        (a, b) => (b.reviews ?? 0) - (a.reviews ?? 0) || (b.rating ?? 0) - (a.rating ?? 0)
      );
    case 'newest':
      return [...list].sort((a, b) => createdMs(b) - createdMs(a));
    case 'featured':
    default:
      // stable sort — preserves the server's base order inside groups
      return [...list].sort(
        (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false)
      );
  }
}

export const DEFAULT_FILTER_STATE: CatalogFilterState = {
  sort: 'featured',
  minPrice: '',
  maxPrice: '',
  inStockOnly: false,
  offersOnly: false,
};

const SORT_OPTIONS: { value: CatalogSortKey; ar: string; en: string }[] = [
  { value: 'featured', ar: 'المميزة أولًا', en: 'Featured' },
  { value: 'newest', ar: 'الأحدث', en: 'Newest' },
  { value: 'price-asc', ar: 'السعر: من الأقل', en: 'Price: low to high' },
  { value: 'price-desc', ar: 'السعر: من الأعلى', en: 'Price: high to low' },
  { value: 'rating', ar: 'الأعلى تقييمًا', en: 'Top rated' },
  { value: 'best', ar: 'الأكثر مبيعًا', en: 'Best sellers' },
];

// ---------------------------------------------------------------------------
// CatalogFilters — the toolbar itself. Receives the unfiltered array and
// reports the filtered/sorted array back through `onChange`.
// ---------------------------------------------------------------------------

export function CatalogFilters({
  products,
  onChange,
  className,
}: {
  products: ProductCardData[];
  onChange: (filtered: ProductCardData[]) => void;
  className?: string;
}) {
  const { ar, t } = useT();
  const [sort, setSort] = useState<CatalogSortKey>('featured');
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(
    () =>
      applyProductFilters(products, {
        sort,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        inStockOnly,
        offersOnly,
      }),
    [products, sort, priceRange, inStockOnly, offersOnly]
  );

  // report results upward without re-triggering ourselves (latest-ref pattern)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current(filtered);
  }, [filtered]);

  const hasFilters =
    sort !== 'featured' ||
    priceRange.min !== '' ||
    priceRange.max !== '' ||
    inStockOnly ||
    offersOnly;
  const activeCount =
    (sort !== 'featured' ? 1 : 0) +
    (priceRange.min !== '' || priceRange.max !== '' ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (offersOnly ? 1 : 0);

  function applyPrice() {
    setPriceRange({ min: draftMin, max: draftMax });
    setSheetOpen(false);
  }

  function reset() {
    setSort('featured');
    setDraftMin('');
    setDraftMax('');
    setPriceRange({ min: '', max: '' });
    setInStockOnly(false);
    setOffersOnly(false);
  }

  const controls = (
    <>
      <Select value={sort} onValueChange={(v) => setSort(v as CatalogSortKey)}>
        <SelectTrigger
          className="h-10 w-[190px] rounded-full bg-background text-sm font-bold"
          aria-label={ar ? 'الترتيب' : 'Sort'}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {ar ? o.ar : o.en}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={draftMin}
          onChange={(e) => setDraftMin(e.target.value)}
          placeholder={ar ? 'من' : 'Min'}
          aria-label={ar ? 'أقل سعر' : 'Min price'}
          className="h-10 w-20 rounded-full bg-background text-center text-sm"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={draftMax}
          onChange={(e) => setDraftMax(e.target.value)}
          placeholder={ar ? 'إلى' : 'Max'}
          aria-label={ar ? 'أعلى سعر' : 'Max price'}
          className="h-10 w-20 rounded-full bg-background text-center text-sm"
        />
        <Button
          type="button"
          size="sm"
          onClick={applyPrice}
          className="h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
        >
          {ar ? 'تطبيق' : 'Apply'}
        </Button>
      </div>

      <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-full border border-border bg-background px-4">
        <span className="text-xs font-bold text-foreground/80">
          {ar ? 'المتوفر فقط' : 'In stock only'}
        </span>
        <Switch
          checked={inStockOnly}
          onCheckedChange={setInStockOnly}
          aria-label={ar ? 'المتوفر فقط' : 'In stock only'}
        />
      </label>

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
          onClick={reset}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {ar ? 'مسح الفلاتر' : 'Reset'}
        </Button>
      )}
    </>
  );

  return (
    <div className={className}>
      {/* desktop toolbar */}
      <div className="hidden flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 md:flex">
        <p className="flex items-center gap-2 text-sm font-bold">
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
          {ar ? 'ترتيب وفلترة' : 'Sort & filter'}
        </p>
        {controls}
        <p className="mr-auto text-xs font-bold text-muted-foreground">
          {filtered.length} {t.products}
        </p>
      </div>

      {/* mobile: filter chips row + bottom sheet */}
      <div className="flex items-center gap-2 md:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSheetOpen(true)}
          className="h-11 gap-2 rounded-full border-primary/25 bg-card px-4 text-sm font-bold text-primary"
          aria-expanded={sheetOpen}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {ar ? 'فلاتر' : 'Filters'}
          {activeCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="flex h-11 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-xs font-bold text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {ar ? 'مسح' : 'Clear'}
          </button>
        )}
        <span className="mr-auto text-xs font-bold text-muted-foreground">
          {filtered.length} {t.products}
        </span>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-5 pb-8 pt-2"
        >
          <SheetTitle className="text-base font-bold">
            {ar ? 'ترتيب وفلترة' : 'Sort & filter'}
          </SheetTitle>
          <div className="mt-4 flex flex-col items-stretch gap-3">{controls}</div>
          <Button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="mt-4 h-11 w-full rounded-full bg-primary font-bold text-primary-foreground"
          >
            {ar ? `عرض النتائج (${filtered.length})` : `Show results (${filtered.length})`}
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterableProductGrid — toolbar + product grid + filters-empty state.
// Handy wrapper for pages that just have a products array (e.g. /search).
// ---------------------------------------------------------------------------

export function FilterableProductGrid({
  products,
  className,
}: {
  products: ProductCardData[];
  className?: string;
}) {
  const { ar } = useT();
  const [filtered, setFiltered] = useState<ProductCardData[]>(products);

  return (
    <div className={className}>
      <CatalogFilters products={products} onChange={setFiltered} />
      {filtered.length > 0 ? (
        // U23-CATALOG-RAIL — mobile: snap rail instead of 10 rows of scrolling;
        // md+: the approved 3/4-col grid unchanged.
        <ProductTrack products={filtered} ariaLabel={ar ? 'المنتجات' : 'Products'} className="mt-6" />
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {ar
            ? 'لا توجد منتجات مطابقة للفلاتر — جرّبي توسيع النطاق أو مسح الفلاتر.'
            : 'No products match these filters — try widening the range or clearing filters.'}
        </p>
      )}
    </div>
  );
}
