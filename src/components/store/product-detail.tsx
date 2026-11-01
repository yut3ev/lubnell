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
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ZoomIn,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useCart, WHATSAPP_NUMBER } from '@/lib/cart-store';
import type { ProductVariants } from '@/lib/lubnel-types';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { Badge } from '@/components/ui/badge';
import { ProductReviews } from '@/components/store/product-reviews';
import { ImageLightbox } from '@/components/store/image-lightbox'; // U58-GALLERY

/* Botanical doodles from lubnel-product-final.html */
function FlowerDoodle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5c-2.5-3.5-1-6.5 0-6.5s2.5 3 0 6.5zM12 14.5c-2.5 3.5-1 6.5 0 6.5s2.5-3 0-6.5zM9.5 12c-3.5-2.5-6.5-1-6.5 0s3 2.5 6.5 0zM14.5 12c3.5 2.5 6.5 1 6.5 0s-3-2.5-6.5 0z" />
    </svg>
  );
}

function SprigDoodle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22V8M12 15c-4 0-6-3-6-6 4 0 6 3 6 6zM12 11c4 0 6-3 6-6-4 0-6 3-6 6z" />
    </svg>
  );
}

function ButterflyDoodle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={style} aria-hidden>
      <svg viewBox="0 0 24 24" className="w-full h-full animate-lubnel-flap" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12c-3-6-9-6-9-2s5 5 9 2zM12 12c3-6 9-6 9-2s-5 5-9 2zM12 12c-2 4-6 6-6 3s4-3 6-3zM12 12c2 4 6 6 6 3s-4-3-6-3zM12 7v10" />
      </svg>
    </div>
  );
}

