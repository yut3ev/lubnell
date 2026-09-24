import { confirmDialog } from '@/components/ui/confirm-service';
"use client";

// LUBNÉL storefront views: home, shop, product, cart, wishlist, static pages
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Eye, Flower2, Gift, Heart,
  ListFilter, Mail, MapPin, Maximize2, MessageCircle, Minus, Package, Phone, Plus, Search, Send,
  Share2, ShieldCheck, ShoppingBag, Sparkles, Tags, ThumbsUp, Trash2, Truck, ShieldCheck as Shield2, X,
} from "lucide-react";
import { toast } from "sonner";
import { compressImage, money, normalizeEgyptPhone, searchScore, usePersistedState } from "@/lib/lubnel-helpers";
import { HeroSlider, ProductCard, Stars } from "@/components/lubnel/chrome";
import {
  CATEGORY_LABELS_AR, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, WHATSAPP_NUMBER,
  ORDER_STATUS_LABELS,
  type CartItem, type FeaturedReview, type Product, type HeroSlide, type RatingSummary, type StoreCategory, type StoreOffer, type TrackedOrder,
} from "@/lib/lubnel-types";

type Review = { id: string; productId: string; name: string; text: string; rating: number; image?: string | null; helpfulCount?: number; voted?: boolean; createdAt?: string };

// R46 — one card of the PDP "visitors also saved" cross-sell rail (server
// truth from /api/store/products/also-saved; count = all-time adds)
type AlsoSavedItem = { id: string; name: string; nameAr: string; price: number; oldPrice?: number | null; image: string; alt?: string | null; count: number; railOrders?: number };

// R60 — the rail scroll-state measure (R58) and the card anatomy (R46/R59)
// extracted so the cart "كمّلي حقيبتكِ" strip shares the PDP rail's exact
// honest-scroll contract and card family — same classes, same semantics, one
// source of truth. The strip's anchor-less cards simply omit onPull: rail
// attribution stays a PDP concept (a bag has no "from" product; faking one
// would corrupt the studio board's anchored semantics).
function useRailScroll(deps: readonly unknown[]) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [railScroll, setRailScroll] = useState({ scrollable: false, atStart: true, atEnd: true });
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const abs = Math.abs(el.scrollLeft);
      const scrollable = el.scrollWidth > el.clientWidth + 1;
      setRailScroll({
        scrollable,
        atStart: abs <= 1,
        atEnd: !scrollable || abs + el.clientWidth >= el.scrollWidth - 1,
      });
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("resize", onScroll, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", onScroll);
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, deps);
  return { railRef, railScroll };
}

function AlsoSavedCards({ items, ar, onPull }: { items: AlsoSavedItem[]; ar: boolean; onPull?: (target: string) => void }) {
  return (
    <>
      {items.map((p, i) => (
        <a key={p.id} href={`#/product/${p.id}`} className="also-saved-card" style={{ "--i": i } as CSSProperties}
          onClick={() => onPull?.(p.id)}>
          <span className="also-saved-img"><img src={p.image} alt={p.alt || p.nameAr} loading="lazy" decoding="async" /></span>
          <span className="also-saved-name">{ar ? p.nameAr : p.name}</span>
          <span className="also-saved-meta">
            <strong>{money(p.price)}</strong>
            <span className="also-saved-count"><Heart size={12} /> {ar
              ? p.count === 1 ? "حُفظت مرة" : p.count === 2 ? "حُفظت مرتين" : p.count <= 10 ? `حُفظت ${p.count} مرات` : `حُفظت ${p.count} مرة`
              : `${p.count} ${p.count === 1 ? "save" : "saves"}`}</span>
          </span>
          {(p.railOrders || 0) > 0 && (
            <span className="also-saved-ordered" title={ar ? "طلبات وصلت من زوار عرفوا المنتج عبر الاقتراحات" : "Orders from visitors who discovered this product via the suggestions rail"}>
              <ShoppingBag size={12} /> {ar
                ? p.railOrders === 1 ? "طلب عبر الاقتراحات" : p.railOrders === 2 ? "طلبان عبر الاقتراحات" : p.railOrders! <= 10 ? `${p.railOrders} طلبات عبر الاقتراحات` : `${p.railOrders} طلبًا عبر الاقتراحات`
                : p.railOrders === 1 ? "Ordered via suggestions" : `${p.railOrders} orders via suggestions`}
            </span>
          )}
        </a>
      ))}
    </>
  );
}

// Review highlights: stem groups scanned across review text (AR stems + EN words).
// A review can feed several groups; chips show how many reviewers mentioned each theme.
const HL_GROUPS: { key: string; labelAr: string; labelEn: string; icon: typeof Sparkles; stems: string[] }[] = [
  { key: "scent", labelAr: "الرائحة", labelEn: "Scent", icon: Flower2, stems: ["رائح", "ريح", "عطر", "scent", "smell", "fragrance"] },
  { key: "quality", labelAr: "الجودة", labelEn: "Quality", icon: BadgeCheck, stems: ["جودة", "ممتاز", "رائع", "أنيق", "quality", "excellent", "amazing"] },
  { key: "results", labelAr: "النتائج", labelEn: "Results", icon: Sparkles, stems: ["نتيجة", "نتائج", "فرق", "result", "difference"] },
  { key: "packaging", labelAr: "التغليف", labelEn: "Packaging", icon: Package, stems: ["تغليف", "علبة", "packaging", "box", "package"] },
  { key: "shipping", labelAr: "التوصيل", labelEn: "Delivery", icon: Truck, stems: ["توصيل", "شحن", "وصلت", "وصلني", "shipping", "delivery", "arrived"] },
  { key: "worth", labelAr: "يستاهل السعر", labelEn: "Worth it", icon: Tags, stems: ["يستاهل", "تستاهل", "سعر", "price", "worth"] },
];

// Aggregate rating distribution + theme highlights from the live review list
function ratingSnapshot(list: Review[]) {
  const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of list) dist[Math.min(5, Math.max(1, r.rating))] += 1;
  const highlights = HL_GROUPS.map(group => {
    const count = list.filter(review => {
      const text = `${review.text} ${review.name}`.toLowerCase();
      return group.stems.some(stem => text.includes(stem));
    }).length;
    return { ...group, count };
  }).filter(h => h.count > 0).sort((a, b) => b.count - a.count).slice(0, 4);
  return { dist, highlights };
}

// Anonymous visitor id — lets a browser toggle its own "helpful" vote exactly once per review
function getClientId(): string {
  try {
    let id = window.localStorage.getItem("lubnel-client-id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem("lubnel-client-id", id);
    }
    return id;
  } catch { return "anon"; }
}

function readRecentIds(): string[] {
  try { return JSON.parse(window.localStorage.getItem("lubnel-recent-ids") || "[]"); } catch { return []; }
}

// ──────────────────────────────────────────────── Review photo lightbox
// Fullscreen viewer for customer review photos: backdrop blur, keyboard nav
// (←/→/Esc), counter, caption with the review quote. dir-aware arrows.
function ReviewLightbox({ lang, reviews, index, onIndex, close }: {
  lang: "ar" | "en"; reviews: Review[]; index: number; onIndex: (i: number) => void; close: () => void;
}) {
  const ar = lang === "ar";
  const total = reviews.length;
  const go = (dir: number) => onIndex((index + dir + total) % total);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(ar ? -1 : 1);
      if (e.key === "ArrowLeft") go(ar ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [index, total, ar, close]);
  const review = reviews[index];
  if (!review) return null;
  return (
    <div className="review-lightbox" onClick={close} role="dialog" aria-modal="true" aria-label={ar ? `صورة من تقييم ${review.name}` : `Review photo by ${review.name}`}>
      <button className="lightbox-close" onClick={close} aria-label={ar ? "إغلاق العارض" : "Close viewer"}><X size={19} /></button>
      {total > 1 && (
        <>
          <button className="lightbox-nav nav-prev" onClick={e => { e.stopPropagation(); go(-1); }} aria-label={ar ? "الصورة السابقة" : "Previous photo"}>{ar ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}</button>
          <button className="lightbox-nav nav-next" onClick={e => { e.stopPropagation(); go(1); }} aria-label={ar ? "الصورة التالية" : "Next photo"}>{ar ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}</button>
        </>
      )}
      <figure className="lightbox-figure" onClick={e => e.stopPropagation()} key={index}>
        <img src={review.image || undefined} alt={ar ? `صورة مشاركتها ${review.name} ضمن تقييمها` : `Photo shared by ${review.name} in their review`} loading="lazy" decoding="async" />
        <figcaption>
          <div className="lightbox-caption-top">
            <span className="stars" aria-hidden>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
            <strong>{review.name}</strong>
            <span className="lightbox-counter">{index + 1} / {total}</span>
          </div>
          <p>“{review.text}”</p>
        </figcaption>
      </figure>
    </div>
  );
}

