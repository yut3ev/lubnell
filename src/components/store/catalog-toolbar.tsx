'use client';

// Reusable sort + filter toolbar + product grid (used by /search).
import { useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { EditorialCard } from '@/components/store/editorial-card';
import { Reveal } from '@/components/store/reveal';
import type { ProductCardData } from '@/components/store/product-card';
import { useT } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

      {/* U28 — editorial cards with a staggered entrance cascade */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i * 60, 300)}>
            <EditorialCard product={p} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
