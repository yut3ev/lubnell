'use client';

import Link from 'next/link';
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Minus,
  Plus,
  ShoppingBag,
  Zap,
  MessageCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCart, WHATSAPP_NUMBER } from '@/lib/cart-store';
import type { ProductVariants } from '@/lib/lubnel-types';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProductReviews } from '@/components/store/product-reviews';
import { ImageLightbox } from '@/components/store/image-lightbox'; // U58-GALLERY

export interface ProductDetailData {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
  gallery: string[];
  badgeAr: string | null;
  badgeEn: string | null;
  variants: ProductVariants[];
  stock: number;
  rating: number;
  reviews: number;
  categoryName: { ar: string; en: string; slug: string };
}

export function ProductDetail({
  product,
  whatsapp,
  deliveryTime,
}: {
  product: ProductDetailData;
  // U19-SETTINGS — orders WhatsApp number + delivery window from Studio
  whatsapp?: string;
  deliveryTime?: string;
}) {
  const { ar, t } = useT();
  // U19-SETTINGS — currency label from Studio
  const currency = useStorePrefs((s) => s.currency);
  useEffect(() => { void useStorePrefs.getState().ensure(); }, []);
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  // U14 — gallery selector + hover zoom + selectable variants + sticky mobile ATC
  // U58-GALLERY — professional gallery: swipe + arrows + counter + dots + lightbox
  // Selected image is stored as URL (not index) so switching products
  // auto-resets to the first image — no state-sync effect needed.
  const [sel, setSel] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const touchX = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  // U85-V3 — MULTIPLE option groups (اللون + الحجم + الريحة…): the customer
  // picks ONE value from EACH group and the cart line carries them all
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries((product.variants || []).map((g) => [g.name, g.options[0]?.value ?? '']))
  );
  // the most recently clicked option photo drives the main image
  const [pickedImage, setPickedImage] = useState<string | null>(null);

  const name = ar ? product.nameAr : product.nameEn;
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;
  // U58-GALLERY — the primary image is ALWAYS first, then the owner-ordered
  // gallery (dedup) — matches the «تعيين كصورة رئيسية» star in Studio.
  const images = Array.from(new Set([product.image, ...product.gallery]));
  // U85-V3 — the most recently clicked option photo becomes the main image
  const pickedVariantImage = pickedImage;
  const activeImg = sel && images.includes(sel) ? sel : (pickedVariantImage || images[0]);
  const imgIdx = Math.max(0, images.indexOf(activeImg));
  const select = (i: number) => setSel(images[((i % images.length) + images.length) % images.length]);

  // keep the active thumb visible in the strip
  useEffect(() => {
    const el = thumbsRef.current?.children[Math.min(imgIdx, images.length - 1)] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [imgIdx, images.length]);

  function addToCart(then?: 'cart') {
    // U85-V3 — the cart line and the order record carry EVERY picked group:
    // «اللون: أحمر · الحجم: 250ml»
    const variantSummary = (product.variants || [])
      .map((g) => (picked[g.name] ? `${g.name}: ${picked[g.name]}` : ''))
      .filter(Boolean)
      .join(' · ');
    const variantImage = pickedImage;
    add(
      {
        id: product.id,
        slug: product.slug,
        nameAr: name,
        price: product.price,
        image: variantImage || product.image,
        variant: variantSummary || undefined,
      },
      qty
    );
    toast({ title: t.addToCartTitle, description: t.addedDesc(name) });
    if (then === 'cart') window.location.href = '/cart';
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* breadcrumb */}
      <nav aria-label="مسار التنقل" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-primary">{t.home}</Link>
        <span aria-hidden>/</span>
        <Link href={`/c/${product.categoryName.slug}`} className="transition-colors hover:text-primary">
          {ar ? product.categoryName.ar : product.categoryName.en}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate font-semibold text-foreground">{name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        {/* gallery — U14 thumbs + hover zoom (desktop) — U58 swipe/arrows/counter/dots/lightbox */}
        {/* min-w-0 — the grid item must be allowed to shrink below the gallery
            image's natural width, otherwise the phone's layout viewport blows
            out to the image width and the whole page renders zoomed-out
            (MOBILE-DISPLAY-2026-09: box products with tall R2 images) */}
        <div className="min-w-0">
          <div
            className="group relative touch-pan-y select-none overflow-hidden rounded-3xl border border-border/60 bg-secondary/30 shadow-lg shadow-primary/5"
            onMouseEnter={() => setZoomed(true)}
            onMouseLeave={() => setZoomed(false)}
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchX.current;
              touchX.current = null;
              if (start === null || images.length <= 1) return;
              const dx = e.changedTouches[0]?.clientX - start;
              if (Math.abs(dx) < 40) return;
              // RTL: swiping right reveals the next image (visual flow right→left)
              if (ar ? dx > 0 : dx < 0) select(imgIdx + 1);
              else select(imgIdx - 1);
            }}
          >
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="block w-full cursor-zoom-in"
              aria-label={`${ar ? 'فتح الصور بالحجم الكامل' : 'Open full-size gallery'} — ${name}`}
            >
              <img
                src={activeImg}
                alt={name}
                className={`aspect-square w-full object-cover transition-transform duration-500 ${zoomed ? 'scale-125' : 'scale-100'}`}
              />
            </button>
            {product.badgeAr && (
              <Badge className="pointer-events-none absolute top-4 right-4 rounded-full bg-primary px-3 py-1 text-sm font-bold">
                {ar ? product.badgeAr : product.badgeEn || product.badgeAr}
              </Badge>
            )}
            {discount > 0 && (
              <Badge className="pointer-events-none absolute top-4 left-4 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                وفّري {discount}%
              </Badge>
            )}
            {/* arrows — desktop (mobile swipes) */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => select(ar ? imgIdx - 1 : imgIdx + 1)}
                  aria-label={ar ? t.lbPrevAria : t.lbNextAria}
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground opacity-0 shadow-md backdrop-blur transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover:opacity-100 max-sm:hidden"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => select(ar ? imgIdx + 1 : imgIdx - 1)}
                  aria-label={ar ? t.lbNextAria : t.lbPrevAria}
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground opacity-0 shadow-md backdrop-blur transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover:opacity-100 max-sm:hidden"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
              </>
            )}
            {/* counter chip */}
            {images.length > 1 && (
              <span
                className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-black tabular-nums text-foreground shadow-sm backdrop-blur"
                aria-live="polite"
              >
                {imgIdx + 1} / {images.length}
              </span>
            )}
            <span
              className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-bold text-muted-foreground backdrop-blur sm:inline-flex"
              aria-hidden
            >
              <ZoomIn className="h-3 w-3" /> {ar ? 'اضغطي للتكبير' : 'Click to zoom'}
            </span>
          </div>
          {/* dots — mobile */}
          {images.length > 1 && (
            <div className="mt-2.5 flex justify-center gap-1.5 sm:hidden" aria-hidden>
              {images.map((img, i) => (
                <span
                  key={`dot-${img.slice(-24)}-${i}`}
                  className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-5 bg-primary' : 'w-1.5 bg-primary/25'}`}
                />
              ))}
            </div>
          )}
          {images.length > 1 && (
            <div ref={thumbsRef} className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`${ar ? 'صورة' : 'Image'} ${i + 1}`}
                  aria-pressed={imgIdx === i}
                  className={`h-20 w-20 shrink-0 snap-center overflow-hidden rounded-xl border-2 bg-secondary/30 transition-all ${
                    imgIdx === i ? 'border-primary shadow-md' : 'border-border/70 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={name} aria-hidden className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* info */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-0.5" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={
                    i < Math.round(product.rating)
                      ? 'h-4 w-4 fill-amber-400 text-amber-400'
                      : 'h-4 w-4 text-muted-foreground/40'
                  }
                />
              ))}
            </span>
            <span className="font-bold">{product.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({product.reviews} {t.reviews})
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold leading-snug sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground" dir="ltr">
            {product.nameEn}
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-primary">
              {product.price.toLocaleString('en-US')}
            </span>
            <span className="text-base font-bold text-muted-foreground">{currency || t.egp}</span>
            {product.compareAt && product.compareAt > product.price && (
              <del className="text-lg font-bold text-muted-foreground/70">
                {product.compareAt.toLocaleString('en-US')} {currency || t.egp}
              </del>
            )}
          </div>

          <p className="mt-5 leading-loose text-foreground/85">{product.description}</p>

          {/* U85-V3 — MULTIPLE option groups (اللون + الحجم + الريحة…): color
              groups render as swatch circles (her photo overrides the fill),
              others as image/text chips; the picked values feed the cart line */}
          {(product.variants || []).length > 0 && (
            <div className="mt-5 grid gap-4">
              {product.variants.map((g) => {
                const isColorGroup = g.options.some((o) => o.color && !o.image);
                return (
                  <div key={g.name}>
                    <span className="mb-1.5 block text-sm font-bold">{g.name}</span>
                    <div className={isColorGroup ? 'flex flex-wrap gap-3' : 'flex flex-wrap gap-2'}>
                      {g.options.map((o) => {
                        const on = picked[g.name] === o.value;
                        if (isColorGroup) {
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => { setPicked((p) => ({ ...p, [g.name]: o.value })); if (o.image) setPickedImage(o.image); setSel(null); }}
                              aria-pressed={on}
                              title={o.description || o.value}
                              className="grid w-16 justify-items-center gap-1"
                            >
                              <span
                                className={`relative block h-12 w-12 overflow-hidden rounded-full transition-all ${
                                  on ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-1 ring-black/10'
                                }`}
                                style={o.color && !o.image ? { background: o.color } : undefined}
                              >
                                {o.image ? (
                                  <img src={o.image} alt={o.value} className="h-full w-full object-cover" loading="lazy" />
                                ) : null}
                                {on && (
                                  <span className="absolute inset-0 grid place-items-center bg-black/25 text-[11px] font-black text-white">✓</span>
                                )}
                              </span>
                              <span className={`text-[11px] font-bold ${on ? 'text-primary' : 'text-muted-foreground'}`}>{o.value}</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => { setPicked((p) => ({ ...p, [g.name]: o.value })); if (o.image) setPickedImage(o.image); setSel(null); }}
                            aria-pressed={on}
                            className={`inline-flex items-center gap-1.5 rounded-full border py-1 text-xs font-bold transition-all ${
                              o.image ? 'pl-1 pr-3.5' : 'px-3.5'
                            } ${
                              on
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-primary/20 bg-secondary/60 text-primary hover:bg-secondary'
                            }`}
                          >
                            {o.image ? (
                              <img
                                src={o.image}
                                alt=""
                                aria-hidden
                                className="h-7 w-7 rounded-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            {o.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Separator className="my-6" />

          {/* quantity */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold">{t.quantity}</span>
            <div className="flex items-center rounded-full border border-border bg-card">
              <Button
                variant="ghost"
                size="icon"
                aria-label="+"
                className="h-10 w-10 rounded-full"
                disabled={qty >= Math.min(20, Math.max(1, product.stock))}
                onClick={() => setQty((q) => Math.min(20, q + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-base font-bold" aria-live="polite">{qty}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="-"
                className="h-10 w-10 rounded-full"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
            {product.stock > 0 && product.stock <= 10 && (
              <span className="text-xs font-bold text-destructive">
                {ar ? `باقي ${product.stock} قطع فقط!` : `Only ${product.stock} left!`}
              </span>
            )}
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              disabled={product.stock <= 0}
              onClick={() => addToCart()}
              className="h-13 flex-1 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02]"
            >
              <ShoppingBag className="h-5 w-5" />
              {product.stock <= 0 ? (ar ? 'نفدت الكمية' : 'Sold out') : t.addToBag}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={product.stock <= 0}
              className="h-13 flex-1 rounded-full border-primary/30 bg-card text-base font-bold text-primary hover:bg-secondary"
              onClick={() => addToCart('cart')}
            >
              <Zap className="h-5 w-5" />
              {t.buyNow}
            </Button>
          </div>

          {/* whatsapp direct order — number from Studio settings when set */}
          <a
            href={`https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
              `مرحبًا LUBNÉL، أريد طلب: ${product.nameAr} (${product.price} ج.م) — الكمية: ${qty}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <MessageCircle className="h-4.5 w-4.5" aria-hidden />
            {t.orderViaWa}
          </a>

          {/* guarantees */}
          <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2.5">
              <Truck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {deliveryTime ? (ar ? `شحن ${deliveryTime}` : `${deliveryTime} shipping`) : ar ? 'شحن 2–5 أيام' : '2–5 day shipping'}
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {ar ? 'أصلي 100%' : '100% authentic'}
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2.5">
              <RotateCcw className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {ar ? 'إرجاع 14 يومًا' : '14-day returns'}
            </li>
          </ul>
          {/* U14 — shipping/returns quick info (trust) */}
          <details className="mt-4 rounded-2xl border border-border/60 bg-card px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
              {ar ? 'معلومات الشحن والاسترجاع' : 'Shipping & returns'}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-2.5 grid gap-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                {ar
                  ? 'شحن مجاني للطلبات فوق الحد المحدد، والتوصيل خلال 2–5 أيام عمل داخل مصر. الاستبدال والإرجاع متاح خلال 14 يومًا من الاستلام بنفس حالة المنتج.'
                  : 'Free shipping over the set threshold; delivery in 2–5 working days across Egypt. Exchange & returns within 14 days in original condition.'}
              </p>
              <Link href="/info/shipping" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {ar ? 'التفاصيل الكاملة ←' : 'Full details →'}
              </Link>
            </div>
          </details>
        </div>
      </div>

      {/* U18-REVIEWS — real reviews + write form (شاركي تجربتكِ) on EVERY product */}
      <ProductReviews slug={product.slug} rating={product.rating} reviewsCount={product.reviews} />

      {/* U58-GALLERY — fullscreen lightbox */}
      {lightbox && (
        <ImageLightbox
          images={images}
          index={Math.min(imgIdx, images.length - 1)}
          onClose={() => setLightbox(false)}
          onIndexChange={select}
          alt={name}
        />
      )}

      {/* U14 — sticky mobile add-to-cart bar (above the bottom nav) */}
      <div
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border/60 bg-background/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        data-testid="sticky-atc"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <img src={activeImg} alt={name} aria-hidden className="h-11 w-11 rounded-xl border border-border/60 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{name}</p>
            <p className="text-sm font-bold text-primary">
              {(product.price * qty).toLocaleString('en-US')} {currency || t.egp}
              {discount > 0 && product.compareAt ? (
                <del className="mr-1.5 text-[11px] font-bold text-muted-foreground">
                  {(product.compareAt * qty).toLocaleString('en-US')}
                </del>
              ) : null}
            </p>
          </div>
          <Button
            disabled={product.stock <= 0}
            onClick={() => addToCart()}
            className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25"
          >
            <ShoppingBag className="h-4.5 w-4.5" aria-hidden />
            {product.stock <= 0 ? (ar ? 'نفدت' : 'Sold out') : t.addToBag}
          </Button>
        </div>
      </div>
    </div>
  );
}