// ──────────────────────────────────────────────── Product quick view
// Compact modal from the shop/home grid: image, real rating, price, qty stepper,
// add-to-bag — without leaving the grid. Esc / backdrop / ✕ all close it.
// When the grid has more than one product, prev/next arrows (buttons, ←/→ keys,
// and touch swipe on the photo) flip between products without closing.
function QuickViewModal({ lang, product, rating, close, addToCart, onPrev, onNext, position }: {
  lang: "ar" | "en"; product: Product; rating?: RatingSummary; close: () => void; addToCart: (p: Product) => void;
  onPrev?: () => void; onNext?: () => void; position?: string;
}) {
  const ar = lang === "ar";
  const [qty, setQty] = useState(1);
  // new product flipped in → restart the stepper at 1 (render-time state adjustment,
  // the documented alternative to a setState-in-effect cascade)
  const [lastProductId, setLastProductId] = useState(product.id);
  if (lastProductId !== product.id) { setLastProductId(product.id); setQty(1); }
  // touch swipe on the photo (RTL flips the direction)
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") { if (ar) onPrev?.(); else onNext?.(); }
      if (e.key === "ArrowLeft") { if (ar) onNext?.(); else onPrev?.(); }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [close, onPrev, onNext, ar]);
  const salePct = product.oldPrice && product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return (
    <div className="qv-overlay" onClick={close} role="dialog" aria-modal="true" aria-label={ar ? `نظرة سريعة على ${product.nameAr}` : `Quick view: ${product.name}`}>
      <div className="qv-dialog" onClick={e => e.stopPropagation()}>
        <button className="qv-close" onClick={close} aria-label={ar ? "إغلاق" : "Close"}><X size={17} /></button>
        {onPrev && <button className="qv-nav qv-prev" onClick={onPrev} aria-label={ar ? "المنتج السابق" : "Previous product"}>{ar ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>}
        {onNext && <button className="qv-nav qv-next" onClick={onNext} aria-label={ar ? "المنتج التالي" : "Next product"}>{ar ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>}
        {position && <span className="qv-counter" aria-hidden>{position}</span>}
        <div className="qv-media qv-swap" key={`m-${product.id}`}
          onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={e => {
            const start = touchX.current; touchX.current = null;
            if (start === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(dx) < 44) return;
            if (ar) { if (dx < 0) onPrev?.(); else onNext?.(); }
            else { if (dx < 0) onNext?.(); else onPrev?.(); }
          }}
        >
          <img src={product.image} alt={product.alt || product.nameAr || product.name} fetchPriority="high" decoding="async" />
          {product.badge && <span className="product-badge">{ar ? product.badgeAr : product.badge}</span>}
          {salePct > 0 && <span className="sale-pct">−{salePct}%</span>}
        </div>
        <div className="qv-info qv-swap" key={`i-${product.id}`}>
          <span className="eyebrow">{ar ? product.categoryAr : product.category} / LUBNÉL</span>
          <h3>{ar ? product.nameAr : product.name}</h3>
          {rating && rating.count > 0
            ? <Stars average={rating.average} count={rating.count} lang={lang} />
            : <span className="rating-none"><Sparkles size={13} /> {ar ? "كوني أول من يقيّم هذا المنتج" : "Be the first to review"}</span>}
          <div className="qv-price">
            <strong>{money(product.price)}</strong>
            {product.oldPrice && <del>{money(product.oldPrice)}</del>}
          </div>
          <p className="qv-desc">{product.description}</p>
          <div className="qv-actions">
            <div className="quantity">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label={ar ? "أقل" : "less"}><Minus size={14} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock || 99, qty + 1))} aria-label={ar ? "أكثر" : "more"}><Plus size={14} /></button>
            </div>
            <button
              className="button button-dark grow"
              disabled={product.stock <= 0}
              onClick={() => { for (let i = 0; i < qty; i++) addToCart(product); close(); toast.success(ar ? "أُضيف إلى حقيبتكِ" : "Added to your bag"); }}
            >
              {product.stock <= 0 ? (ar ? "غير متوفر" : "Sold out") : (ar ? "أضيفي للحقيبة" : "Add to bag")}<ShoppingBag size={15} />
            </button>
          </div>
          <a href={`#/product/${product.id}`} className="qv-details" onClick={close}>
            {ar ? "التفاصيل الكاملة والتقييمات" : "Full details & reviews"}<ArrowLeft size={14} />
          </a>
          <div className="qv-perks">
            <span><Truck size={13} />{ar ? "شحن ٢–٥ أيام" : "Ships in 2–5 days"}</span>
            <span><ShieldCheck size={13} />{ar ? "منتجات أصلية 100٪" : "100% authentic"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────── Product card skeleton
// Shimmer placeholder shown in the shop grid while the bootstrap payload loads.
function ProductCardSkeleton() {
  return (
    <div className="product-skeleton" aria-hidden="true">
      <div className="sk-media" />
      <div className="sk-body">
        <span className="sk-line w-64" />
        <span className="sk-line w-42" />
        <span className="sk-line w-30" />
      </div>
    </div>
  );
}

async function fetchReviews(productId: string): Promise<Review[]> {
  try {
    const clientId = getClientId();
    const res = await fetch(`/api/store/reviews?productId=${encodeURIComponent(productId)}&clientId=${encodeURIComponent(clientId)}`);
    return await res.json();
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────── Featured testimonials
// Pinned reviews curated from the admin studio — fetched separately so the
// section streams in progressively and never blocks the bootstrap payload.
function FeaturedReviewsSection({ lang }: { lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const [reviews, setReviews] = useState<FeaturedReview[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/store/reviews?featured=1", { cache: "no-store" })
      .then(res => res.json())
      .then(data => { if (!cancelled) setReviews(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setReviews([]); });
    return () => { cancelled = true; };
  }, []);
  if (reviews !== null && reviews.length === 0) return null;
  return (
    <section className="testimonials" aria-label={ar ? "آراء عملائنا" : "Customer testimonials"}>
      <div className="shofy-heading">
        <div><span className="shofy-kicker">LUBNÉL / LOVE NOTES</span><h2>{ar ? "قال عنّا عميلاتنا" : "Loved, reviewed, repinned"}</h2></div>
        <span className="testimonials-badge"><BadgeCheck size={14} /> {ar ? "تقييمات موثّقة من شراء حقيقي" : "Verified real-order reviews"}</span>
      </div>
      <div className="testimonials-grid">
        {reviews === null
          ? Array.from({ length: 3 }).map((_, i) => <div className="testimonial-card is-skeleton" key={`sk-${i}`} aria-hidden><span className="sk sk-stars" /><span className="sk sk-text" /><span className="sk sk-text short" /><span className="sk sk-foot" /></div>)
          : reviews.map(review => (
            <article className="testimonial-card" key={review.id}>
              <span className="testimonial-mark" aria-hidden>”</span>
              <span className="testimonial-stars" aria-label={`${review.rating} من 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              <blockquote>{review.text}</blockquote>
              <footer>
                <span className="testimonial-avatar" aria-hidden>{review.name[0]}</span>
                <span className="testimonial-who">
                  <strong>{review.name}</strong>
                  {review.productTitle && (
                    <a href={`#/product/${review.productId}`} className="testimonial-product">
                      {review.productImage && <img src={review.productImage} alt="" aria-hidden loading="lazy" decoding="async" />}
                      <span>{review.productTitle}</span>
                    </a>
                  )}
                </span>
                <span className="testimonial-verified" title={ar ? "تقييم موثّق" : "Verified review"}><BadgeCheck size={15} /> {ar ? "موثّق" : "Verified"}</span>
              </footer>
            </article>
          ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────── Home
export function HomeView({ lang, products, slides, categories, offers, ratings, wishCounts = {}, wishIds, toggleWish, addToCart, onCopyOffer, initialSlideId }: {
  lang: "ar" | "en"; products: Product[]; slides: HeroSlide[]; categories: StoreCategory[]; offers: StoreOffer[]; ratings: Record<string, RatingSummary>;
  wishCounts?: Record<string, number>; wishIds: string[]; toggleWish: (id: string) => void; addToCart: (p: Product) => void; onCopyOffer: (code: string) => void; initialSlideId?: string;
}) {
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  // quick-view stores the grid list + index so arrows can flip between its products
  const [quickView, setQuickView] = useState<{ list: Product[]; index: number } | null>(null);
  const openQv = (list: Product[], index: number) => setQuickView({ list, index });
  const qvProduct = quickView ? quickView.list[quickView.index] : undefined;
  useEffect(() => { setRecentIds(readRecentIds()); }, []);
  const featureItems = [
    [<Truck size={26} key="t" />, ar ? "شحن سريع لكل مصر" : "Fast delivery nationwide", ar ? "توصيل خلال 2–5 أيام" : "2–5 business days"],
    [<Shield2 size={26} key="s" />, ar ? "منتجات أصلية 100٪" : "100% authentic", ar ? "اختيارات موثوقة بعناية" : "Carefully trusted edits"],
    [<MessageCircle size={26} key="m" />, ar ? "دعم على مدار اليوم" : "Dedicated support", ar ? "نحن هنا لمساعدتكِ" : "We are here to help"],
    [<Tags size={26} key="g" />, ar ? "عروض أسبوعية" : "Weekly offers", ar ? "خصومات لا تفوّت" : "Special savings"],
  ];
  const best = products.filter(p => p.featured).slice(0, 4);
  const bestShown = best.length >= 4 ? best : [...best, ...products.filter(p => !p.featured).slice(0, 4 - best.length)];
  const arrivals = products.slice(-4).reverse();
  // Inline tabber: each tab computes its own edit of 4 products without leaving the home page
  const byRating = [...products].sort((a, b) => {
    const ra = ratings[a.id]; const rb = ratings[b.id];
    const avgA = ra && ra.count > 0 ? ra.average : -1; const avgB = rb && rb.count > 0 ? rb.average : -1;
    const cntA = ra?.count || 0; const cntB = rb?.count || 0;
    return avgB - avgA || cntB - cntA;
  });
  const topRated = byRating.filter(p => ratings[p.id]?.count > 0).slice(0, 4);
  // Backfill the tab row with newest arrivals so the grid never looks broken while few reviews exist
  const topRatedShown = topRated.length >= 4 ? topRated : [...topRated, ...arrivals.filter(p => !topRated.some(r => r.id === p.id)).slice(0, 4 - topRated.length)];
  const onSale = products.filter(p => p.oldPrice).slice(0, 4);
  const [homeTab, setHomeTab] = useState<"trending" | "new" | "rated" | "offers">("trending");
  const tabEdits = {
    trending: { items: bestShown, sort: "best" },
    new: { items: arrivals, sort: "new" },
    rated: { items: topRatedShown, sort: "rating" },
    offers: { items: onSale, sort: "offers" },
  } as const;
  const activeEdit = tabEdits[homeTab];
  const recentProducts = recentIds.map(pid => products.find(p => p.id === pid)).filter((p): p is Product => Boolean(p)).slice(0, 6);
  const subscribe = async () => {
    if (!email.trim()) return toast.error(ar ? "اكتبي بريدك أولًا" : "Enter your email first");
    try {
      const res = await fetch("/api/store/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(ar ? "تم تسجيل بريدكِ بنجاح" : "You're on the list");
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <main className="shofy-home">
      <HeroSlider lang={lang} slides={slides} initialSlideId={initialSlideId} />
      <section className="shofy-feature-strip">
        {featureItems.map(([icon, title, sub], i) => (
          <div key={i}><span className="feature-icon">{icon}</span><span><b>{title as string}</b><small>{sub as string}</small></span></div>
        ))}
      </section>
      <OffersStrip lang={lang} offers={offers} onCopy={onCopyOffer} />
      <section className="shofy-section shofy-categories">
        <div className="shofy-heading">
          <div><span className="shofy-kicker">{ar ? "تسوّقي حسب الفئة" : "SHOP BY CATEGORY"}</span><h2>{ar ? "اكتشفي عالم LUBNÉL" : "Explore the LUBNÉL edit"}</h2></div>
          <a href="#/shop" className="shofy-view">{ar ? "كل الفئات" : "View all"}<ArrowLeft size={15} /></a>
        </div>
        <div className="popular-grid">
          {categories.map(category => {
            const count = products.filter(p => p.category === category.name).length;
            return (
              <a href={`#/shop?category=${encodeURIComponent(category.name)}`} className="popular-card" key={category.slug}>
                <div className="popular-image"><img src={category.imageUrl || "/images/cat-sets.webp"} alt={ar ? category.nameAr : category.name} loading="lazy" decoding="async" /></div>
                <strong>{ar ? category.nameAr : category.name}</strong>
                <span>{ar ? (count > 0 ? `${count} منتجات` : "قريبًا") : count > 0 ? `${count} products` : "Coming soon"}</span>
              </a>
            );
          })}
        </div>
      </section>
      <section className="shofy-section shofy-products">
        <div className="shofy-heading">
          <div><span className="shofy-kicker">LUBNÉL / CURATED FOR YOU</span><h2>{ar ? "الأكثر مبيعًا" : "Best sellers"}</h2></div>
          <div className="product-tabs" role="tablist" aria-label={ar ? "تصفيات المنتجات" : "Product edits"}>
            {([
              ["trending", ar ? "الأكثر طلبًا" : "Trending"],
              ["new", ar ? "وصل حديثًا" : "New arrivals"],
              ["rated", ar ? "الأعلى تقييمًا" : "Top rated"],
              ["offers", ar ? "العروض" : "On sale"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                aria-selected={homeTab === tab}
                className={homeTab === tab ? "active" : ""}
                onClick={() => setHomeTab(tab)}
              >
                {label}
                {tab === "rated" && <span className="tab-star" aria-hidden>★</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="product-grid shofy-product-grid" key={homeTab}>
          {activeEdit.items.map((p, i) => <ProductCard key={p.id} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} isWish={wishIds.includes(p.id)} toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} onQuickView={() => openQv(activeEdit.items, i)} />)}
        </div>
        <div className="tab-cta-row">
          <a href={`#/shop?sort=${activeEdit.sort}`} className="shofy-view">
            {homeTab === "rated" ? (ar ? "شاهدي كل الأعلى تقييمًا" : "Shop all top rated")
              : homeTab === "offers" ? (ar ? "شاهدي كل العروض" : "Shop all offers")
              : homeTab === "new" ? (ar ? "شاهدي كل الجديد" : "Shop all new in")
              : (ar ? "شاهدي كل الأكثر مبيعًا" : "Shop all best sellers")}
            <ArrowLeft size={15} />
          </a>
        </div>
      </section>
      <section className="shofy-promo-grid">
        <a href="#/shop?category=Skincare" className="shofy-promo promo-one">
          <img src="/images/hero-2.png" alt="Skincare edit" loading="lazy" decoding="async" />
          <div><span>{ar ? "العناية اليومية" : "THE DAILY RITUAL"}</span><h3>{ar ? "بشرة تشعرين بها." : "Skin that feels like you."}</h3><b>{ar ? "اكتشفي العناية" : "Discover skincare"}<ArrowLeft size={14} /></b></div>
        </a>
        <a href="#/shop?sort=offers" className="shofy-promo promo-two">
          <img src="/images/hero-3.webp" alt="LUBNÉL offers" loading="lazy" decoding="async" />
          <div><span>{ar ? "عرض الأسبوع" : "WEEKLY OFFER"}</span><h3>{ar ? "حتى 20٪ خصم" : "Up to 20% off"}</h3><b>{ar ? "تسوّقي العروض" : "Shop offers"}<ArrowLeft size={14} /></b></div>
        </a>
      </section>
      <section className="shofy-section shofy-products arrivals">
        <div className="shofy-heading">
          <div><span className="shofy-kicker">{ar ? "اختيارات جديدة" : "JUST LANDED"}</span><h2>{ar ? "وصل حديثًا" : "New arrivals"}</h2></div>
          <a href="#/shop?sort=new" className="shofy-view">{ar ? "شاهدي الكل" : "Shop new in"}<ArrowLeft size={15} /></a>
        </div>
        <div className="product-grid shofy-product-grid">
          {arrivals.map((p, i) => <ProductCard key={p.id} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} isWish={wishIds.includes(p.id)} toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} onQuickView={() => openQv(arrivals, i)} />)}
        </div>
      </section>
      <FeaturedReviewsSection lang={lang} />
      {recentProducts.length >= 2 && (
        <section className="recent-strip" aria-label={ar ? "شاهدتي مؤخرًا" : "Recently viewed"}>
          <div className="shofy-heading">
            <div><span className="shofy-kicker">{ar ? "من زيارتي السابقة" : "PICK UP WHERE YOU LEFT"}</span><h2>{ar ? "شاهدتي مؤخرًا" : "Recently viewed"}</h2></div>
          </div>
          <div className="recent-row">
            {recentProducts.map((p, i) => <ProductCard key={`recent-${p.id}`} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} isWish={wishIds.includes(p.id)} toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} onQuickView={() => openQv(recentProducts, i)} />)}
          </div>
        </section>
      )}
      <section className="shofy-newsletter">
        <div>
          <span className="shofy-kicker">LUBNÉL / THE EDIT</span>
          <h2>{ar ? "خذي وقتكِ." : "Take your time."}</h2>
          <p>{ar ? "اشتركي في نشرتنا لتحصلي على إلهام الجمال، الوصول المبكر، وعروض خاصة." : "Join our edit for beauty notes, early access, and considered offers."}</p>
        </div>
        <div className="shofy-subscribe">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder={ar ? "بريدك الإلكتروني" : "Your email address"} type="email" />
          <button onClick={subscribe}>{ar ? "اشتراك" : "Subscribe"}<ArrowLeft size={15} /></button>
        </div>
      </section>
      {qvProduct && quickView && (
        <QuickViewModal
          lang={lang} product={qvProduct} rating={ratings[qvProduct.id]} close={() => setQuickView(null)} addToCart={addToCart}
          onPrev={quickView.list.length > 1 ? () => setQuickView(qv => qv && { list: qv.list, index: (qv.index - 1 + qv.list.length) % qv.list.length }) : undefined}
          onNext={quickView.list.length > 1 ? () => setQuickView(qv => qv && { list: qv.list, index: (qv.index + 1) % qv.list.length }) : undefined}
          position={`${quickView.index + 1} / ${quickView.list.length}`}
        />
      )}
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────── Shop
const CATEGORY_KEYS = ["Makeup", "Skincare", "Fragrance", "Body Care", "Eyes", "Lips", "Sets"];

export function ShopView({ lang, products, categories = [], wishCounts = {}, wishIds, toggleWish, addToCart, initialCategory = "", initialSort = "", ratings = {}, loading = false }: {
  lang: "ar" | "en"; products: Product[]; categories?: StoreCategory[]; wishCounts?: Record<string, number>; wishIds: string[]; toggleWish: (id: string) => void; addToCart: (p: Product) => void;
  initialCategory?: string; initialSort?: string; ratings?: Record<string, RatingSummary>; loading?: boolean;
}) {
  const ar = lang === "ar";
  // component is remounted with key={params} on route change, so derive initial state directly
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort || "featured");
  const [minPrice, setMinPrice] = useState(0);
  const [price, setPrice] = useState(1000);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [saleOnly, setSaleOnly] = useState(false);
  // R26 — shareable collection deep link when a known category filter is active
  const [collShareOpen, setCollShareOpen] = useState(false);
  const catShare = categories.find(c => c.name === category);
  const collShareUrl = catShare ? `${window.location.origin}/c/${catShare.slug}` : "";

  const filtered = useMemo(() => {
    let list = products.filter(p =>
      (!category || p.category === category) && p.price >= minPrice && p.price <= price &&
      (!availableOnly || p.stock > 0) && (!saleOnly || (p.oldPrice && p.oldPrice > p.price)) &&
      (!search.trim() || searchScore(p, search) > 0));
    if (search.trim()) list = list.sort((a, b) => searchScore(b, search) - searchScore(a, search));
    if (sort === "new") list = [...list].reverse();
    if (sort === "best") list = list.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.stock - a.stock);
    if (sort === "trending") list = list.sort((a, b) => (b.shareCount || 0) - (a.shareCount || 0) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    // R48 — "most saved": the wishlist demand signal becomes a shopping lens.
    // Same adds-only aggregate the cards' teal badges carry; featured wins ties
    // so a tie never looks random.
    if (sort === "saved") list = list.sort((a, b) => (wishCounts[b.id] || 0) - (wishCounts[a.id] || 0) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    if (sort === "offers") list = list.filter(p => p.oldPrice);
    if (sort === "price-low") list = list.sort((a, b) => a.price - b.price);
    if (sort === "price-high") list = list.sort((a, b) => b.price - a.price);
    if (sort === "rating") {
      // Highest average first; more votes win ties; products without reviews sink to the end
      const rank = (p: Product) => {
        const r = ratings[p.id];
        return r && r.count > 0 ? [r.average, r.count] : [-1, 0];
      };
      list = [...list].sort((a, b) => {
        const [avgA, cntA] = rank(a); const [avgB, cntB] = rank(b);
        return avgB - avgA || cntB - cntA;
      });
    }
    return list;
  }, [products, category, minPrice, price, sort, search, availableOnly, saleOnly, ratings, wishCounts]);

  // Top-rated podium: when sorting by rating, stamp #1/#2/#3 gold chips on the three leaders
  const rankMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (sort !== "rating") return map;
    filtered
      .filter(p => ratings[p.id] && ratings[p.id].count > 0)
      .slice(0, 3)
      .forEach((p, i) => { map[p.id] = i + 1; });
    return map;
  }, [filtered, sort, ratings]);

  // Trending podium: same idea for the "trending" sort — top-3 most-shared get rose chips
  const trendMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (sort !== "trending") return map;
    filtered
      .filter(p => (p.shareCount || 0) > 0)
      .slice(0, 3)
      .forEach((p, i) => { map[p.id] = i + 1; });
    return map;
  }, [filtered, sort]);

  // quick-view works on the filtered list index so prev/next follows the current sort/filters
  const [qvIndex, setQvIndex] = useState<number | null>(null);
  const qvProduct = qvIndex !== null ? filtered[qvIndex] : undefined;

  // only categories that actually have products (reflects the real inventory)
  const presentCategories = useMemo(() => CATEGORY_KEYS.filter(c => products.some(p => p.category === c)), [products]);
  const priceMin = useMemo(() => Math.min(...products.map(p => p.price), 0), [products]);
  const priceMax = useMemo(() => Math.max(...products.map(p => p.price), 200), [products]);

  return (
    <main className="container shop-page">
      <div className="shop-hero">
        <div><span className="eyebrow">LUBNÉL / SHOP</span><h1>{ar ? "كل ما تحتاجه طقوسكِ" : "Everything for your ritual."}</h1></div>
        <p>{ar ? "منتجات مختارة بعناية، من أول لمسة إلى آخر تفصيلة." : "A considered edit of makeup, skincare, fragrance, and the little details in between."}</p>
      </div>
      <div className="shop-toolbar">
        <button className="filter-button mobile-only" onClick={() => setFilterOpen(true)}><ListFilter size={17} />{ar ? "تصفية" : "Filter"}</button>
        <div className="category-pills">
          <button className={!category ? "active" : ""} onClick={() => setCategory("")}>{ar ? "الكل" : "All"}</button>
          {presentCategories.map(c => (
            <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{ar ? CATEGORY_LABELS_AR[c] : c}</button>
          ))}
        </div>
        <label className="sort-select">
          <span>{ar ? "ترتيب:" : "Sort:"}</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="featured">{ar ? "مختاراتنا" : "Featured"}</option>
            <option value="trending">{ar ? "الأكثر رواجًا ✦" : "Trending ✦"}</option>
            <option value="saved">{ar ? "الأكثر حفظًا ♥" : "Most saved ♥"}</option>
            <option value="rating">{ar ? "الأعلى تقييمًا" : "Top rated"}</option>
            <option value="new">{ar ? "الأحدث" : "Newest"}</option>
            <option value="best">{ar ? "الأكثر مبيعًا" : "Best sellers"}</option>
            <option value="price-low">{ar ? "السعر: الأقل" : "Price: low"}</option>
            <option value="price-high">{ar ? "السعر: الأعلى" : "Price: high"}</option>
            <option value="offers">{ar ? "العروض" : "Offers"}</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <div className="shop-layout">
        <aside className={`filter-sidebar ${filterOpen ? "open" : ""}`}>
          <div className="filter-head"><strong>{ar ? "تصفية" : "Filter"}</strong><button className="mobile-only icon-button" onClick={() => setFilterOpen(false)}><X size={18} /></button></div>
          <div className="filter-group">
            <span>{ar ? "ابحثي" : "Search"}</span>
            <div className="field-with-icon">
              <Search size={16} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? "جرّبي: روج، بوكس، سلاسل، معطر…" : "Try: lipstick, box, necklace…"} />
            </div>
          </div>
          <div className="filter-group">
            <div className="filter-label"><span>{ar ? "الفئات" : "Categories"}</span><ChevronDown size={15} /></div>
            {presentCategories.map(c => (
              <button className={`filter-check ${category === c ? "checked" : ""}`} onClick={() => setCategory(category === c ? "" : c)} key={c}>
                <span>{category === c ? <Check size={12} /> : null}</span>{ar ? CATEGORY_LABELS_AR[c] : c}
              </button>
            ))}
          </div>
          <label className="filter-check availability-check">
            <span>{availableOnly ? <Check size={12} /> : null}</span>
            <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} />
            {ar ? "المتاح فقط" : "In stock only"}
          </label>
          <label className="filter-check availability-check sale-check">
            <span>{saleOnly ? <Check size={12} /> : null}</span>
            <input type="checkbox" checked={saleOnly} onChange={e => setSaleOnly(e.target.checked)} />
            {ar ? "عليها خصم فقط" : "On sale only"}
          </label>
          <div className="filter-group">
            <div className="filter-label"><span>{ar ? "نطاق السعر" : "Price range"}</span><span>{money(minPrice)} — {money(price)}</span></div>
            <div className="dual-range">
              <input className="range" type="range" min={priceMin} max={Math.max(priceMax - 20, priceMin + 20)} step="10" value={minPrice} onChange={e => setMinPrice(Math.min(Number(e.target.value), price - 20))} aria-label="min price" />
              <input className="range" type="range" min={priceMin + 20} max={priceMax + 100} step="10" value={price} onChange={e => setPrice(Math.max(Number(e.target.value), minPrice + 20))} aria-label="max price" />
            </div>
            <div className="price-inputs">
              <label>{ar ? "من" : "From"}<input type="number" value={minPrice} onChange={e => setMinPrice(Math.max(0, Number(e.target.value)))} /></label>
              <label>{ar ? "إلى" : "To"}<input type="number" value={price} onChange={e => setPrice(Math.max(minPrice + 20, Number(e.target.value)))} /></label>
            </div>
          </div>
          <div className="filter-note"><Sparkles size={18} /><p>{ar ? "كل منتج في LUBNÉL مختار ليكون جزءًا من طقس حقيقي." : "Every LUBNÉL product is chosen to earn a place in your real ritual."}</p></div>
        </aside>
        <div className="shop-results">
          <div className="results-count">
            <span>{filtered.length} {ar ? "منتجات" : "products"}</span>
            {catShare && (
              <div className="share-wrap coll-share">
                <button className={`coll-share-btn ${collShareOpen ? "active" : ""}`} onClick={() => setCollShareOpen(v => !v)} aria-expanded={collShareOpen} aria-label={ar ? `مشاركة مجموعة ${catShare.nameAr}` : `Share the ${catShare.name} collection`}>
                  <Share2 size={13} />{ar ? "شاركي المجموعة" : "Share collection"}
                </button>
                {collShareOpen && (
                  <>
                    <button className="share-backdrop" aria-hidden tabIndex={-1} onClick={() => setCollShareOpen(false)} />
                    <div className="share-pop" role="menu" aria-label={ar ? "مشاركة عبر" : "Share via"}>
                      <span className="share-pop-title">{ar ? catShare.nameAr : `${catShare.name} collection`}</span>
                      <a role="menuitem" className="share-opt wa" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${ar ? catShare.nameAr : catShare.name} — LUBNÉL ✦ ${collShareUrl}`)}`} onClick={() => { setCollShareOpen(false); toast.success(ar ? "جارٍ فتح واتساب 🌸" : "Opening WhatsApp"); }}>
                        <MessageCircle size={15} />{ar ? "واتساب" : "WhatsApp"}
                      </a>
                      <a role="menuitem" className="share-opt fb" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(collShareUrl)}`} onClick={() => setCollShareOpen(false)}>
                        <Share2 size={15} />{ar ? "فيسبوك" : "Facebook"}
                      </a>
                      <a role="menuitem" className="share-opt x" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${ar ? catShare.nameAr : catShare.name} — LUBNÉL`)}&url=${encodeURIComponent(collShareUrl)}`} onClick={() => setCollShareOpen(false)}>
                        <Send size={15} />{ar ? "إكس (تويتر)" : "X (Twitter)"}
                      </a>
                      <button role="menuitem" className="share-opt copy" onClick={() => {
                        const url = collShareUrl;
                        const done = () => toast.success(ar ? "تم نسخ رابط المجموعة 🌸" : "Collection link copied");
                        const legacyCopy = () => {
                          const ta = document.createElement("textarea");
                          ta.value = url; document.body.appendChild(ta); ta.select();
                          try { document.execCommand("copy"); done(); } catch { toast.error(ar ? "تعذّر النسخ" : "Copy failed"); }
                          ta.remove();
                        };
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(url).then(done).catch(legacyCopy);
                        } else {
                          legacyCopy();
                        }
                        setCollShareOpen(false);
                      }}>
                        <Copy size={15} />{ar ? "نسخ الرابط" : "Copy link"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {(category || search || minPrice > 0 || price < 1000 || availableOnly || saleOnly) && (
              <button onClick={() => { setCategory(""); setSearch(""); setMinPrice(0); setPrice(1000); setAvailableOnly(false); setSaleOnly(false); }}>
                {ar ? "مسح الفلاتر" : "Clear filters"} <X size={13} />
              </button>
            )}
          </div>
          <div className="product-grid shop-grid">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={`sk-${i}`} />)
              : filtered.map((p, i) => <ProductCard key={p.id} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} rank={rankMap[p.id]} trendRank={trendMap[p.id]} isWish={wishIds.includes(p.id)} toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} onQuickView={() => setQvIndex(i)} />)}
          </div>
          {!loading && filtered.length === 0 && (
            <div className="large-empty"><Search size={30} /><h3>{ar ? "لا توجد منتجات مطابقة" : "No products found"}</h3><p>{ar ? "جرّبي تغيير الفلاتر أو البحث عن شيء آخر." : "Try changing your filters or searching for something else."}</p></div>
          )}
        </div>
      </div>
      {qvProduct && qvIndex !== null && filtered.length > 0 && (
        <QuickViewModal
          lang={lang} product={qvProduct} rating={ratings[qvProduct.id]} close={() => setQvIndex(null)} addToCart={addToCart}
          onPrev={filtered.length > 1 ? () => setQvIndex(i => (i !== null ? (i - 1 + filtered.length) % filtered.length : null)) : undefined}
          onNext={filtered.length > 1 ? () => setQvIndex(i => (i !== null ? (i + 1) % filtered.length : null)) : undefined}
          position={`${qvIndex + 1} / ${filtered.length}`}
        />
      )}
    </main>
  );
}

// ──────────────────────────────────────────────────────────── Product page
function ProductRitual({ lang, product, reviews, setReviews, onAddReview }: {
  lang: "ar" | "en"; product: Product; reviews: Review[]; setReviews: (updater: (list: Review[]) => Review[]) => void; onAddReview: (r: { name: string; text: string; rating: number; image?: string }) => Promise<void>;
}) {
  const ar = lang === "ar";
  const kind = product.category;
  const content = kind === "Skincare" ? {
    title: ar ? "فوائد العناية" : "Why your skin will love it",
    benefits: ar ? ["يرطب البشرة بعمق ويمنحها نعومة حريرية", "يساعد على تحسين مظهر الخطوط الدقيقة ومرونة البشرة", "يدعم مظهرًا أكثر توحدًا وإشراقًا للبشرة", "ينعش البشرة الباهتة ويكمل روتينك اليومي", "مناسب للاستخدام مع معظم أنواع البشرة"] : ["Deeply hydrates skin for a silky-soft feel", "Helps improve the appearance of fine lines and elasticity", "Supports a more even-looking, radiant complexion", "Refreshes dull-looking skin and completes your routine", "Suitable for most skin types"],
    usage: ar ? ["ضعي كمية مناسبة على بشرة نظيفة", "وزعي المنتج بلطف حتى يمتص بالكامل", "استخدميه صباحًا أو مساءً كخطوة مناسبة في روتينك"] : ["Apply a suitable amount to clean skin", "Massage gently until fully absorbed", "Use morning or evening as part of your routine"],
  } : kind === "Body Care" ? {
    title: ar ? "فوائد العناية بالجسم" : "Body-care benefits",
    benefits: ar ? ["يمنح البشرة ترطيبًا وملمسًا ناعمًا", "يساعد على تنعيم المناطق الجافة والخشنة", "رائحة لطيفة تضيف إحساسًا منعشًا لروتينك", "مثالي للاستخدام اليومي بعد الاستحمام"] : ["Leaves skin moisturized and soft", "Helps smooth dry and rough-feeling areas", "A gentle scent adds a fresh ritual moment", "Ideal for daily use after showering"],
    usage: ar ? ["استخدميه على بشرة نظيفة وجافة", "دلكي بحركات دائرية حتى يمتص", "كرري الاستخدام على المناطق الأكثر جفافًا"] : ["Apply to clean, dry skin", "Massage in circular motions until absorbed", "Repeat on areas that need extra care"],
  } : kind === "Sets" ? {
    title: ar ? "ماذا يحتوي هذا البوكس؟" : "Inside this edit",
    benefits: ar ? ["اختيارات متناسقة لروتين جمال كامل", "قطع عملية مناسبة للاستخدام اليومي", "تجربة هدية مرتبة وجاهزة للمشاركة", "قيمة أفضل عند جمع المنتجات معًا"] : ["A considered edit for a complete ritual", "Practical pieces for everyday use", "A beautifully arranged gift-ready experience", "Better value in one curated set"],
    usage: ar ? ["ابدئي بالمنتج الأنسب لاحتياجك", "استخدمي كل قطعة حسب تعليماتها", "احتفظي بالمنتجات في مكان جاف ونظيف"] : ["Start with the piece that fits your need", "Use each item according to its directions", "Keep products in a clean, dry place"],
  } : {
    title: ar ? "لماذا ستحبينه؟" : "Why you'll love it",
    benefits: ar ? ["لون أو لمسة جميلة قابلة للتنسيق بسهولة", "ملمس مريح مناسب لروتينك اليومي", "يساعدك على إكمال إطلالتك بلمسة شخصية", "منتج عملي للاستخدام في كل وقت"] : ["An easy-to-style color or finish", "A comfortable texture for everyday rituals", "Helps complete your look with a personal touch", "Practical for day-to-night use"],
    usage: ar ? ["ابدئي بكمية قليلة ثم زيدي حسب رغبتك", "وزعي المنتج بلطف للحصول على نتيجة متجانسة", "احفظيه بعيدًا عن الحرارة وأغلقي العبوة بعد الاستخدام"] : ["Start with a small amount and build as desired", "Blend gently for an even result", "Keep away from heat and close after use"],
  };
  const [reviewText, setReviewText] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewImage, setReviewImage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitReview = async () => {
    if (!reviewText.trim() || !reviewName.trim()) return toast.error(ar ? "اكتبي اسمكِ وتجربتكِ أولًا" : "Please add your name and review");
    setBusy(true);
    try {
      await onAddReview({ name: reviewName.trim(), text: reviewText.trim(), rating: reviewRating, image: reviewImage || undefined });
      setReviewText(""); setReviewName(""); setReviewRating(5); setReviewImage("");
      toast.success(ar ? "شكرًا لمشاركة تجربتكِ" : "Thanks for sharing your experience");
    } finally {
      setBusy(false);
    }
  };
  const onReviewImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(ar ? "اختاري صورة صالحة" : "Choose a valid image");
    if (file.size > 6_000_000) return toast.error(ar ? "اختاري صورة أقل من 6MB" : "Choose an image under 6MB");
    // Compress + downscale client-side, then store as dataURL (keeps JSON payload small)
    void compressImage(file, 900, 0.72).then(compressed => {
      const reader = new FileReader();
      reader.onload = () => setReviewImage(String(reader.result));
      reader.readAsDataURL(compressed);
    });
  };
  const average = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  const snapshot = useMemo(() => ratingSnapshot(reviews), [reviews]);
  // Helpful votes: optimistic toggle, one vote per visitor per review
  const [voteBusy, setVoteBusy] = useState("");
  // Review photo lightbox — index within the reviews that carry an image
  const imageReviews = useMemo(() => reviews.filter(r => r.image), [reviews]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const toggleHelpful = async (review: Review) => {
    if (voteBusy) return;
    const willVote = !review.voted;
    setReviews(list => list.map(r => r.id === review.id
      ? { ...r, voted: willVote, helpfulCount: Math.max(0, (r.helpfulCount || 0) + (willVote ? 1 : -1)) }
      : r));
    setVoteBusy(review.id);
    try {
      const res = await fetch("/api/store/reviews/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, clientId: getClientId() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setReviews(list => list.map(r => r.id === review.id
        ? { ...r, voted: data.voted, helpfulCount: data.helpfulCount }
        : r));
    } catch {
      setReviews(list => list.map(r => r.id === review.id
        ? { ...r, voted: review.voted, helpfulCount: review.helpfulCount || 0 }
        : r));
      toast.error(ar ? "تعذر تسجيل التصويت" : "Couldn't record your vote");
    } finally {
      setVoteBusy("");
    }
  };
  return (
    <section className="product-ritual">
      <div className="ritual-heading">
        <span className="eyebrow">LUBNÉL / THE RITUAL</span>
        <h2>{content.title}</h2>
        <p>{ar ? `تجربة ${product.nameAr} مصممة لتكون خطوة سهلة وجميلة في يومكِ.` : `${product.name} is designed to be an easy, beautiful step in your day.`}</p>
      </div>
      <div className="ritual-grid">
        <div className="ritual-panel">
          <h3>{ar ? "الفوائد" : "Benefits"}</h3>
          <ul>{content.benefits.map(item => <li key={item}><Check size={15} />{item}</li>)}</ul>
        </div>
        <div className="ritual-panel">
          <h3>{ar ? "طريقة الاستخدام" : "How to use"}</h3>
          <ol>{content.usage.map(item => <li key={item}>{item}</li>)}</ol>
          <div className="ritual-tip"><Sparkles size={16} /><span><b>{ar ? "نصيحة LUBNÉL:" : "LUBNÉL tip:"}</b> {ar ? "استخدميه بانتظام ضمن روتين بسيط للحصول على أفضل تجربة." : "Keep it consistent within a simple routine for the best experience."}</span></div>
        </div>
      </div>
      <div className="reviews-heading">
        <h3>{ar ? "آراء عملائنا" : "Customer reviews"}</h3>
        {reviews.length > 0
          ? <Stars average={average} count={reviews.length} lang={lang} />
          : <span className="reviews-heading-empty"><Sparkles size={13} /> {ar ? "كوني أول من يشارك تجربتها" : "Be the first to review"}</span>}
      </div>
      {reviews.length > 0 && (
        <div className="rating-snapshot">
          <div className="snapshot-score">
            <b>{average}</b>
            <span className="snapshot-stars" aria-hidden>{"★".repeat(Math.round(average))}{"☆".repeat(5 - Math.round(average))}</span>
            <em>{ar ? `${reviews.length} تقييم موثّق` : `${reviews.length} verified reviews`}</em>
          </div>
          <div className="snapshot-dist" role="img" aria-label={ar ? "توزيع التقييمات" : "Rating distribution"}>
            {[5, 4, 3, 2, 1].map((star, i) => {
              const count = snapshot.dist[star] || 0;
              const pct = Math.round((count / reviews.length) * 100);
              return (
                <div className="dist-row" key={star}>
                  <span className="dist-star">{star}★</span>
                  <i className="dist-track"><b className="dist-fill" style={{ width: `${pct}%`, animationDelay: `${i * 90}ms` }} /></i>
                  <em>{count}</em>
                </div>
              );
            })}
          </div>
          {snapshot.highlights.length > 0 && (
            <div className="snapshot-highlights">
              <span className="hl-title">{ar ? "أكثر ما لفت انتباه العميلات" : "What customers mention"}</span>
              <div className="hl-chips">
                {snapshot.highlights.map(h => (
                  <span className="hl-chip" key={h.key}>
                    <h.icon size={13} aria-hidden /> {ar ? h.labelAr : h.labelEn} <b>×{h.count}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="review-grid">
        {reviews.map((review, index) => (
          <blockquote key={review.id || `${review.name}-${index}`}>
            <span className="stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
            {review.image && (
              <button
                className="review-image-button"
                onClick={() => setLightbox(Math.max(0, imageReviews.findIndex(r => r.id === review.id)))}
                aria-label={ar ? "تكبير صورة التقييم" : "Enlarge review photo"}
              >
                <img className="review-image" src={review.image} alt="" loading="lazy" decoding="async" />
                <span className="review-image-zoom" aria-hidden><Maximize2 size={14} />{ar ? "تكبير" : "View"}</span>
              </button>
            )}
            <p>“{review.text}”</p>
            <footer>{review.name}</footer>
            <div className="review-foot">
              <button
                className={`review-helpful ${review.voted ? "voted" : ""}`}
                onClick={() => toggleHelpful(review)}
                disabled={voteBusy === review.id}
                aria-pressed={!!review.voted}
                aria-label={ar ? "هل ساعدك هذا التقييم؟" : "Was this review helpful?"}
              >
                <ThumbsUp size={13} />
                <span>{review.voted ? (ar ? "مفيد · شكرًا لكِ" : "Helpful · thanks") : (ar ? "مفيد؟" : "Helpful?")}</span>
                {(review.helpfulCount || 0) > 0 && <b>{review.helpfulCount}</b>}
              </button>
            </div>
          </blockquote>
        ))}
        {reviews.length === 0 && (
          <div className="reviews-empty">
            <Sparkles size={22} aria-hidden />
            <p>{ar ? "لا توجد تقييمات منشورة لهذا المنتج بعد — شاركي تجربتكِ وستظهر هنا بعد مراجعتها." : "No published reviews yet — share your experience and it will appear after moderation."}</p>
          </div>
        )}
      </div>
      {lightbox !== null && imageReviews.length > 0 && (
        <ReviewLightbox
          lang={lang}
          reviews={imageReviews}
          index={Math.min(lightbox, imageReviews.length - 1)}
          onIndex={setLightbox}
          close={() => setLightbox(null)}
        />
      )}
      <div className="review-form">
        <h3>{ar ? "شاركي تجربتكِ" : "Share your experience"}</h3>
        <div className="review-form-grid">
          <input value={reviewName} onChange={e => setReviewName(e.target.value)} placeholder={ar ? "اسمكِ" : "Your name"} />
          <select value={reviewRating} onChange={e => setReviewRating(Number(e.target.value))} aria-label="rating">
            <option value="5">★★★★★</option><option value="4">★★★★☆</option><option value="3">★★★☆☆</option><option value="2">★★☆☆☆</option><option value="1">★☆☆☆☆</option>
          </select>
          <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder={ar ? "اكتبي رأيكِ في المنتج..." : "Write your review..."} />
          <label className="review-upload"><Camera size={16} />{ar ? "إرفاق صورة من تجربتكِ" : "Add a photo"}<input type="file" accept="image/*" onChange={e => onReviewImage(e.target.files?.[0])} /></label>
          {reviewImage && <img className="review-upload-preview" src={reviewImage} alt="" loading="lazy" decoding="async" />}
        </div>
        <button className="button button-dark" onClick={submitReview} disabled={busy}>{ar ? "نشر التقييم" : "Publish review"}<Send size={15} /></button>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────── Not found (R62)
// Honesty to the end: unknown hashes used to re-render home as if nothing
// happened, and dead product links used to render the store's FIRST product —
// wrong item, wrong price, real cash-on-delivery orders. Both now land here:
// the page says what happened, echoes the attempted path, and offers real
// ways back — plus a recovery shelf of featured products (zero new API).
export function NotFoundView({ lang, path, variant = "route", products, wishIds, toggleWish, addToCart, ratings = {}, wishCounts = {}, whatsapp = WHATSAPP_NUMBER }: {
  lang: "ar" | "en"; path: string; variant?: "route" | "product"; products: Product[]; wishIds: string[]; toggleWish: (id: string) => void; addToCart: (p: Product) => void;
  ratings?: Record<string, RatingSummary>; wishCounts?: Record<string, number>; whatsapp?: string;
}) {
  const ar = lang === "ar";
  const featured = products.filter(p => p.featured);
  const shelf = (featured.length >= 2 ? featured : products).slice(0, 4);
  const title = variant === "product" ? (ar ? "المنتج غير موجود" : "Product not found") : (ar ? "الصفحة غير موجودة" : "Page not found");
  const blurb = variant === "product"
    ? (ar ? "الرابط قد يكون قديمًا أو المنتج لم يعد متوفرًا — هذه أقرب البدائل له." : "The link may be stale, or the product is no longer available — these are the closest alternatives.")
    : (ar ? "الرابط الذي فتحتِه لا يقود لأي مكان هنا — ربما تغيّر الطريق أو تمّت إعادة ترتيب الموقع." : "The link you opened doesn't lead anywhere here — the path may have changed, or the site was reorganised.");
  return (
    <main className="container nf-page">
      <div className="nf-hero">
        <span className="nf-digits" aria-hidden="true">404</span>
        <span className="eyebrow">LUBNÉL / {variant === "product" ? "MISSING PRODUCT" : "LOST PATH"}</span>
        <h1>{title}</h1>
        <p>{blurb}</p>
        {path ? <code className="nf-path" dir="ltr">/{path}</code> : null}
        <div className="nf-actions">
          <a className="button button-dark" href="#/shop">{ar ? "تسوّقي المجموعة" : "Browse the shop"}<ArrowUpRight size={15} /></a>
          <a className="button button-outline" href="#/">{ar ? "العودة للرئيسية" : "Back home"}<ArrowLeft size={15} /></a>
          <a className="nf-wa" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">{ar ? "اسألينا على واتساب" : "Ask us on WhatsApp"}<MessageCircle size={14} /></a>
        </div>
      </div>
      {shelf.length >= 2 && (
        <section className="nf-shelf" aria-label={ar ? "منتجات مختارة" : "Selected products"}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{ar ? "اختيارات الزوار" : "VISITOR PICKS"}</span>
              <h2>{ar ? "ابدئي من هنا." : "Start here instead."}</h2>
            </div>
          </div>
          <div className="product-grid nf-grid">
            {shelf.map(p => <ProductCard key={p.id} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} isWish={wishIds.includes(p.id)} toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} />)}
          </div>
        </section>
      )}
    </main>
  );
}

export function ProductView({ lang, products, wishCounts = {}, wishIds, toggleWish, addToCart, productId, ratings = {}, whatsapp = WHATSAPP_NUMBER }: {
  lang: "ar" | "en"; products: Product[]; wishCounts?: Record<string, number>; wishIds: string[]; toggleWish: (id: string) => void; addToCart: (p: Product) => void; productId: string;
  ratings?: Record<string, RatingSummary>; whatsapp?: string;
}) {
  const ar = lang === "ar";
  const id = productId;
  // R62 — no more `|| products[0]`: a dead product link used to render the
  // store's first product as if it were the requested one. Loading (no data
  // yet) and missing (loaded, id absent) are now two different truths.
  const product = products.find(p => p.id === id);
  const [quantity, setQuantity] = useState(1);
  const [variantIndex, setVariantIndex] = useState(0);
  const [activeThumb, setActiveThumb] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  // R46 — cross-sell: "visitors who saved this also saved …" (WishEvent
  // co-occurrence, server-computed; null until the first fetch resolves).
  const [alsoSaved, setAlsoSaved] = useState<AlsoSavedItem[] | null>(null);
  const [alsoSavedBasis, setAlsoSavedBasis] = useState<"co" | "top">("co");
  // Share analytics: null until the first action, then server-truth wins
  const [shareCount, setShareCount] = useState<number | null>(null);
  // component is remounted with key={route.id} on route change — no reset effects needed
  useEffect(() => {
    if (!product) return;
    try {
      const current = readRecentIds().filter(pid => pid !== product.id);
      current.unshift(product.id);
      window.localStorage.setItem("lubnel-recent-ids", JSON.stringify(current.slice(0, 8)));
    } catch { /* private mode */ }
  }, [product?.id, product]);
  useEffect(() => {
    if (!product) return;
    fetchReviews(product.id).then(setReviews);
  }, [product?.id, product]);
  // R46 — the cross-sell rail fetches per product (same lazy pattern as the
  // reviews); a cancelled request or an empty list leaves the rail hidden.
  useEffect(() => {
    if (!product) return;
    let alive = true;
    fetch(`/api/store/products/also-saved?slug=${encodeURIComponent(product.id)}`)
      .then(res => res.json())
      .then(data => {
        if (!alive) return;
        if (data?.success && Array.isArray(data.items)) {
          setAlsoSaved(data.items);
          setAlsoSavedBasis(data.basis === "top" ? "top" : "co");
        } else setAlsoSaved([]);
      })
      .catch(() => { if (alive) setAlsoSaved([]); });
    return () => { alive = false; };
  }, [product?.id, product]);
  // R58 — mobile rail-first: on ≤640px the rail is a horizontal snap rail right
  // after the buy area. The scroll-state (scrollable / at-start / at-end) is
  // MEASURED, not assumed, so the edge fades only appear when there is
  // actually more to scroll — an affordance that lies is worse than none.
  // RTL-safe: scrollLeft runs negative in RTL, so distance-from-start uses
  // Math.abs; the CSS side flips via [dir="ltr"] overrides.
  // R58 measure semantics; R60 — extracted into useRailScroll, which the
  // cart's "كمّلي حقيبتكِ" strip now runs identically.
  const { railRef, railScroll } = useRailScroll([alsoSaved]);
  if (!product) {
    if (products.length === 0) return <main className="container"><div className="large-empty"><p>...</p></div></main>;
    return <NotFoundView lang={lang} path={`product/${id}`} variant="product" products={products} wishIds={wishIds} toggleWish={toggleWish} addToCart={addToCart} ratings={ratings} wishCounts={wishCounts} whatsapp={whatsapp} />;
  }
  const active = activeThumb || product.image;
  const wish = wishIds.includes(product.id);
  // R45 — PDP social proof: the same all-time save count the cards carry
  const pdpWishProof = (wishCounts[product.id] || 0) > 0
    ? (ar
      ? wishCounts[product.id] === 1 ? "حُفظت مرة واحدة" : wishCounts[product.id] === 2 ? "حُفظت مرتين" : wishCounts[product.id] <= 10 ? `حُفظت ${wishCounts[product.id]} مرات` : `حُفظت ${wishCounts[product.id]} مرة`
      : `Saved by ${wishCounts[product.id]} ${wishCounts[product.id] === 1 ? "visitor" : "visitors"}`)
    : null;
  const related = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 3);
  const galleryImages = Array.from(new Set([product.image, ...(product.images || [])]));
  // Real rating: bootstrap summary first (instant), reconciled with the live approved list
  const ratingSummary = ratings[product.id] || (reviews.length ? { average: Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10, count: reviews.length } : undefined);
  // Every explicit share action bumps the counter (optimistic, then reconciled with the server)
  // R25: shares now use the /p/[slug] deep link so WhatsApp/FB/X previews show the product card
  const shareUrl = `${window.location.origin}/p/${product.id}`;
  const registerShare = (channel: "wa" | "fb" | "x" | "copy") => {
    if (!product) return;
    const base = shareCount ?? product.shareCount ?? 0;
    setShareCount(base + 1);
    fetch("/api/store/products/share", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.id, channel }),
    })
      .then(res => res.json())
      .then(data => { if (data?.success && typeof data.shareCount === "number") setShareCount(data.shareCount); })
      .catch(() => undefined); // counter is social proof, never block the share itself
  };
  const shares = shareCount ?? product?.shareCount ?? 0;
  const addReview = async (r: { name: string; text: string; rating: number; image?: string }) => {
    const res = await fetch("/api/store/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id, ...r }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "failed");
    if (data.success && data.pending) {
      toast.success(ar ? "وصلنا تقييمكِ 🌸 سيظهر بعد مراجعته من فريق LUBNÉL" : "Thank you! Your review will appear after moderation", { duration: 5000 });
    } else if (data.success && data.review) {
      setReviews(current => [data.review, ...current]);
    }
  };
  return (
    <main className="container product-page">
      <a href="#/shop" className="back-link"><ArrowRight size={16} /> {ar ? "العودة للتسوّق" : "Back to shop"}</a>
      <div className="product-detail">
        <div className="gallery">
          <div className="thumbs">{galleryImages.map((image, gi) => <button key={image} className={active === image ? "active" : ""} onClick={() => setActiveThumb(image)} aria-label="thumbnail"><img src={image} alt={`${product.nameAr || product.name} — صورة ${gi + 1}`} loading="lazy" decoding="async" /></button>)}</div>
          <div className="main-product-image"><img src={active} alt={product.alt || product.nameAr || product.name} fetchPriority="high" decoding="async" /><span className="zoom-hint"><Eye size={15} /> {ar ? "مرّري للتكبير" : "Hover to zoom"}</span></div>
        </div>
        <div className="product-detail-copy">
          <span className="eyebrow">{ar ? product.categoryAr : product.category} / LUBNÉL</span>
          <h1>{ar ? product.nameAr : product.name}</h1>
          <div className="rating-row">
            {ratingSummary
              ? <Stars average={ratingSummary.average} count={ratingSummary.count} lang={lang} />
              : <span className="rating-none"><Sparkles size={13} /> {ar ? "كوني أول من يقيّم هذا المنتج" : "Be the first to review this product"}</span>}
          </div>
          <div className="stock-row">
            {product.stock > 0 ? (
              <span className={`stock-chip ${product.stock < 10 ? "low" : "in"}`}>
                <i aria-hidden />{product.stock < 10 ? (ar ? `متبقي ${product.stock} قطع فقط` : `Only ${product.stock} left`) : (ar ? "متوفر للمشروع" : "In stock")}
              </span>
            ) : (
              <span className="stock-chip out"><i aria-hidden />{ar ? "نفذت الكمية مؤقتًا" : "Temporarily sold out"}</span>
            )}
          </div>
          <div className="detail-price">
            <strong>{money(product.price)}</strong>
            {product.oldPrice && <><del>{money(product.oldPrice)}</del><span>{ar ? `وفّري ${money(product.oldPrice - product.price)}` : `Save ${money(product.oldPrice - product.price)}`}</span></>}
          </div>
          <p className="detail-description">{product.description}</p>
          <div className="detail-divider" />
          {(product.variants || []).length > 0 && (() => {
            const variants = product.variants!;
            const active = Math.min(variantIndex, variants.length - 1);
            return (
              <div className="variant-block">
                <div className="variant-label"><span>{variants[active].label}</span><strong>{variants[active].value}</strong></div>
                {variants.length > 1 && (
                  <div className="variant-chips" role="group" aria-label={variants[active].label}>
                    {variants.map((v, i) => (
                      <button key={i} className={i === active ? "selected" : ""} onClick={() => setVariantIndex(i)} aria-pressed={i === active}>{v.value}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="purchase-row">
            <div className="quantity">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="less"><Minus size={15} /></button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity(Math.min(product.stock || 99, quantity + 1))} aria-label="more"><Plus size={15} /></button>
            </div>
            <button className="button button-dark grow" disabled={product.stock <= 0} onClick={() => { for (let i = 0; i < quantity; i++) addToCart(product); }}>
              {product.stock <= 0 ? (ar ? "غير متوفر" : "Sold out") : (ar ? "أضيفي للحقيبة" : "Add to bag")}<ShoppingBag size={16} />
            </button>
            <div className="share-wrap">
              <button className={`square-action ${shareOpen ? "active" : ""}`} onClick={() => setShareOpen(v => !v)} aria-label={ar ? `مشاركة المنتج${shares > 0 ? ` — ${shares} مشاركة` : ""}` : `Share product${shares > 0 ? ` — ${shares} shares` : ""}`} aria-expanded={shareOpen}>
                <Share2 size={17} />
                {shares > 0 && <b className="share-count-bubble" aria-hidden>{shares > 99 ? "99+" : shares}</b>}
              </button>
              {shareOpen && (
                <>
                  <button className="share-backdrop" aria-hidden tabIndex={-1} onClick={() => setShareOpen(false)} />
                  <div className="share-pop" role="menu" aria-label={ar ? "مشاركة عبر" : "Share via"}>
                    <span className="share-pop-title">{ar ? "شاركي المنتج" : "Share this product"}</span>
                    <a role="menuitem" className="share-opt wa" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${ar ? product.nameAr : product.name} — LUBNÉL ✦ ${shareUrl}`)}`} onClick={() => { setShareOpen(false); registerShare("wa"); }}>
                      <MessageCircle size={15} />{ar ? "واتساب" : "WhatsApp"}
                    </a>
                    <a role="menuitem" className="share-opt fb" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} onClick={() => { setShareOpen(false); registerShare("fb"); }}>
                      <Share2 size={15} />{ar ? "فيسبوك" : "Facebook"}
                    </a>
                    <a role="menuitem" className="share-opt x" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${ar ? product.nameAr : product.name} — LUBNÉL`)}&url=${encodeURIComponent(shareUrl)}`} onClick={() => { setShareOpen(false); registerShare("x"); }}>
                      <Send size={15} />{ar ? "إكس (تويتر)" : "X (Twitter)"}
                    </a>
                    <button role="menuitem" className="share-opt copy" onClick={() => {
                      const url = shareUrl;
                      const done = () => toast.success(ar ? "تم نسخ رابط المنتج 🌸" : "Product link copied");
                      const legacyCopy = () => {
                        const ta = document.createElement("textarea");
                        ta.value = url; document.body.appendChild(ta); ta.select();
                        try { document.execCommand("copy"); done(); } catch { toast.error(ar ? "تعذّر النسخ" : "Copy failed"); }
                        ta.remove();
                      };
                      // Insecure contexts (HTTP/IP access) have no navigator.clipboard —
                      // guard before .then() so the handler never throws before registerShare.
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(url).then(done).catch(legacyCopy);
                      } else {
                        legacyCopy();
                      }
                      setShareOpen(false);
                      registerShare("copy");
                    }}>
                      <Copy size={15} />{ar ? "نسخ الرابط" : "Copy link"}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className={`square-action ${wish ? "active" : ""}`} onClick={() => toggleWish(product.id)} aria-label="wishlist"><Heart size={19} fill={wish ? "currentColor" : "none"} /></button>
          </div>
          {pdpWishProof && (
            <span className="wish-proof wish-proof-pdp" role="status">
              <Heart size={11} aria-hidden />{pdpWishProof}
            </span>
          )}
          <a className="buy-whatsapp" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`مرحبًا LUBNÉL، مهتمة بـ ${product.nameAr} (${money(product.price)})`)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /><span>{ar ? "اطلبيه مباشرة عبر واتساب" : "Order directly via WhatsApp"}</span><ArrowLeft size={15} />
          </a>
          <div className="accordions">
            <details open>
              <summary>{ar ? "التفاصيل" : "Details"}<Plus size={15} /></summary>
              <p>{product.description}</p>
            </details>
            <details>
              <summary>{ar ? "الشحن والإرجاع" : "Shipping & returns"}<Plus size={15} /></summary>
              <p>{ar ? "توصيل خلال 2–5 أيام عمل. إرجاع المنتجات غير المفتوحة خلال 14 يومًا." : "Delivery in 2–5 business days. Unopened products can be returned within 14 days."}</p>
            </details>
          </div>
        </div>
      </div>
      <ProductRitual lang={lang} product={product} reviews={reviews} setReviews={setReviews} onAddReview={addReview} />
      {alsoSaved && alsoSaved.length > 0 && (
        <section className="also-saved" aria-label={ar ? "منتجات حفظها زوار آخرون" : "Products other visitors saved"}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{alsoSavedBasis === "co" ? (ar ? "زوار هذا المنتج حفظوه أيضًا" : "VISITORS ALSO SAVED") : (ar ? "الأكثر حفظًا لدى الزوار" : "MOST SAVED BY VISITORS")}</span>
              <h2>{ar ? "من عين الزوار" : "Straight from visitors."}</h2>
            </div>
          </div>
          <div
            ref={railRef}
            className={`also-saved-rail${railScroll.scrollable ? " is-scrollable" : ""}${railScroll.atStart ? " at-start" : ""}${railScroll.atEnd ? " at-end" : ""}`}
            tabIndex={railScroll.scrollable ? 0 : undefined}
            role={railScroll.scrollable ? "group" : undefined}
            aria-label={railScroll.scrollable ? (ar ? "منتجات مقترحة — اسحبي لعرض المزيد" : "Suggested products — scroll for more") : undefined}
          >
            <AlsoSavedCards items={alsoSaved} ar={ar} onPull={target => {
              // R47/R48 — attribution: fire-and-forget rail click-through so
              // the studio wish board can show the rail actually pulling
              // demand. The anonymous client id rides along so a later order
              // from this browser can stamp the pull as converted. Never
              // blocks the navigation; failures are silently ignored.
              fetch("/api/store/products/rail-click", {
                method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
                body: JSON.stringify({ from: product.id, target, vid: getClientId() }),
              }).catch(() => undefined);
            }} />
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section className="related-products">
          <div className="section-heading">
            <div><span className="eyebrow">{ar ? "قد يعجبك أيضًا" : "YOU MAY ALSO LIKE"}</span><h2>{ar ? "كمّلي طقسكِ" : "Complete the ritual."}</h2></div>
          </div>
          <div className="product-grid">
            {related.map(p => <ProductCard key={p.id} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} isWish={wishIds.includes(p.id)} toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} />)}
          </div>
        </section>
      )}
    </main>
  );
}

// ────────────────────────────────────────────────────────── Offers strip
function offerUrgency(offer: StoreOffer, ar: boolean): { text: string; level: "hot" | "soon" | "scarce" } | null {
  if (offer.endsAt) {
    const ms = new Date(offer.endsAt).getTime() - Date.now();
    if (ms > 0) {
      const hours = ms / 3_600_000;
      if (hours < 24) return { text: ar ? "آخر ساعات العرض" : "Ends within hours", level: "hot" };
      const days = Math.ceil(hours / 24);
      if (days <= 3) return { text: ar ? `ينتهي خلال ${days === 1 ? "يوم" : days === 2 ? "يومين" : `${days} أيام`}` : `Ends in ${days} day${days > 1 ? "s" : ""}`, level: "soon" };
    }
  }
  if (offer.remaining != null && offer.remaining > 0 && offer.remaining <= 25) {
    return { text: ar ? `بقي ${offer.remaining} استخدام فقط` : `Only ${offer.remaining} uses left`, level: "scarce" };
  }
  return null;
}

export function OffersStrip({ lang, offers, onCopy }: { lang: "ar" | "en"; offers: StoreOffer[]; onCopy: (code: string) => void }) {
  const ar = lang === "ar";
  if (!offers.length) return null;
  return (
    <section className="offers-strip" aria-label={ar ? "العروض الحالية" : "Current offers"}>
      <div className="offers-strip-head">
        <span className="shofy-kicker">LUBNÉL / OFFERS</span>
        <h2>{ar ? "عروض هذا الأسبوع" : "This week's offers"}</h2>
      </div>
      <div className="offers-row">
        {offers.map(offer => {
          const urgency = offerUrgency(offer, ar);
          return (
            <div className={`offer-chip ${urgency ? `offer-urgent offer-urgent-${urgency.level}` : ""}`} key={offer.code}>
              {urgency && (
                <span className={`offer-urgency urgency-${urgency.level}`} role="status">
                  <Clock size={11} /> {urgency.text}
                </span>
              )}
              <div className="offer-scissors" aria-hidden>
                <Sparkles size={15} />
              </div>
              <div className="offer-copy">
                <strong>{offer.type === "percent" ? `${offer.value}٪` : money(offer.value)}</strong>
                <span>{offer.label || (ar ? "خصم خاص لمحبي LUBNÉL" : "A special LUBNÉL treat")}</span>
                {offer.minSubtotal > 0 && <small>{ar ? `للطلبات فوق ${money(offer.minSubtotal)}` : `On orders over ${money(offer.minSubtotal)}`}</small>}
              </div>
              <button className="offer-code" onClick={() => onCopy(offer.code)} aria-label={ar ? `نسخ كود ${offer.code}` : `Copy code ${offer.code}`}>
                {offer.code}
                <Copy size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────── Order tracking
const TRACK_STEPS = ["new", "confirmed", "preparing", "shipped", "completed"];

// Expected delivery estimate per order status (business days from order date)
function expectedDelivery(status: string, ar: boolean): { text: string; level: "estimate" | "done" } | null {
  switch (status) {
    case "new":
    case "confirmed":
      return { text: ar ? "التوصيل المتوقع خلال ٣–٥ أيام عمل" : "Expected delivery in 3–5 business days", level: "estimate" };
    case "preparing":
      return { text: ar ? "التوصيل المتوقع خلال ٢–٤ أيام عمل" : "Expected delivery in 2–4 business days", level: "estimate" };
    case "shipped":
      return { text: ar ? "يصلكِ خلال ١–٢ يوم عمل 🚚" : "Arriving in 1–2 business days", level: "estimate" };
    case "completed":
      return { text: ar ? "تم التوصيل بنجاح ✓" : "Delivered ✓", level: "done" };
    default:
      return null;
  }
}

function TrackTimeline({ status, paused }: { status: string; paused?: boolean }) {
  if (status === "cancelled") {
    return <div className="track-timeline cancelled"><span className="track-step cancelled-step">✕ تم إلغاء هذا الطلب</span></div>;
  }
  const currentIndex = Math.max(0, TRACK_STEPS.indexOf(status));
  return (
    <div className={`track-timeline ${paused ? "paused" : ""}`} role="list" aria-label="order progress">
      {TRACK_STEPS.map((step, i) => (
        <div key={step} role="listitem" className={`track-step ${i <= currentIndex ? "done" : ""} ${i === currentIndex ? "current" : ""}`}>
          <span className="track-dot">{i < currentIndex ? <Check size={11} /> : i === currentIndex ? <Package size={12} /> : null}</span>
          <small>{ORDER_STATUS_LABELS[step]}</small>
          {i < TRACK_STEPS.length - 1 && <i className="track-line" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

function CancelReviewBanner({ order, ar }: { order: TrackedOrder; ar: boolean }) {
  const requestedAt = order.cancelRequestedAt ? new Date(order.cancelRequestedAt) : null;
  const when = requestedAt ? requestedAt.toLocaleString("ar-EG", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div className="cancel-review-banner" role="status">
      <span className="crb-icon" aria-hidden>✕</span>
      <div className="crb-body">
        <strong>{ar ? "طلب إلغاء قيد المراجعة" : "Cancellation under review"}</strong>
        <span>
          {when ? (ar ? `أرسختِ الطلب ${when} — ` : `Submitted ${when} — `) : ""}
          {ar ? "فريقنا يراجع الطلب الآن وسيصلكِ الرد عبر واتساب في أقرب وقت." : "Our team is reviewing it and will reach out on WhatsApp shortly."}
        </span>
      </div>
      <a
        className="crb-wa"
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(ar ? `مرحبًا، أستفسر عن حالة طلب إلغاء الطلب ${order.orderNumber}` : `Hello, asking about cancellation of ${order.orderNumber}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        <MessageCircle size={13} /> {ar ? "متابعة سريعة" : "Follow up"}
      </a>
    </div>
  );
}

export function TrackView({ lang }: { lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const [phone, setPhone] = usePersistedState("lubnel-track-phone", "");
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState("");
  const lookup = async () => {
    if (phone.replace(/\D/g, "").length < 5) return toast.error(ar ? "اكتبي رقم هاتف صحيح" : "Enter a valid phone number");
    // R64 — the query gets the same canonicalisation the order did: searching
    // "+20 101 234 5678" now finds orders stored as 01012345678. Unfixable
    // input falls back to raw (older rows typed in other shapes still match).
    const phoneQuery = normalizeEgyptPhone(phone) || phone.trim();
    setBusy(true);
    try {
      const res = await fetch(`/api/store/track?phone=${encodeURIComponent(phoneQuery)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders);
      if (!data.orders.length) toast.success(ar ? "لا توجد طلبات لهذا الرقم بعد" : "No orders for this number yet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  const requestCancel = async (order: TrackedOrder) => {
    if (!(await confirmDialog({ title: ar ? 'طلب إلغاء الطلب' : 'Cancellation request', message: ar ? `إرسال طلب إلغاء للطلب ${order.orderNumber}؟ سيراجعه الفريق ويتواصل معكِ.` : `Request cancellation of ${order.orderNumber}? Our team will review and contact you.`, confirmText: ar ? 'إرسال الطلب' : 'Send request', cancelText: ar ? 'رجوع' : 'Back' }))) return;
    setCancelBusy(order.orderNumber);
    try {
      const res = await fetch("/api/store/orders/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: order.orderNumber, phone: normalizeEgyptPhone(phone) || phone.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(ar ? data.message : "Cancellation request sent");
      await lookup();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCancelBusy("");
    }
  };
  return (
    <main className="container track-page">
      <div className="page-heading"><span className="eyebrow">LUBNÉL / TRACKING</span><h1>{ar ? "تتبعي طلبكِ" : "Track your order"}</h1></div>
      <div className="track-panel">
        <p className="track-intro">{ar ? "اكتبي رقم الهاتف الذي استخدمتيه في الطلب وستظهر لكِ كل طلباتكِ مع حالتها المحدثة." : "Enter the phone number you ordered with to see your orders and their live status."}</p>
        <div className="track-form">
          <div className="field-with-icon">
            <Phone size={16} />
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !busy) void lookup(); }}
              placeholder={ar ? "مثال: 01012345678" : "e.g. 01012345678"}
              inputMode="tel"
              aria-label={ar ? "رقم الهاتف" : "Phone number"}
            />
          </div>
          <button className="button button-dark" onClick={lookup} disabled={busy}>{busy ? "…" : (ar ? "بحث" : "Track")}<Search size={15} /></button>
        </div>
      </div>
      {orders && orders.length === 0 && (
        <div className="large-empty">
          <Package size={34} />
          <h3>{ar ? "لا توجد طلبات بهذا الرقم" : "No orders found"}</h3>
          <p>{ar ? "جرّبي رقمًا آخر، أو ابدئي رحلة جمال جديدة الآن." : "Try another number, or start a new beauty journey."}</p>
          <a href="#/shop" className="button button-dark">{ar ? "تسوّقي الآن" : "Shop now"}<ArrowUpRight size={15} /></a>
        </div>
      )}
      {orders && orders.length > 0 && (
        <div className="track-list">
          {orders.map(order => (
            <article className="panel track-card" key={order.orderNumber}>
              <div className="track-card-head">
                <div>
                  <span className="order-id">{order.orderNumber}</span>
                  <h3>{ar ? `طلب ${order.customerName}` : `Order by ${order.customerName}`}</h3>
                  <small>{new Date(order.createdAt).toLocaleString("ar-EG")}</small>
                </div>
                <div className="track-total">
                  <strong>{money(order.total)}</strong>
                  {order.couponCode && <em className="status status-live">{order.couponCode}</em>}
                </div>
              </div>
              <TrackTimeline status={order.status} paused={order.cancelRequested && order.status !== "cancelled"} />
              {!order.cancelRequested && (() => {
                const estimate = expectedDelivery(order.status, ar);
                if (!estimate) return null;
                return (
                  <p className={`delivery-estimate ${estimate.level}`} role="status">
                    <Truck size={13} /> {estimate.text}
                  </p>
                );
              })()}
              {order.cancelRequested && order.status !== "cancelled" && <CancelReviewBanner order={order} ar={ar} />}
              <div className="track-items">
                {order.items.map((item, i) => (
                  <span key={`${item.id}-${i}`} className="track-item">{item.name} <b>× {item.quantity}</b></span>
                ))}
              </div>
              <div className="track-summary">
                <span>{ar ? "المجموع الفرعي" : "Subtotal"}: <b>{money(order.subtotal)}</b></span>
                {order.discount > 0 && <span>{ar ? "الخصم" : "Discount"}: <b>−{money(order.discount)}</b></span>}
                <span>{ar ? "التوصيل" : "Delivery"}: <b>{order.shipping ? money(order.shipping) : (ar ? "مجاني" : "Free")}</b></span>
                <span>{ar ? "الإجمالي" : "Total"}: <b>{money(order.total)}</b></span>
              </div>
              <div className="track-actions-row">
                <a className="track-help" href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحبًا LUBNÉL، أستفسر عن الطلب ${order.orderNumber}`)}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} /> {ar ? "استفسار عن الطلب عبر واتساب" : "Ask about this order on WhatsApp"}
                </a>
                {["new", "confirmed"].includes(order.status) && !order.cancelRequested && (
                  <button className="cancel-request-btn" onClick={() => requestCancel(order)} disabled={cancelBusy === order.orderNumber}>
                    <X size={14} /> {cancelBusy === order.orderNumber ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "طلب إلغاء الطلب" : "Request cancellation")}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────── Cart
export function CartView({ lang, cart, setCart, recordOrder, whatsapp = WHATSAPP_NUMBER, shippingCfg }: {
  lang: "ar" | "en"; cart: CartItem[]; setCart: (items: CartItem[]) => void; recordOrder: (total: number, items: CartItem[]) => void; whatsapp?: string;
  shippingCfg?: { threshold: number; fee: number };
}) {
  const ar = lang === "ar";
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // R35 — shipping values follow the owner's Settings (passed from bootstrap);
  // constants are only the fallback when settings are missing or malformed.
  const shipCfg = shippingCfg || { threshold: FREE_SHIPPING_THRESHOLD, fee: SHIPPING_FEE };
  const shipping = subtotal >= shipCfg.threshold || subtotal === 0 ? 0 : shipCfg.fee;
  const [customerName, setCustomerName] = usePersistedState("lubnel-checkout-name", "");
  const [customerPhone, setCustomerPhone] = usePersistedState("lubnel-checkout-phone", "");
  // R64 — phone honesty: the WhatsApp handoff is COD fulfilment's only
  // contact channel, so the number gets canonicalised visibly (on blur, when
  // fixable) and gated before any order leaves the page.
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [customerAddress, setCustomerAddress] = usePersistedState("lubnel-checkout-address", "");
  // R31 — gift-card note: deliberately ephemeral (per-order creative text, unlike identity fields)
  const [giftNote, setGiftNote] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ valid: boolean; code: string; discount: number; message: string }>({ valid: false, code: "", discount: 0, message: "" });
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ orderNumber: string; total: number; hadGift?: boolean } | null>(null);
  // R33 — focus lands in the gift textarea when the nudge opens the box
  const giftInputRef = useRef<HTMLTextAreaElement>(null);
  const [couponHint, setCouponHint] = useState("");
  const triedHint = useRef("");
  // R60 — cart cross-sell: the PDP rail machinery (wish co-occurrence /
  // store-wide top saves + R59 railOrders proof) now serves the bag. A
  // fulfilled bag suggests the most-saved products NOT already in it (the
  // bag's slugs ride as `exclude`, refetching as the bag changes); the empty
  // bag gets the store-wide top saves. The confirmed-order state opts OUT —
  // that screen has one job (WhatsApp confirmation + tracking); cross-sell
  // there would dilute the moment the studio owes the shopper.
  const [cartSuggest, setCartSuggest] = useState<AlsoSavedItem[] | null>(null);
  const cartIds = cart.map(i => i.id).join(",");
  const suggestMode: "empty" | "complete" | null = cart.length === 0 ? (lastOrder ? null : "empty") : "complete";
  useEffect(() => {
    if (!suggestMode) return;
    let alive = true;
    const qs = suggestMode === "complete" && cartIds ? `?exclude=${encodeURIComponent(cartIds)}` : "";
    fetch(`/api/store/products/also-saved${qs}`)
      .then(res => res.json())
      .then(data => { if (alive) setCartSuggest(data?.success && Array.isArray(data.items) ? data.items : []); })
      .catch(() => { if (alive) setCartSuggest([]); });
    return () => { alive = false; };
  }, [suggestMode, cartIds]);
  const { railRef: suggestRailRef, railScroll: suggestRailScroll } = useRailScroll([cartSuggest]);
  const discount = coupon.valid ? coupon.discount : 0;
  const grandTotal = Math.max(0, subtotal - discount + shipping);
  const applyCode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return toast.error(ar ? "اكتبي كود الخصم أولًا" : "Enter a promo code first");
    setApplying(true);
    try {
      const res = await fetch("/api/store/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, subtotal }) });
      const result = await res.json();
      if (result.valid) { setCoupon(result); setCouponCode(code); toast.success(result.message); }
      else { setCoupon({ valid: false, code: "", discount: 0, message: result.message }); toast.error(result.message); }
    } catch {
      toast.error(ar ? "تعذر التحقق من الكود" : "Could not validate code");
    } finally {
      setApplying(false);
    }
  };
  // Coupon hand-off: auto-apply a code copied from the home offers strip
  useEffect(() => {
    if (!cart.length || coupon.valid || applying) return;
    let hint = "";
    try { hint = window.localStorage.getItem("lubnel-coupon-hint") || ""; } catch { /* private mode */ }
    if (!hint || hint === triedHint.current) return;
    triedHint.current = hint;
    setCouponHint(hint);
    void applyCode(hint);
  }, [cart.length]);
  // R63 — the bag now reflects inventory truth: the stepper stops at the
  // product's real stock. The PDP already capped its own selector; the bag
  // was the loophole (quantity 99 of a 10-stock item went straight into the
  // WhatsApp order). cap = max(quantity, stock) keeps the visitor's current
  // count when owner stock drops below it — a bag is never silently mutated —
  // while blocking further increases; the row note explains why.
  const update = (id: string, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const cap = Math.max(item.quantity, item.stock || 0);
    if (delta > 0 && item.quantity >= cap) return;
    setCart(cart.map(i => i.id === id ? { ...i, quantity: Math.max(0, Math.min(cap, i.quantity + delta)) } : i).filter(i => i.quantity > 0));
  };
  const checkout = async () => {
    if (!cart.length) return;
    // R63 — inventory honesty at the door: a sold-out or over-stock row must
    // not become a cash-on-delivery order the owner can't fulfil. The toast
    // names the row; the bag is untouched (the visitor stays in control).
    const blocked = cart.find(i => i.stock <= 0 || i.quantity > Math.max(i.stock, 0));
    if (blocked) {
      const blockedName = ar ? blocked.nameAr : blocked.name;
      toast.error(ar ? `غير متوفرة الآن: ${blockedName} — عدّلي الحقيبة أولًا` : `Not available right now: ${blockedName} — please adjust your bag first`);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) return toast.error(ar ? "اكتبي الاسم ورقم الهاتف أولًا" : "Please add your name and phone first");
    // R64 — format gate: the canonical form is what the order, the admin and
    // the WhatsApp message all carry. Unfixable numbers never leave the page.
    const phoneCanonical = normalizeEgyptPhone(customerPhone);
    if (!phoneCanonical) {
      setPhoneInvalid(true);
      return toast.error(ar ? "رقم الهاتف غير صحيح — مثال: 01012345678" : "That phone number doesn't look right — e.g. 01012345678");
    }
    setSaving(true);
    try {
      const orderNumber = `LN-${Date.now()}`;
      const res = await fetch("/api/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber, customerName, customerPhone: phoneCanonical, customerAddress,
          items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
          couponCode: coupon.valid ? coupon.code : undefined,
          giftNote: giftNote.trim() || undefined,
          vid: getClientId(), // R48 — anonymous id closing the rail→order attribution loop
        }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || "تعذر تسجيل الطلب");
      recordOrder(saved.total, cart);
      const hadGift = Boolean(giftNote.trim()); // R33 — captured before the per-order reset
      setLastOrder({ orderNumber: saved.orderNumber, total: saved.total, hadGift });
      try { window.localStorage.removeItem("lubnel-coupon-hint"); } catch { /* private mode */ }
      setGiftNote(""); setGiftOpen(false); // fresh note per order
      const giftLine = giftNote.trim() ? `\nبطاقة هدية: "${giftNote.trim()}"` : "";
      const message = `مرحبًا LUBNÉL، أريد تأكيد الطلب ${saved.orderNumber}:\n\n${cart.map(i => `- ${i.name} × ${i.quantity} · ${money(i.price)}`).join("\n")}\n\nالمجموع الفرعي: ${money(saved.subtotal)}\nالخصم: ${money(saved.discount)}\nالتوصيل: ${shipping ? money(shipping) : "مجاني"}\nالإجمالي: ${money(saved.total)}\nالاسم: ${customerName}\nالهاتف: ${phoneCanonical}\nالعنوان: ${customerAddress}${giftLine}`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
      toast.success(ar ? "تم تسجيل الطلب وتجهيزه على واتساب" : "Order saved and ready on WhatsApp");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر تسجيل الطلب" : "Could not save order"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="container cart-page">
      <div className="page-heading"><span className="eyebrow">LUBNÉL / BAG</span><h1>{ar ? "حقيبتكِ" : "Your bag"}</h1></div>
      {cart.length === 0 && lastOrder ? (
        <div className="order-success" role="status">
          <div className="order-success-icon"><Check size={26} /></div>
          <span className="eyebrow">LUBNÉL / ORDER CONFIRMED</span>
          <h2>{ar ? "تم تسجيل طلبكِ بنجاح" : "Your order is confirmed"}</h2>
          <p>{ar ? "رقم الطلب" : "Order number"} <strong className="order-id">{lastOrder.orderNumber}</strong></p>
          <p>{ar ? `الإجمالي: ${money(lastOrder.total)} — الدفع عند الاستلام` : `Total: ${money(lastOrder.total)} — cash on delivery`}</p>
          <p>{ar ? "أكملي التأكيد على واتساب، وتابعي طلبكِ في أي وقت من صفحة التتبع." : "Finish confirming on WhatsApp — and track anytime from the tracking page."}</p>
          {lastOrder.hadGift && (
            <p className="order-gift-line"><Gift size={14} aria-hidden />{ar ? "بطاقة الهدية مرفقة — سنكتب رسالتكِ بخط اليد" : "Your gift card is attached — we'll handwrite your message"}</p>
          )}
          <div className="order-success-actions">
            <a className="button button-dark" href="#/track">{ar ? "تتبعي طلبكِ" : "Track your order"}<Package size={15} /></a>
            <button className="button button-outline" onClick={() => setLastOrder(null)}>{ar ? "متابعة التسوق" : "Continue shopping"}<ArrowUpRight size={15} /></button>
          </div>
        </div>
      ) : cart.length === 0 ? (
        <div className="large-empty cart-empty">
          <ShoppingBag size={34} />
          <h3>{ar ? "حقيبتكِ فارغة الآن" : "Your bag is empty"}</h3>
          <p>{ar ? "ابدئي بطقس جديد، سنحتفظ به لكِ." : "Start a new ritual — we'll keep it here for you."}</p>
          <a href="#/shop" className="button button-dark">{ar ? "اكتشفي المنتجات" : "Discover products"}<ArrowUpRight size={15} /></a>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            <div className="cart-header"><span>{cart.length} {ar ? "منتجات" : "items"}</span><button onClick={() => setCart([])}>{ar ? "إفراغ الحقيبة" : "Clear bag"}</button></div>
            {cart.map(item => {
              // R63 — per-row inventory honesty: sold-out rows grey out with a
              // removal note, rows at their stock ceiling show what's left and
              // disable the + step. Quiet states, not alarms.
              const soldOut = item.stock <= 0;
              const atCap = !soldOut && item.quantity >= item.stock;
              return (
                <div className={`cart-item${soldOut ? " soldout" : ""}${atCap ? " at-cap" : ""}`} key={item.id}>
                  <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
                  <div className="cart-item-copy">
                    <span className="eyebrow">{ar ? item.categoryAr : item.category}</span>
                    <h3>{ar ? item.nameAr : item.name}</h3>
                    <div className="cart-item-bottom">
                      <strong>{money(item.price)}</strong>
                      <div className="quantity">
                        <button onClick={() => update(item.id, -1)} aria-label="less"><Minus size={14} /></button>
                        <span>{item.quantity}</span>
                        <button onClick={() => update(item.id, 1)} aria-label="more" disabled={soldOut || atCap}
                          title={soldOut || atCap ? (ar ? "لا يوجد مخزون إضافي" : "No more stock") : undefined}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {(soldOut || atCap) && (
                      <span className="qty-note">{soldOut
                        ? (ar ? "نفدت الكمية — أزيليها للمتابعة" : "Sold out — remove it to continue")
                        : (ar ? `المتوفر: ${item.stock} فقط` : `Only ${item.stock} in stock`)}</span>
                    )}
                  </div>
                  <button className="remove-item" onClick={() => setCart(cart.filter(i => i.id !== item.id))} aria-label="remove"><Trash2 size={16} /></button>
                </div>
              );
            })}
            <a href="#/shop" className="continue-link"><ArrowRight size={16} /> {ar ? "متابعة التسوق" : "Continue shopping"}</a>
          </div>
          <div className="summary-card">
            <span className="eyebrow">{ar ? "بيانات التوصيل" : "DELIVERY DETAILS"}</span>
            <div className="checkout-fields">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={ar ? "الاسم" : "Full name"} />
              <input value={customerPhone}
                onChange={e => { setCustomerPhone(e.target.value); if (phoneInvalid) setPhoneInvalid(false); }}
                onBlur={() => {
                  // R64 — visible canonicalisation: a complete, fixable number
                  // rewrites itself in place, so the visitor sees exactly what
                  // the order will carry. Unfixable input stays as typed; the
                  // gate explains at submit.
                  const canonical = normalizeEgyptPhone(customerPhone);
                  if (canonical && canonical !== customerPhone) setCustomerPhone(canonical);
                }}
                placeholder={ar ? "رقم الهاتف" : "Phone"} inputMode="tel" aria-invalid={phoneInvalid || undefined}
                className={phoneInvalid ? "invalid" : undefined} />
              {phoneInvalid && (
                <span className="field-note">{ar ? "تأكدي من الرقم — مثال: 01012345678" : "Check the number — e.g. 01012345678"}</span>
              )}
              <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder={ar ? "العنوان بالتفصيل" : "Address"} />
            </div>
            {/* R31 — optional gift-card note, collapsed by default to keep checkout compact */}
            <div className="gift-block">
              {/* R33 — one-time whisper nudge: hides as soon as the box is open */}
              {!giftOpen && !giftNote.trim() && (
                <button type="button" className="gift-nudge"
                  onClick={() => { setGiftOpen(true); requestAnimationFrame(() => giftInputRef.current?.focus()); }}>
                  <Sparkles size={12} aria-hidden />
                  {ar ? <>اجعليها هدية — <b>بطاقة إهداء مجانًا</b> مع رسالتكِ على الطلب</> : <>Make it a gift — <b>a free gift card</b> with your message</>}
                </button>
              )}
              <button type="button" className={`gift-toggle ${giftOpen || giftNote.trim() ? "on" : ""}`}
                onClick={() => setGiftOpen(v => !v)} aria-expanded={giftOpen || !!giftNote.trim()}>
                <Gift size={14} />
                {ar ? (giftNote.trim() ? "بطاقة الهدية" : "إضافة بطاقة هدية (اختياري)") : (giftNote.trim() ? "Gift note" : "Add a gift note (optional)")}
                <ChevronDown size={13} className="chev" />
              </button>
              {(giftOpen || giftNote.trim()) && (
                <div className="gift-box">
                  <textarea ref={giftInputRef} value={giftNote} maxLength={200} rows={2}
                    onChange={e => setGiftNote(e.target.value)}
                    placeholder={ar ? "رسالتكِ على بطاقة الهدية…" : "Your message on the gift card…"}
                    aria-label={ar ? "رسالة بطاقة الهدية" : "Gift card message"} />
                  <span className={`gift-count ${giftNote.trim().length >= 180 ? "near" : ""}`}>{giftNote.trim().length}/200</span>
                </div>
              )}
            </div>
            <div className="summary-line"><span>{ar ? "المجموع الفرعي" : "Subtotal"}</span><strong>{money(subtotal)}</strong></div>
            {subtotal > 0 && subtotal < shipCfg.threshold && (
              <div className="ship-meter">
                <div className="ship-meter-copy"><Truck size={15} className="truck-ico" /><span>{ar ? "أضيفي" : "Add"} <b>{money(shipCfg.threshold - subtotal)}</b> {ar ? "للحصول على شحن مجاني" : "more for free delivery"}</span></div>
                <div className="ship-meter-bar"><i style={{ width: `${Math.min(100, Math.round((subtotal / shipCfg.threshold) * 100))}%` }} /></div>
              </div>
            )}
            {subtotal >= shipCfg.threshold && (
              <div className="ship-meter free">
                <div className="ship-meter-copy"><Truck size={15} className="truck-ico" /><span>{ar ? "رائع! طلبكِ مؤهل لـ" : "Nice! Your order qualifies for"} <b>{ar ? "شحن مجاني" : "free delivery"}</b></span></div>
                <div className="ship-meter-bar"><i style={{ width: "100%" }} /></div>
              </div>
            )}
            <div className="summary-line"><span>{ar ? "التوصيل" : "Delivery"}</span><strong>{shipping ? money(shipping) : (ar ? "مجاني" : "Free")}</strong></div>
            <div className="promo-input">
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder={ar ? "كود الخصم" : "Promo code"} />
              <button onClick={() => applyCode(couponCode)} disabled={applying}>{applying ? "…" : (ar ? "تفعيل" : "Apply")}</button>
            </div>
            {!coupon.valid && couponHint && (
              <div className="coupon-hint">
                <Sparkles size={12} /> {ar ? `كود العرض ${couponHint} جاهز للتطبيق` : `Offer code ${couponHint} ready`}
                <button onClick={() => applyCode(couponHint)} aria-label="apply offer code"><Plus size={12} /></button>
              </div>
            )}
            {coupon.valid && (
              <div className="coupon-applied">
                <Check size={14} /> {coupon.message} · {ar ? `وفّرتِ ${money(discount)}` : `You saved ${money(discount)}`}
                <button onClick={() => { setCoupon({ valid: false, code: "", discount: 0, message: "" }); setCouponCode(""); }} aria-label="remove coupon">×</button>
              </div>
            )}
            <div className="summary-total"><span>{ar ? "الإجمالي" : "Total"}</span><strong>{money(grandTotal)}</strong></div>
            <button className="button button-dark full" onClick={checkout} disabled={saving}><MessageCircle size={17} />{ar ? "إتمام الطلب عبر واتساب" : "Checkout via WhatsApp"}</button>
            <p className="secure-note"><ShieldCheck size={15} />{ar ? "تسجيل آمن · الدفع عند الاستلام" : "Secure order · Cash on delivery"}</p>
            <a className="track-hint" href="#/track"><Package size={14} />{ar ? "تتبعي طلباتكِ السابقة" : "Track your previous orders"}<ArrowLeft size={13} /></a>
          </div>
        </div>
      )}
      {suggestMode && cartSuggest !== null && cartSuggest.length > 0 && (
        <section className="also-saved page-suggest" aria-label={suggestMode === "complete"
          ? (ar ? "مقترحات لكمّل حقيبتكِ" : "Suggestions to complete your bag")
          : (ar ? "الأكثر حفظًا لدى الزوار" : "Most saved by visitors")}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{suggestMode === "complete"
                ? (ar ? "الأكثر حفظًا — خارج حقيبتكِ" : "MOST SAVED — NOT IN YOUR BAG")
                : (ar ? "الأكثر حفظًا لدى الزوار" : "MOST SAVED BY VISITORS")}</span>
              <h2>{suggestMode === "complete" ? (ar ? "كمّلي حقيبتكِ." : "Complete your bag.") : (ar ? "ابدئي مما أحبّه الزوار." : "Start with what visitors love.")}</h2>
            </div>
          </div>
          <div
            ref={suggestRailRef}
            className={`also-saved-rail${suggestRailScroll.scrollable ? " is-scrollable" : ""}${suggestRailScroll.atStart ? " at-start" : ""}${suggestRailScroll.atEnd ? " at-end" : ""}`}
            tabIndex={suggestRailScroll.scrollable ? 0 : undefined}
            role={suggestRailScroll.scrollable ? "group" : undefined}
            aria-label={suggestRailScroll.scrollable ? (ar ? "منتجات مقترحة — اسحبي لعرض المزيد" : "Suggested products — scroll for more") : undefined}
          >
            <AlsoSavedCards items={cartSuggest} ar={ar} />
          </div>
        </section>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────── Wishlist
export function WishlistView({ lang, products, wishCounts = {}, wishIds, toggleWish, addToCart, ratings = {} }: {
  lang: "ar" | "en"; products: Product[]; wishCounts?: Record<string, number>; wishIds: string[]; toggleWish: (id: string) => void; addToCart: (p: Product) => void;
  ratings?: Record<string, RatingSummary>;
}) {
  const ar = lang === "ar";
  const wished = products.filter(p => wishIds.includes(p.id));
  // R61 — wishlist cross-sell: the surfaces trilogy closes (PDP rail → cart
  // strip → wishlist strip), zero new API. An EMPTY wishlist gets the
  // store-wide top saves; a non-empty one gets the most-saved products NOT
  // already on it (exclude = wishIds, the R60 contract) — the most-saved
  // products are exactly what a wishlist-heavy shopper already saved, so
  // suggesting them back would be noise wearing a suggestion's clothes.
  const [listSuggest, setListSuggest] = useState<AlsoSavedItem[] | null>(null);
  const listIds = wishIds.join(",");
  useEffect(() => {
    let alive = true;
    const qs = listIds ? `?exclude=${encodeURIComponent(listIds)}` : "";
    fetch(`/api/store/products/also-saved${qs}`)
      .then(res => res.json())
      .then(data => { if (alive) setListSuggest(data?.success && Array.isArray(data.items) ? data.items : []); })
      .catch(() => { if (alive) setListSuggest([]); });
    return () => { alive = false; };
  }, [listIds]);
  const { railRef: listRailRef, railScroll: listRailScroll } = useRailScroll([listSuggest]);
  return (
    <main className="container wishlist-page">
      <div className="page-heading"><span className="eyebrow">LUBNÉL / WISHLIST</span><h1>{ar ? "قائمة أمنياتكِ" : "Your wishlist"}</h1></div>
      {wished.length ? (
        <div className="product-grid">
          {wished.map(p => <ProductCard key={p.id} product={p} lang={lang} rating={ratings[p.id]} wishCount={wishCounts[p.id]} isWish toggleWish={() => toggleWish(p.id)} addToCart={() => addToCart(p)} />)}
        </div>
      ) : (
        <div className="large-empty">
          <Heart size={34} />
          <h3>{ar ? "لم تحفظي أي منتج بعد" : "Nothing saved yet"}</h3>
          <p>{ar ? "احتفظي بما تحبينه ليكون قريبًا منكِ." : "Save the pieces you love so they're close when you need them."}</p>
          <a href="#/shop" className="button button-dark">{ar ? "ابدئي الاكتشاف" : "Start exploring"}</a>
        </div>
      )}
      {listSuggest !== null && listSuggest.length > 0 && (
        <section className="also-saved page-suggest" aria-label={wished.length
          ? (ar ? "مقترحات لكمّل قائمتكِ" : "Suggestions to complete your list")
          : (ar ? "الأكثر حفظًا لدى الزوار" : "Most saved by visitors")}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{wished.length
                ? (ar ? "الأكثر حفظًا — خارج قائمتكِ" : "MOST SAVED — NOT ON YOUR LIST")
                : (ar ? "الأكثر حفظًا لدى الزوار" : "MOST SAVED BY VISITORS")}</span>
              <h2>{wished.length ? (ar ? "كمّلي قائمتكِ." : "Complete your list.") : (ar ? "قائمتكِ هادئة… ابدئي من هنا." : "A quiet list — start here.")}</h2>
            </div>
          </div>
          <div
            ref={listRailRef}
            className={`also-saved-rail${listRailScroll.scrollable ? " is-scrollable" : ""}${listRailScroll.atStart ? " at-start" : ""}${listRailScroll.atEnd ? " at-end" : ""}`}
            tabIndex={listRailScroll.scrollable ? 0 : undefined}
            role={listRailScroll.scrollable ? "group" : undefined}
            aria-label={listRailScroll.scrollable ? (ar ? "منتجات مقترحة — اسحبي لعرض المزيد" : "Suggested products — scroll for more") : undefined}
          >
            <AlsoSavedCards items={listSuggest} ar={ar} />
          </div>
        </section>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────── Static pages
const FAQ_ITEMS: { q: [string, string]; a: [string, string] }[] = [
  { q: ["كم تستغرق مدة التوصيل؟", "How long does delivery take?"], a: ["نشحن من القاهرة إلى جميع محافظات مصر خلال ٢ إلى ٥ أيام عمل، وتصلكِ رسالة واتساب بمجرد خروج طلبكِ للتوصيل.", "We ship from Cairo to every governorate in Egypt within 2–5 business days, and you'll get a WhatsApp message the moment your order is out for delivery."] },
  { q: ["هل الدفع عند الاستلام متاح؟", "Is cash on delivery available?"], a: ["نعم — الدفع عند الاستلام متاح على جميع الطلبات داخل مصر، ويمكنكِ أيضًا الدفع الإلكتروني إن كانت تفضّلين ذلك.", "Yes — cash on delivery works on every order inside Egypt, and you can pay online instead if you prefer."] },
  { q: ["ما هي سياسة الاستبدال والإرجاع؟", "What is the exchange and return policy?"], a: ["المنتجات غير المفتوحة قابلة للإرجاع خلال ١٤ يومًا من الاستلام. تواصلي معنا على واتساب وسنرشدكِ خطوة بخطوة — راحتكِ أولويتنا.", "Unopened products can be returned within 14 days of delivery. Reach us on WhatsApp and we'll walk you through it — your comfort comes first."] },
  { q: ["كيف أتابع طلبي؟", "How do I track my order?"], a: ["من صفحة \"تتبعي طلبكِ\" برقم هاتفكِ، أو اطلبي الرابط مباشرة من فريقنا على واتساب في أي وقت.", "Use the \"Track your order\" page with your phone number, or ask our WhatsApp team for the link anytime."] },
  { q: ["هل منتجات LUBNÉL أصلية؟", "Are LUBNÉL products authentic?"], a: ["كل منتج يصل إلينا من موزعين معتمدين ويصل إليكِ مغلقًا بختمه الأصلي — نتفقد كل قطعة قبل الشحن.", "Every product comes to us from authorized distributors and reaches you sealed with its original stamp — we inspect each piece before shipping."] },
];

const SHIP_ZONES: { zone: [string, string]; days: [string, string] }[] = [
  { zone: ["القاهرة والجيزة", "Cairo & Giza"], days: ["١–٢ أيام عمل", "1–2 business days"] },
  { zone: ["الإسكندرية والدلتا", "Alexandria & Delta"], days: ["٢–٤ أيام عمل", "2–4 business days"] },
  { zone: ["الصعيد والبحر الأحمر وسيناء", "Upper Egypt, Red Sea & Sinai"], days: ["٣–٥ أيام عمل", "3–5 business days"] },
];

const RETURN_STEPS: { t: [string, string]; d: [string, string] }[] = [
  { t: ["راسلينا واتساب", "Message us on WhatsApp"], d: ["خلال ١٤ يومًا من الاستلام — أرسلي رقم طلبكِ وصورة المنتج، ونؤكد لكِ فورًا.", "Within 14 days of delivery — send your order number and a photo of the product, and we'll confirm right away."] },
  { t: ["احفظي المنتج كما هو", "Keep the product as-is"], d: ["بغلافه الأصلي وغير مستخدم، مع أي بطاقات أو هدايا مرفقة — ثم نسلمه لمندوب الشحن.", "In its original sealed packaging, unused, with any cards or gifts included — then hand it to the courier."] },
  { t: ["استرداد أو استبدال", "Refund or exchange"], d: ["بعد فحص المنتج: استرداد كامل للمبلغ أو استبدال فوري بمنتج آخر تختارينه.", "After we inspect it: a full refund or an instant exchange for any product you choose."] },
];

const ABOUT_MILESTONES: { t: [string, string]; d: [string, string] }[] = [
  { t: ["بداية من القاهرة", "Born in Cairo"], d: ["بدأت LUBNÉL من ملاحظة بسيطة: أجمل الطقوس هي التي لا نحتاج شرحها لأحد.", "LUBNÉL began with a simple observation: the most beautiful rituals are the ones we never need to explain."] },
  { t: ["منتجات مختارة بعناية", "A curated catalog"], d: ["كل منتج من موزعين معتمدين، مغلق بختمه الأصلي، ويُفحص قبل الشحن إليكِ.", "Every product comes from authorized distributors, sealed with its original stamp, inspected before it ships."] },
  { t: ["مجتمع ينمو معنا", "A community growing with us"], d: ["تقييمات وصور حقيقية من عميلاتنا تشكّل متجرنا اليوم — ورأيكِ فيه القادم.", "Real reviews, ratings and photos from our customers shape the store today — and yours is next."] },
];

const CONTACT_HOURS: { t: [string, string]; d: [string, string] }[] = [
  { t: ["أيام العمل", "Working days"], d: ["السبت – الخميس", "Saturday – Thursday"] },
  { t: ["ساعات العمل", "Hours"], d: ["١٠ صباحًا – ١٠ مساءً", "10am – 10pm"] },
  { t: ["زمن الرد", "Response time"], d: ["داخل ساعات العمل عادة", "Usually within working hours"] },
];

export function StaticView({ lang, type }: { lang: "ar" | "en"; type: string }) {
  const ar = lang === "ar";
  const [openFaq, setOpenFaq] = useState(0);
  const content: Record<string, { ar: [string, string, string]; en: [string, string, string] }> = {
    about: { ar: ["قصتنا", "جمال يشبه الحياة الحقيقية.", "بدأت LUBNÉL من ملاحظة بسيطة: أن أجمل طقوسنا هي تلك التي لا تحتاج أن نشرحها لأحد. من القاهرة، نصنع مساحة للجمال اليومي — ناعمة، واثقة، ومصرية بطريقتها الخاصة."], en: ["Our story", "Beauty for real life.", "LUBNÉL began with a simple observation: our most beautiful rituals are the ones we never need to explain. From Cairo, we make space for everyday beauty — soft, confident, and distinctly our own."] },
    contact: { ar: ["تواصلي معنا", "نحن هنا لأجلكِ.", "لأي سؤال عن المنتجات أو الطلبات، اتركي لنا رسالة وسنعود إليكِ خلال ساعات العمل. يمكنكِ أيضًا مراسلتنا مباشرة على واتساب."], en: ["Contact", "We're here for you.", "For questions about products or orders, leave us a message and we'll get back to you during working hours. You can also reach us directly on WhatsApp."] },
    faq: { ar: ["الأسئلة الشائعة", "كل ما تريدين معرفته.", "التوصيل متاح إلى جميع محافظات مصر خلال 2 إلى 5 أيام عمل. الدفع عند الاستلام متاح على جميع الطلبات. المنتجات المفتوحة غير قابلة للإرجاع حفاظًا على سلامتكِ."], en: ["FAQ", "Everything you need to know.", "We deliver across Egypt in 2–5 business days. Cash on delivery is available on all orders. Opened products cannot be returned for your safety."] },
    shipping: { ar: ["الشحن والتوصيل", "من القاهرة إلى بابكِ.", "تصل طلباتكِ خلال 2 إلى 5 أيام عمل. الشحن مجاني للطلبات فوق 900 ج.م، ورسوم الشحن 60 ج.م للطلبات الأقل."], en: ["Shipping", "From Cairo to your door.", "Orders arrive within 2–5 business days. Delivery is complimentary on orders over 900 EGP, and 60 EGP below that."] },
    returns: { ar: ["الاستبدال والإرجاع", "مساحتكِ الآمنة.", "يمكن إرجاع المنتجات غير المفتوحة خلال 14 يومًا من الاستلام. تواصلي معنا عبر واتساب لنساعدكِ خطوة بخطوة."], en: ["Returns", "A safe space to change your mind.", "Unopened products can be returned within 14 days of delivery. Contact us on WhatsApp and we'll help you through it."] },
    account: { ar: ["حسابي", "أهلًا بكِ في LUBNÉL.", "يمكنكِ متابعة طلباتكِ والتواصل معنا مباشرة عبر واتساب. سنساعدكِ في كل خطوة من اختيار المنتجات حتى وصولها."], en: ["Account", "Welcome to LUBNÉL.", "Follow your orders and reach us directly on WhatsApp. We'll be with you from discovery to delivery."] },
  };
  const set = (ar ? content[type]?.ar : content[type]?.en) || content.about[ar ? "ar" : "en"];
  return (
    <main className="static-page container">
      <span className="eyebrow">LUBNÉL / {set[0].toUpperCase()}</span>
      <h1>{set[1]}</h1>
      <div className="static-layout">
        <div className="static-image"><img src={type === "about" ? "/images/hero-3.webp" : "/images/hero-2.png"} alt="" loading="lazy" decoding="async" /></div>
        <div className="static-copy">
          <p>{set[2]}</p>
          {type === "shipping" && (
            <div className="ship-block">
              <table className="ship-table">
                <thead><tr><th>{ar ? "المنطقة" : "Zone"}</th><th>{ar ? "مدة التوصيل" : "Delivery time"}</th></tr></thead>
                <tbody>
                  {SHIP_ZONES.map((z, i) => (
                    <tr key={i}><td>{ar ? z.zone[0] : z.zone[1]}</td><td>{ar ? z.days[0] : z.days[1]}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="ship-note"><Truck size={15} />{ar ? "رسوم الشحن ٦٠ ج.م، ومجاني للطلبات فوق ٩٠٠ ج.م — على كل المناطق." : "Shipping is 60 EGP, free on orders over 900 EGP — across all zones."}</p>
            </div>
          )}
          {type === "returns" && (
            <div className="return-steps">
              {RETURN_STEPS.map((s, i) => (
                <div className="return-step" key={i}>
                  <b>{i + 1}</b>
                  <div><strong>{ar ? s.t[0] : s.t[1]}</strong><p>{ar ? s.d[0] : s.d[1]}</p></div>
                </div>
              ))}
            </div>
          )}
          {type === "about" && (
            <div className="about-timeline">
              {ABOUT_MILESTONES.map((m, i) => (
                <div className="about-milestone" key={i}>
                  <i aria-hidden />
                  <div><strong>{ar ? m.t[0] : m.t[1]}</strong><p>{ar ? m.d[0] : m.d[1]}</p></div>
                </div>
              ))}
            </div>
          )}
          {type === "contact" && (
            <div className="contact-hours">
              {CONTACT_HOURS.map((h, i) => (
                <div className="contact-hour" key={i}><span>{ar ? h.t[0] : h.t[1]}</span><b>{ar ? h.d[0] : h.d[1]}</b></div>
              ))}
            </div>
          )}
          {type === "faq" && (
            <div className="faq-list">
              {FAQ_ITEMS.map((item, i) => (
                <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={i}>
                  <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>
                    <span>{ar ? item.q[0] : item.q[1]}</span>
                    <ChevronDown size={16} />
                  </button>
                  <div className="faq-answer"><p>{ar ? item.a[0] : item.a[1]}</p></div>
                </div>
              ))}
            </div>
          )}
          {type === "contact" && (
            <div className="contact-details">
              <div><Phone size={18} /><span>010 0000 0000</span></div>
              <div><Mail size={18} /><span>hello@lubnel.com</span></div>
              <div><MapPin size={18} /><span>{ar ? "القاهرة، مصر" : "Cairo, Egypt"}</span></div>
            </div>
          )}
          {type === "account" && (
            <a className="track-hint account-track" href="#/track"><Package size={16} />{ar ? "تتبعي طلباتكِ برقم هاتفكِ" : "Track your orders with your phone number"}<ArrowLeft size={14} /></a>
          )}
          <a href="#/shop" className="button button-dark">{ar ? "اكتشفي LUBNÉL" : "Explore LUBNÉL"}<ArrowUpRight size={16} /></a>
        </div>
      </div>
    </main>
  );
}
