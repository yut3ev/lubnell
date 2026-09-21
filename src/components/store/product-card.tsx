'use client';

import Link from 'next/link';
import { ShoppingBag, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuickView } from '@/components/store/quick-view';

export interface ProductCardData {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  price: number;
  compareAt: number | null;
  image: string;
  rating: number;
  reviews: number;
  stock: number;
  badgeAr?: string | null;
  badgeEn?: string | null;
}

// U10-CARD — rebuilt to the owner-approved card anatomy (verified against her
// screenshots): badges on the image, name, price with struck compare-at,
// stock line («باقي N قطع فقط!» / «✓ متوفر») and a FULL-WIDTH «أضيفي إلى
// السلة» button. Rating only renders once real reviews exist.
export function ProductCard({ product }: { product: ProductCardData }) {
  const { ar, t } = useT();
  const add = useCart((s) => s.add);
  // U19-SETTINGS — currency label from Studio (fallback: ج.م/EGP)
  const currency = useStorePrefs((s) => s.currency);
  useEffect(() => {
    void useStorePrefs.getState().ensure();
  }, []);
  // U14 — Quick View state (معاينة سريعة للمنتج من الكتالوج)
  const quickState = useState(false);
  const quickOpen = quickState[0];
  const setQuickOpen = quickState[1];
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 10;
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10">
      {/* U23-FEATURED-SWIPE — image + quick-view are one media block now: the
          eye button used to be absolutely positioned to the CARD's bottom
          edge, where it collided with the «أضيفي إلى السلة» button on every
          card (owner screenshots). Bottom-left of the image = standard,
          collision-free placement; h-full lets rail/grid siblings stretch
          to a uniform height. */}
      <div className="relative">
      <Link href={`/p/${product.slug}`} className="relative block aspect-square overflow-hidden bg-secondary/40">
        <img
          src={product.image}
          alt={ar ? product.nameAr : product.nameEn}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badgeAr && (
          <Badge className="absolute top-3 right-3 rounded-full bg-primary font-bold text-primary-foreground">
            {ar ? product.badgeAr : product.badgeEn || product.badgeAr}
          </Badge>
        )}
        {discount > 0 && (
          <Badge className="absolute top-3 left-3 rounded-full bg-accent font-bold text-accent-foreground">
            -{discount}%
          </Badge>
        )}
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-background/70" aria-hidden>
            <span className="rounded-full bg-foreground/80 px-4 py-1.5 text-xs font-bold text-background">
              {ar ? 'نفدت الكمية' : 'Sold out'}
            </span>
          </div>
        )}
      </Link>

      {/* U14/U23 — quick view trigger (outside the link so it doesn't
          navigate; anchored to the image block, not the card bottom) */}
      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        aria-label={ar ? `معاينة سريعة لـ ${product.nameAr}` : `Quick view ${product.nameEn}`}
        title={ar ? 'معاينة سريعة' : 'Quick view'}
        className="absolute bottom-3 left-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm backdrop-blur transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground"
      >
        <Eye className="h-4 w-4" aria-hidden />
      </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {product.reviews > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
            <span>
              ({product.reviews} {t.reviews})
            </span>
          </div>
        )}

        <Link
          href={`/p/${product.slug}`}
          className="line-clamp-1 text-sm font-semibold leading-snug transition-colors hover:text-primary"
        >
          {ar ? product.nameAr : product.nameEn}
        </Link>

        {/* U10-CARD — struck compare-at next to the live price, as approved */}
        <div className="flex items-baseline gap-1.5">
          {/* U25-NUMS — Western digits everywhere (rating 5.0 / stock 7 / price
              400 were mixing ٤٠٠ with 5.0 — owner: «إحساس عدم اتساق فوري»).
              One numeral system across the whole storefront now. */}
          <span className="text-[17px] font-bold text-primary">
            {product.price.toLocaleString('en-US')}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">{currency || t.egp}</span>
          {discount > 0 && (
            <span className="text-xs font-semibold text-muted-foreground line-through">
              {product.compareAt?.toLocaleString('en-US')}
            </span>
          )}
        </div>

        {/* U10-CARD — stock line restored («باقي N قطع فقط!» for ≤10) */}
        <p
          className={`text-[11px] font-semibold leading-none ${
            soldOut || lowStock ? 'text-destructive' : 'text-emerald-600'
          }`}
        >
          {soldOut
            ? ar
              ? 'غير متاح حاليًا'
              : 'Currently unavailable'
            : lowStock
              ? ar
                ? `باقي ${product.stock} قطع فقط!`
                : `Only ${product.stock} left!`
              : ar
                ? '✓ متوفر'
                : '✓ In stock'}
        </p>

        {/* U25-BTNTIER — the card CTA used to be h-10/font-black, screaming as
            loud as the PDP's main button (owner: «حجمها كبير جداً بالنسبة
            لحجم الكارت»). It's now the SMALL primary tier: h-9/text-xs/bold.
            Primary = solid fill, Secondary = outline, Quiet = text link. */}
        <Button
          className="mt-1.5 h-9 w-full rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary hover:shadow-md active:scale-[0.98]"
          disabled={soldOut}
          aria-label={`${t.addToBag} — ${ar ? product.nameAr : product.nameEn}`}
          onClick={() => {
            add({
              id: product.id,
              slug: product.slug,
              nameAr: ar ? product.nameAr : product.nameEn,
              price: product.price,
              image: product.image,
            });
            toast({
              title: t.addToCartTitle,
              description: t.addedDesc(ar ? product.nameAr : product.nameEn),
            });
          }}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {soldOut ? (ar ? 'غير متاح حاليًا' : 'Unavailable') : t.addToBag}
        </Button>
      </div>

      {/* U14 — Quick View modal */}
      <QuickView product={product} open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
