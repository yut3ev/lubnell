'use client';

// Quick View — inspect a product in a modal without leaving the listing.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShoppingBag, Minus, Plus, Eye, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProductCardData } from '@/components/store/product-card';

const MAX_QTY_CAP = 20;
const LOW_STOCK_THRESHOLD = 10;

export function QuickView({
  product,
  open,
  onOpenChange,
}: {
  product: ProductCardData;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { ar, t } = useT();
  // U19-SETTINGS — currency label from Studio (fallback: ج.م/EGP)
  const currency = useStorePrefs((s) => s.currency);
  useEffect(() => { void useStorePrefs.getState().ensure(); }, []);
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const name = ar ? product.nameAr : product.nameEn;
  const soldOut = product.stock <= 0;
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];
  const mainImage =
    activeImage && gallery.includes(activeImage) ? activeImage : gallery[0];
  // qty stepper cap: min(stock, 20) — never below 1 so the stepper stays usable
  const maxQty = Math.max(1, Math.min(product.stock, MAX_QTY_CAP));

  function addToBag() {
    setAdding(true);
    add(
      {
        id: product.id,
        slug: product.slug,
        nameAr: name,
        price: product.price,
        image: product.image,
      },
      qty
    );
    toast({ title: t.addToCartTitle, description: t.addedDesc(name) });
    setTimeout(() => setAdding(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-3xl p-0">
        <div className="grid sm:grid-cols-2">
          <div className="relative aspect-square bg-secondary/30 sm:aspect-auto">
            <img
              src={mainImage}
              alt={name}
              loading="lazy"
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover ${soldOut ? 'grayscale opacity-70' : ''}`}
            />
            {discount > 0 && (
              <Badge className="absolute top-3 left-3 rounded-full bg-accent font-bold text-accent-foreground">
                -{discount}%
              </Badge>
            )}
            {soldOut && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-foreground/85 px-4 py-2 text-xs font-bold text-background">
                  {ar ? 'نفدت الكمية' : 'Sold out'}
                </span>
              </span>
            )}
            {gallery.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {gallery.slice(0, 4).map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    aria-label={ar ? 'عرض الصورة' : 'View image'}
                    className={`h-12 w-12 overflow-hidden rounded-xl border-2 transition-colors ${
                      mainImage === img ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" aria-hidden loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <DialogTitle className="text-xl font-bold leading-snug">{name}</DialogTitle>
            <DialogDescription className="sr-only">{name}</DialogDescription>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">
                {product.price.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">{currency || t.egp}</span>
              {discount > 0 && (
                <span className="text-sm font-semibold text-muted-foreground line-through">
                  {product.compareAt?.toLocaleString('en-US')}
                </span>
              )}
            </div>

            {product.description && (
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}

            {soldOut ? (
              <p className="text-sm font-bold text-destructive">
                {ar ? 'نفدت الكمية حاليًا' : 'Sold out'}
              </p>
            ) : product.stock <= LOW_STOCK_THRESHOLD ? (
              <p className="text-xs font-bold text-destructive">
                {ar ? `باقي ${product.stock} قطع فقط!` : `Only ${product.stock} left!`}
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-600">
                {ar ? '✓ متوفر للشحن الفوري' : '✓ In stock'}
              </p>
            )}

            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">{t.quantity}</span>
              <div className="flex items-center rounded-full border border-border bg-background">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="+"
                  disabled={soldOut || qty >= maxQty}
                  className="h-11 w-11 rounded-full"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-sm font-bold" aria-live="polite">{qty}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="-"
                  disabled={soldOut || qty <= 1}
                  className="h-11 w-11 rounded-full"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button
                disabled={soldOut || adding}
                onClick={addToBag}
                className="h-11 rounded-full bg-primary font-bold text-primary-foreground"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShoppingBag className="h-4 w-4" />}
                {soldOut ? (ar ? 'غير متاح حاليًا' : 'Unavailable') : t.addToBag}
              </Button>
              <Button asChild variant="outline"
                className="h-11 rounded-full border-primary/30 font-bold text-primary hover:bg-secondary"
                onClick={() => onOpenChange(false)}>
                <Link href={`/p/${product.slug}`}>
                  <Eye className="h-4 w-4" aria-hidden />
                  {ar ? 'التفاصيل الكاملة' : 'Full details'}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickViewTrigger({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute bottom-3 left-3 grid h-11 w-11 place-items-center rounded-full border border-border/70 bg-card/90 text-primary opacity-0 shadow-sm backdrop-blur transition-all duration-200 hover:bg-secondary focus-visible:opacity-100 md:opacity-0 max-md:opacity-100"
    >
      <Eye className="h-4.5 w-4.5" aria-hidden />
    </button>
  );
}