function LeafDoodle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19L14 10" />
    </svg>
  );
}

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
  const [copied, setCopied] = useState(false);
  // RESTOCK-ALERTS — notify-me state for sold-out products
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [notifyError, setNotifyError] = useState('');
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
      <nav aria-label="مسار التنقل" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground font-semibold">
        <Link href="/" className="text-[#8a3a46] transition-colors hover:underline">{t.home}</Link>
        <span aria-hidden className="text-[#ecd9d1]">/</span>
        <Link href={`/c/${product.categoryName.slug}`} className="text-[#8a3a46] transition-colors hover:underline">
          {ar ? product.categoryName.ar : product.categoryName.en}
        </Link>
        <span aria-hidden className="text-[#ecd9d1]">/</span>
        <span className="truncate font-bold text-[#3a2226] dark:text-foreground">{name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 items-start">
        {/* gallery — lubnel-product-final.html photo frame with washi tape & floating botanical doodles */}
        <div className="min-w-0">
          <div className="relative p-3 sm:p-5">
            {/* Washi tape at top */}
            <div className="lubnel-washi-tape" aria-hidden />

            {/* Floating botanical stickers / doodles */}
            <FlowerDoodle
              className="pointer-events-none absolute -top-1 end-3 h-7 w-7 text-[#c9677a] opacity-85 animate-lubnel-float z-10"
              style={{ ['--r' as string]: '10deg' }}
            />
            <SprigDoodle
              className="pointer-events-none absolute top-4 start-2 h-6 w-6 text-[#6f8f5e] opacity-85 animate-lubnel-float z-10"
              style={{ ['--r' as string]: '-14deg' }}
            />
            <FlowerDoodle
              className="pointer-events-none absolute -bottom-1 end-10 h-6 w-6 text-[#e08a96] opacity-85 animate-lubnel-float z-10"
              style={{ ['--r' as string]: '8deg' }}
            />
            <ButterflyDoodle
              className="pointer-events-none absolute bottom-2 start-3 h-7 w-7 text-[#c9677a] opacity-90 animate-lubnel-float z-10"
              style={{ ['--r' as string]: '-6deg' }}
            />
            <LeafDoodle
              className="pointer-events-none absolute top-1/2 -end-1 h-5 w-5 -translate-y-1/2 text-[#6f8f5e] opacity-85 animate-lubnel-float z-10"
              style={{ ['--r' as string]: '18deg' }}
            />

            {/* Main photo container */}
            <div
              className="group relative touch-pan-y select-none overflow-hidden rounded-[26px] border border-[#ecd9d1]/70 bg-white shadow-[0_26px_36px_-26px_rgba(90,34,48,0.35)] dark:bg-card dark:border-border"
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
                  className={`aspect-[1067/1057] w-full object-cover transition-transform duration-500 ${zoomed ? 'scale-115' : 'scale-100'}`}
                />
              </button>

              {product.badgeAr && (
                <Badge className="pointer-events-none absolute top-4 right-4 rounded-full bg-[#8a3a46] px-3.5 py-1 text-xs font-extrabold text-white shadow-sm">
                  {ar ? product.badgeAr : product.badgeEn || product.badgeAr}
                </Badge>
              )}
              {discount > 0 && (
                <Badge className="pointer-events-none absolute top-4 left-4 rounded-full bg-[#f7d9c8] text-[#5a2230] border border-[#e9a9ae] px-3 py-1 text-xs font-black shadow-sm">
                  وفّري {discount}%
                </Badge>
              )}

              {/* desktop arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => select(ar ? imgIdx - 1 : imgIdx + 1)}
                    aria-label={ar ? t.lbPrevAria : t.lbNextAria}
                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#5a2230] opacity-0 shadow-md backdrop-blur transition-all hover:scale-110 hover:bg-[#8a3a46] hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:hidden"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => select(ar ? imgIdx + 1 : imgIdx - 1)}
                    aria-label={ar ? t.lbNextAria : t.lbPrevAria}
                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#5a2230] opacity-0 shadow-md backdrop-blur transition-all hover:scale-110 hover:bg-[#8a3a46] hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:hidden"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                </>
              )}

              {/* Counter chip */}
              {images.length > 1 && (
                <span
                  className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-black tabular-nums text-[#5a2230] shadow-sm backdrop-blur"
                  aria-live="polite"
                >
                  {imgIdx + 1} / {images.length}
                </span>
              )}

              {/* Zoom pill button */}
              <button
                type="button"
                onClick={() => setLightbox(true)}
                className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full border border-[#ecd9d1] bg-white/85 px-3 py-1.5 text-xs font-bold text-[#5a2230] shadow-sm backdrop-blur transition-all hover:bg-white hover:scale-105"
                aria-label={ar ? 'تكبير الصورة' : 'Zoom image'}
              >
                <ZoomIn className="h-3.5 w-3.5 text-[#8a3a46]" />
                <span>{ar ? 'اضغطي للتكبير' : 'Click to zoom'}</span>
              </button>
            </div>
          </div>

          {/* mobile dots */}
          {images.length > 1 && (
            <div className="mt-2.5 flex justify-center gap-1.5 sm:hidden" aria-hidden>
              {images.map((img, i) => (
                <span
                  key={`dot-${img.slice(-24)}-${i}`}
                  className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-5 bg-[#8a3a46]' : 'w-1.5 bg-[#8a3a46]/25'}`}
                />
              ))}
            </div>
          )}

          {/* thumbnail row */}
          {images.length > 1 && (
            <div ref={thumbsRef} className="mt-3 flex gap-3 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`${ar ? 'صورة' : 'Image'} ${i + 1}`}
                  aria-pressed={imgIdx === i}
                  className={`h-20 w-20 shrink-0 snap-center overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                    imgIdx === i ? 'border-[#8a3a46] shadow-md ring-2 ring-[#8a3a46]/20' : 'border-[#ecd9d1]/70 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={name} aria-hidden className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* info section */}
        <div className="flex min-w-0 flex-col">
          {/* rating */}
          <div className="flex items-center gap-2 text-sm text-[#8a6d70]">
            <span className="flex items-center gap-0.5 text-[#e0a63e]" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={
                    i < Math.round(product.rating)
                      ? 'h-4 w-4 fill-[#f2b84b] text-[#f2b84b]'
                      : 'h-4 w-4 text-[#ecd9d1]'
                  }
                />
              ))}
            </span>
            <span className="font-extrabold text-[#3a2226] dark:text-foreground">{product.rating.toFixed(1)}</span>
            <span>
              ({product.reviews} {t.reviews})
            </span>
          </div>

          {/* product titles */}
          <h1 className="mt-2 text-2xl font-extrabold leading-snug text-[#5a2230] sm:text-3xl dark:text-foreground">
            {name}
          </h1>
          {product.nameEn && (
            <p className="mt-0.5 text-sm font-semibold text-[#8a6d70]" dir="ltr">
              {product.nameEn}
            </p>
          )}

          {/* vintage price tag ticket */}
          <div className="my-3 flex flex-wrap items-center gap-3">
            <div className="lubnel-price-tag select-none">
              <span className="text-3xl font-black text-[#8a3a46] tabular-nums sm:text-4xl">
                <small className="text-base font-bold me-1.5">{currency || t.egp}</small>
                {product.price.toLocaleString('en-US')}
              </span>
            </div>
            {product.compareAt && product.compareAt > product.price && (
              <div className="flex items-center gap-2">
                <del className="text-base font-bold text-[#8a6d70]/80 sm:text-lg">
                  {product.compareAt.toLocaleString('en-US')} {currency || t.egp}
                </del>
                <span className="rounded-full bg-[#8a3a46] px-2.5 py-0.5 text-xs font-black text-white shadow-xs">
                  {ar ? `وفرتي ${discount}%` : `Save ${discount}%`}
                </span>
              </div>
            )}
          </div>

          {/* description with dashed border-block */}
          <p className="my-2 py-3.5 text-base leading-relaxed text-[#3a2226] border-y-2 border-dashed border-[#e6cfc6] dark:text-[#fbeee9] dark:border-[#5a2230]">
            {product.description}
          </p>

          {/* variants selection */}
          {(product.variants || []).length > 0 && (
            <div className="my-3 grid gap-3.5">
              {product.variants.map((g) => {
                const isColorGroup = g.options.some((o) => o.color && !o.image);
                return (
                  <div key={g.name}>
                    <span className="mb-1.5 block text-xs font-extrabold text-[#5a2230] dark:text-foreground">{g.name}</span>
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
                                  on ? 'ring-2 ring-[#8a3a46] ring-offset-2 ring-offset-background' : 'ring-1 ring-black/10'
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
                              <span className={`text-[11px] font-bold ${on ? 'text-[#8a3a46]' : 'text-muted-foreground'}`}>{o.value}</span>
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
                                ? 'border-[#8a3a46] bg-[#8a3a46] text-white shadow-xs'
                                : 'border-[#8a3a46]/20 bg-[#fbeee9]/60 text-[#8a3a46] hover:bg-[#fbeee9]'
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

          {/* quantity selector */}
          <div className="my-3 flex items-center gap-3">
            <span className="text-sm font-bold text-[#5a2230] dark:text-foreground">{t.quantity}:</span>
            <div className="inline-flex items-center rounded-full border-1.5 border-[#ecd9d1] bg-white shadow-xs dark:bg-card dark:border-border">
              <button
                type="button"
                aria-label="تقليل"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-[#5a2230] transition-colors hover:bg-[#f6e2df] disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-8 text-center text-base font-extrabold text-[#3a2226] dark:text-foreground" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                aria-label="زيادة"
                disabled={qty >= Math.min(20, Math.max(1, product.stock))}
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-[#5a2230] transition-colors hover:bg-[#f6e2df] disabled:opacity-40"
              >
                +
              </button>
            </div>
            {product.stock > 0 && product.stock <= 10 && (
              <span className="text-xs font-bold text-destructive">
                {ar ? `باقي ${product.stock} قطع فقط!` : `Only ${product.stock} left!`}
              </span>
            )}
          </div>

          {/* action buttons matching lubnel-product-final.html */}
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1.2fr_1fr]">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => addToCart()}
              className="lubnel-btn-shimmer flex h-14 w-full items-center justify-center gap-2.5 rounded-[20px_24px_20px_26px] bg-[#8a3a46] text-base font-extrabold text-white shadow-[0_18px_24px_-16px_#8a3a46] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_28px_-14px_#8a3a46] active:scale-[0.98] disabled:opacity-50"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>{product.stock <= 0 ? (ar ? 'نفدت الكمية' : 'Sold out') : (ar ? 'أضيفي إلى السلة' : t.addToBag)}</span>
            </button>

            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => addToCart('cart')}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px_24px_20px_26px] border-1.5 border-[#8a3a46] bg-white text-base font-extrabold text-[#8a3a46] transition-all hover:-translate-y-0.5 hover:bg-[#fbeee9] active:scale-[0.98] disabled:opacity-50 dark:bg-card dark:hover:bg-secondary"
            >
              <Zap className="h-5 w-5" />
              <span>{t.buyNow}</span>
            </button>

            {/* Single full-width WhatsApp CTA matching reference .A .bt .w and user instruction */}
            {product.stock > 0 && (
              <a
                href={`https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  [
                    'مرحبًا LUBNÉL 🌸',
                    'أود طلب هذا المنتج عبر واتساب:',
                    `• ${name}${Object.entries(picked).filter(([, v]) => Boolean(v)).length > 0 ? ` (${Object.entries(picked).filter(([, v]) => Boolean(v)).map(([k, v]) => `${k}: ${v}`).join(' · ')})` : ''}`,
                    `• السعر: ${product.price.toLocaleString('en-US')} ${currency || t.egp}`,
                    `• الكمية: ${qty}`,
                    typeof window !== 'undefined' ? `• الرابط: ${window.location.href}` : '',
                  ].filter(Boolean).join('\n')
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-full flex h-14 w-full items-center justify-center gap-2.5 rounded-[20px_24px_20px_26px] border-1.5 border-[#9fd5b3] bg-[#e9f7ee] text-base font-extrabold text-[#17663b] transition-all hover:-translate-y-0.5 hover:bg-[#dcf2e5] active:scale-[0.98] dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              >
                <MessageCircle className="h-5 w-5 text-[#2fa866]" />
                <span>{ar ? 'اطلبي عبر واتساب' : 'Order via WhatsApp'}</span>
              </a>
            )}
          </div>

          {/* Quick Share to WhatsApp / Copy link */}
          <div className="mt-2 flex items-center gap-2">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `${ar ? '🌸 شوفي هذا المنتج الجميل من لوبنيل:' : '🌸 Check out this beautiful product from LUBNÉL:'}\n` +
                `✨ ${name}\n` +
                `💰 ${ar ? 'السعر' : 'Price'}: ${product.price.toLocaleString('en-US')} ${currency || t.egp}\n` +
                `${typeof window !== 'undefined' ? window.location.href : ''}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-border/70 bg-[#fbeee9]/40 px-4 text-xs font-bold text-[#8a6d70] transition-all hover:bg-[#fbeee9] dark:bg-secondary/40"
              title={ar ? 'مشاركة المنتج على واتساب' : 'Share product on WhatsApp'}
            >
              <Share2 className="h-4 w-4 text-[#8a3a46]" />
              <span>{ar ? 'مشاركة مع صديقتكِ عبر واتساب' : 'Share with a friend on WhatsApp'}</span>
            </a>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  toast({
                    title: ar ? 'تم نسخ الرابط 🌸' : 'Link copied 🌸',
                    description: ar ? 'يمكنكِ الآن مشاركته في أي مكان' : 'You can now share it anywhere',
                  });
                }
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-[#8a6d70] transition-all hover:border-[#8a3a46]/40 hover:text-[#8a3a46] active:scale-95"
              aria-label={ar ? 'نسخ رابط المنتج' : 'Copy link'}
              title={ar ? 'نسخ رابط المنتج' : 'Copy link'}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          {/* Sold out restock alert */}
          {product.stock <= 0 && (
            <div className="my-3 rounded-2xl border border-border/70 bg-card p-4">
              {notifyDone ? (
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="h-4.5 w-4.5" /> {ar ? 'تم تسجيل رقمكِ — هنكلمك أول ما المنتج يتوفر 🌸' : 'Phone saved — we will call you once it is back 🌸'}
                </p>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (notifyBusy || !notifyPhone.trim()) return;
                    setNotifyBusy(true);
                    setNotifyError('');
                    try {
                      const res = await fetch('/api/restock-alerts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slug: product.slug, phone: notifyPhone.trim() }),
                      });
                      const data = await res.json().catch(() => null);
                      if (res.ok && data?.ok) {
                        setNotifyDone(true);
                      } else {
                        setNotifyError(data?.error || (ar ? 'تعذر التسجيل — جربي تاني' : 'Could not save — try again'));
                      }
                    } catch {
                      setNotifyError(ar ? 'تعذر الاتصال — جربي تاني' : 'Connection error — try again');
                    } finally {
                      setNotifyBusy(false);
                    }
                  }}
                  className="flex flex-col gap-2"
                >
                  <p className="text-sm font-bold">{ar ? 'نفدت الكمية — أعلمني لما تتوفر تاني' : 'Sold out — notify me when it is back'}</p>
                  <div className="flex gap-2">
                    <input
                      value={notifyPhone}
                      onChange={(e) => setNotifyPhone(e.target.value)}
                      dir="ltr"
                      inputMode="tel"
                      placeholder={ar ? 'رقم موبايلك' : 'Your phone'}
                      aria-label={ar ? 'رقم الموبايل للتنبيه عند التوفر' : 'Phone for restock alert'}
                      className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-left text-sm outline-none focus:border-[#8a3a46]"
                    />
                    <button
                      type="submit"
                      disabled={notifyBusy}
                      className="h-11 shrink-0 rounded-full bg-[#8a3a46] px-5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {notifyBusy ? '…' : ar ? 'أعلمني' : 'Notify me'}
                    </button>
                  </div>
                  {notifyError && <p className="text-xs font-bold text-destructive">{notifyError}</p>}
                </form>
              )}
            </div>
          )}

          {/* trust badges from lubnel-product-final.html */}
          <div className="my-4 flex flex-wrap gap-2.5">
            <div className="flex flex-1 min-w-[130px] items-center gap-2 rounded-2xl bg-[#fbe9e3] px-3.5 py-2.5 text-xs font-bold text-[#5a2230] dark:bg-secondary/60 dark:text-foreground">
              <Truck className="h-4.5 w-4.5 shrink-0 text-[#8a3a46]" />
              <span>{deliveryTime ? (ar ? `شحن ${deliveryTime}` : `${deliveryTime} shipping`) : (ar ? 'شحن 2–5 أيام' : '2–5 day shipping')}</span>
            </div>
            <div className="flex flex-1 min-w-[130px] items-center gap-2 rounded-2xl bg-[#fbe9e3] px-3.5 py-2.5 text-xs font-bold text-[#5a2230] dark:bg-secondary/60 dark:text-foreground">
              <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-[#8a3a46]" />
              <span>{ar ? 'أصلي 100%' : '100% authentic'}</span>
            </div>
            <div className="flex flex-1 min-w-[130px] items-center gap-2 rounded-2xl bg-[#fbe9e3] px-3.5 py-2.5 text-xs font-bold text-[#5a2230] dark:bg-secondary/60 dark:text-foreground">
              <RotateCcw className="h-4.5 w-4.5 shrink-0 text-[#8a3a46]" />
              <span>{ar ? 'إرجاع 14 يومًا' : '14-day returns'}</span>
            </div>
          </div>

          {/* shipping & returns accordion with leaf doodle list */}
          <details className="group rounded-[18px_14px_20px_16px] border-1.5 border-[#ecd9d1] bg-white overflow-hidden dark:bg-card dark:border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2.5 p-4 text-sm font-bold text-[#3a2226] select-none dark:text-foreground">
              <span>{ar ? 'معلومات الشحن والاسترجاع' : 'Shipping & Returns Information'}</span>
              <ChevronDown className="h-4 w-4 text-[#8a6d70] transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="border-t border-[#ecd9d1]/60 px-4 pb-4 pt-3 dark:border-border/60">
              <ul className="grid gap-2 text-xs font-semibold text-[#5c4448] dark:text-muted-foreground">
                <li className="flex items-start gap-2">
                  <LeafDoodle className="h-4 w-4 shrink-0 text-[#6f8f5e] mt-0.5" />
                  <span>{ar ? 'شحن لكل المحافظات خلال 2–5 أيام عمل' : 'Fast shipping to all governorates within 2–5 working days'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <LeafDoodle className="h-4 w-4 shrink-0 text-[#6f8f5e] mt-0.5" />
                  <span>{ar ? 'الدفع عند الاستلام متاح لجميع المحافظات' : 'Cash on delivery available nationwide'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <LeafDoodle className="h-4 w-4 shrink-0 text-[#6f8f5e] mt-0.5" />
                  <span>{ar ? 'استبدال أو إرجاع خلال 14 يومًا' : 'Free 14-day exchange or returns'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <LeafDoodle className="h-4 w-4 shrink-0 text-[#6f8f5e] mt-0.5" />
                  <span>{ar ? 'منتج أصلي 100% من موزعين معتمدين' : '100% genuine product from certified distributors'}</span>
                </li>
              </ul>
              <div className="mt-3 text-start">
                <Link href="/info/shipping" className="text-xs font-bold text-[#8a3a46] underline-offset-4 hover:underline">
                  {ar ? 'التفاصيل الكاملة ←' : 'Full details →'}
                </Link>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Product Reviews */}
      <ProductReviews slug={product.slug} rating={product.rating} reviewsCount={product.reviews} />

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          images={images}
          index={Math.min(imgIdx, images.length - 1)}
          onClose={() => setLightbox(false)}
          onIndexChange={select}
          alt={name}
        />
      )}

      {/* Sticky Mobile Add to Cart Bar */}
      <div
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[#ecd9d1] bg-white/95 p-3 shadow-[0_-8px_24px_rgba(90,34,48,0.1)] backdrop-blur md:hidden dark:bg-card/95 dark:border-border"
        data-testid="sticky-atc"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <img src={activeImg} alt={name} aria-hidden className="h-11 w-11 rounded-xl border border-border/60 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#5a2230] dark:text-foreground">{name}</p>
            <p className="text-sm font-extrabold text-[#8a3a46]">
              {(product.price * qty).toLocaleString('en-US')} {currency || t.egp}
              {discount > 0 && product.compareAt ? (
                <del className="mr-1.5 text-[11px] font-bold text-muted-foreground">
                  {(product.compareAt * qty).toLocaleString('en-US')}
                </del>
              ) : null}
            </p>
          </div>
          {product.stock > 0 && (
            <a
              href={`https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                [
                  'مرحبًا LUBNÉL 🌸',
                  'أود طلب هذا المنتج عبر واتساب:',
                  `• ${name}`,
                  `• السعر: ${product.price.toLocaleString('en-US')} ${currency || t.egp}`,
                  `• الكمية: ${qty}`,
                  typeof window !== 'undefined' ? `• الرابط: ${window.location.href}` : '',
                ].filter(Boolean).join('\n')
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="طلب فوري عبر واتساب"
              title="طلب فوري عبر واتساب"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-emerald-500/50 bg-[#e9f7ee] text-[#17663b] shadow-xs transition-transform active:scale-95 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <MessageCircle className="h-5 w-5 text-[#2fa866]" />
            </a>
          )}
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={() => addToCart()}
            className="lubnel-btn-shimmer flex h-11 items-center gap-1.5 rounded-full bg-[#8a3a46] px-5 text-sm font-extrabold text-white shadow-md shadow-[#8a3a46]/25 disabled:opacity-50"
          >
            <ShoppingBag className="h-4.5 w-4.5" aria-hidden />
            <span>{product.stock <= 0 ? (ar ? 'نفدت' : 'Sold out') : (ar ? 'أضيفي للسلة' : t.addToBag)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
