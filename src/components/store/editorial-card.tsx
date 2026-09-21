'use client';

// U28-EDITORIAL-CARD — the ONE product card for the whole storefront.
// History: U26b built this DNA for «عروض اليوم» at the owner's request —
// «عايز شكل البطاقات يبقا زي شكل بطاقات قسم تسوقي حسب الفئة» — the exact
// look of the categories editorial mosaic: full-bleed photo + neutral
// cinematic gradient + white extrabold name + glassy chip that inverts to
// solid white on hover. U26c fixed names (line-clamp-2) and made offers a
// side-by-side swipe rail. Now (U28) the owner asked for the same radical
// change on «كل المنتجات» — so the card moved here and every product
// surface (catalog rail/grid, /c pages, featured, related, 404 shelf)
// speaks this one visual language. Functionality identical to the old
// ProductCard (link, quick view, cart, toast). The photo itself carries
// each product's personality.

import Link from 'next/link';
import { Eye, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { QuickView } from '@/components/store/quick-view';
import type { ProductCardData } from '@/components/store/product-card';

export function EditorialCard({ product }: { product: ProductCardData }) {
  const { ar, t } = useT();
  const add = useCart((s) => s.add);
  const currency = useStorePrefs((s) => s.currency);
  useEffect(() => {
    void useStorePrefs.getState().ensure();
  }, []);
  const [quickOpen, setQuickOpen] = useState(false);

  const name = ar ? product.nameAr : product.nameEn;
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 10;
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;

  return (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-border/60 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/15">
      <Link
        href={`/p/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-secondary/40"
        aria-label={name}
      >
        <img
          src={product.image}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </Link>

      {soldOut && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background/70" aria-hidden>
          <span className="rounded-full bg-foreground/80 px-4 py-1.5 text-xs font-bold text-background">
            {ar ? 'نفدت الكمية' : 'Sold out'}
          </span>
        </div>
      )}

      {/* neutral cinematic gradient — identical to the categories mosaic */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" aria-hidden />

      {/* amber discount medallion — same accent language as the header's
          «حتى X%» and the catalog badges */}
      {discount > 0 && (
        <span className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-accent text-[10px] font-extrabold text-accent-foreground shadow-md ring-2 ring-white/50">
          <span dir="ltr">-{discount}%</span>
        </span>
      )}

      {product.badgeAr && (
        <span className="absolute left-3 top-3 z-10 max-w-[52%] truncate rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          {ar ? product.badgeAr : product.badgeEn || product.badgeAr}
        </span>
      )}

      {/* bottom overlay — categories anatomy: name / price / glassy chip.
          Soft text-shadow keeps the white type legible over bright studio
          photos (the categories tiles use darker lifestyle shots). */}
      <div className="absolute bottom-0 w-full p-3 text-primary-foreground [text-shadow:0_1px_6px_rgb(0_0_0/0.45),0_0_2px_rgb(0_0_0/0.35)] sm:p-4">
        <Link
          href={`/p/${product.slug}`}
          className="line-clamp-2 min-h-[2.5em] text-[13px] font-extrabold leading-tight sm:text-sm"
        >
          {name}
        </Link>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[15px] font-extrabold">
            {product.price.toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold opacity-90">{currency || t.egp}</span>
          {discount > 0 && (
            <span className="text-[11px] font-bold line-through opacity-70">
              {product.compareAt?.toLocaleString('en-US')}
            </span>
          )}
        </div>

        {lowStock && (
          <p className="mt-0.5 text-[10px] font-bold leading-none text-amber-300">
            {ar ? `باقي ${product.stock} قطع فقط!` : `Only ${product.stock} left!`}
          </p>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          {/* glassy chip = the categories «تسوّقي الآن» treatment; expanded
              hit area keeps a 44px touch target around the small chip */}
          <button
            type="button"
            disabled={soldOut}
            aria-label={`${t.addToBag} — ${name}`}
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-all duration-300 after:absolute after:-inset-2 hover:bg-white hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              add({
                id: product.id,
                slug: product.slug,
                nameAr: name,
                price: product.price,
                image: product.image,
              });
              toast({
                title: t.addToCartTitle,
                description: t.addedDesc(name),
              });
            }}
          >
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
            {soldOut ? (ar ? 'غير متاح' : 'Unavailable') : ar ? 'أضيفي' : 'Add'}
          </button>

          {/* quick view — glassy circle mirroring the chip language */}
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            aria-label={ar ? `معاينة سريعة لـ ${product.nameAr}` : `Quick view ${product.nameEn}`}
            title={ar ? 'معاينة سريعة' : 'Quick view'}
            className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all duration-300 after:absolute after:-inset-1.5 hover:bg-white hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <QuickView product={product} open={quickOpen} onOpenChange={setQuickOpen} />
    </article>
  );
}
