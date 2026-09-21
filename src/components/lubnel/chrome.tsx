"use client";

// LUBNÉL storefront chrome: header, footer, bottom nav, search, product card, hero slider
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUp, Eye, Facebook, Heart, Instagram,
  LayoutDashboard, Menu, MessageCircle, Package, Plus, Search, Share2, ShoppingBag,
  UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { money, searchScore } from "@/lib/lubnel-helpers";
import type { Product, HeroSlide, RatingSummary } from "@/lib/lubnel-types";

export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <a href="#/" className={`brand-mark ${inverse ? "brand-mark-inverse" : ""} ${compact ? "brand-mark-compact" : ""}`} aria-label="LUBNÉL home">
      <span className="brand-word">LUBNÉL</span><span className="brand-symbol">L</span>
    </a>
  );
}

// Accessible star row from a real average — fill overlay clipped by percentage (4.6 → 92% gold fill)
export function Stars({ average, count, lang, showCount = true }: { average: number; count: number; lang: "ar" | "en"; showCount?: boolean }) {
  const pct = Math.max(0, Math.min(100, (average / 5) * 100));
  const ar = lang === "ar";
  return (
    <span className="stars-real" role="img" aria-label={`${average} ${ar ? "من" : "of"} 5${showCount && count ? ` · ${count} ${ar ? "تقييم" : "reviews"}` : ""}`}>
      <span className="stars-stack" aria-hidden>
        <span className="stars-base">★★★★★</span>
        <span className="stars-fill" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      <b>{average.toFixed(1)}</b>
      {showCount && count > 0 && <small>{ar ? `(${count} تقييم)` : `(${count} reviews)`}</small>}
    </span>
  );
}

export function Header({ lang, setLang, cartCount, wishCount, onSearch, announcement }: {
  lang: "ar" | "en"; setLang: (l: "ar" | "en") => void; cartCount: number; wishCount: number; onSearch: () => void;
  announcement?: { ar: string; en: string };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ar = lang === "ar";
  const nav = ar ? ["تسوّقي", "المجموعات", "الجديد", "الأكثر مبيعًا", "قصتنا"] : ["Shop", "Collections", "New in", "Best sellers", "Our story"];
  const navPaths = ["#/shop", "#/shop?category=Sets", "#/shop?sort=new", "#/shop?sort=best", "#/about"];
  return (
    <>
      <div className="announcement">
        <span>{announcement ? (ar ? announcement.ar : announcement.en) : (ar ? "شحن مجاني للطلبات فوق 900 ج.م · توصيل لكل مصر" : "Complimentary delivery over 900 EGP · Nationwide shipping")}</span>
        <a href="#/track" className="announcement-track">{ar ? "تتبعي طلبكِ" : "Track order"}</a>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label={ar ? "فتح القائمة" : "Open menu"}><Menu size={21} /></button>
          <BrandMark />
          <nav className="desktop-nav" aria-label="Primary navigation">{nav.map((label, i) => <a href={navPaths[i]} key={label}>{label}</a>)}</nav>
          <div className="header-actions">
            <button className="header-link search-trigger" onClick={onSearch}><Search size={19} /><span className="desktop-only">{ar ? "بحث" : "Search"}</span></button>
            <button className="header-link lang-switch desktop-only" onClick={() => setLang(ar ? "en" : "ar")}>{ar ? "EN" : "ع"}</button>
            <a href="#/wishlist" className="header-link desktop-only badge-wrap"><Heart size={19} /><span>{ar ? "المفضلة" : "Wishlist"}</span>{wishCount > 0 && <b>{wishCount}</b>}</a>
            <a href="#/account" className="header-link desktop-only"><UserRound size={19} /><span>{ar ? "حسابي" : "Account"}</span></a>
            <a href="#/cart" className="header-link badge-wrap"><ShoppingBag size={20} /><span className="desktop-only">{ar ? "الحقيبة" : "Bag"}</span>{cartCount > 0 && <b>{cartCount}</b>}</a>
          </div>
        </div>
        <div className="mobile-nav-row">
          <button onClick={onSearch}><Search size={17} /> {ar ? "ابحثي عن منتج أو فئة" : "Search products or categories"}</button>
          <button onClick={() => setLang(ar ? "en" : "ar")}>{ar ? "EN" : "ع"}</button>
        </div>
        <div className="shofy-category-bar">
          <a href="#/shop">{ar ? "كل المنتجات" : "All products"}</a>
          <a href="#/shop?category=Makeup">{ar ? "مكياج" : "Makeup"}</a>
          <a href="#/shop?category=Skincare">{ar ? "عناية بالبشرة" : "Skincare"}</a>
          <a href="#/shop?category=Fragrance">{ar ? "عطور" : "Fragrance"}</a>
          <a href="#/shop?category=Lips">{ar ? "شفايف" : "Lips"}</a>
          <a href="#/shop?sort=offers">{ar ? "العروض" : "Offers"}</a>
        </div>
      </header>
      {menuOpen && (
        <div className="overlay" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-top"><BrandMark compact /><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close"><X size={20} /></button></div>
            <div className="drawer-links">
              {nav.map((label, i) => <a href={navPaths[i]} key={label} onClick={() => setMenuOpen(false)}>{label}<ArrowLeft size={16} /></a>)}
              <a href="#/wishlist" onClick={() => setMenuOpen(false)}>{ar ? "المفضلة" : "Wishlist"}<Heart size={16} /></a>
              <a href="#/track" onClick={() => setMenuOpen(false)}>{ar ? "تتبعي طلبكِ" : "Track order"}<Package size={16} /></a>
              <a href="#/admin" onClick={() => setMenuOpen(false)}>{ar ? "لوحة الإدارة" : "Admin dashboard"}<LayoutDashboard size={16} /></a>
            </div>
            <div className="drawer-footer">
              <p>{ar ? "جمال يليق بكِ، من القاهرة إلى كل مكان." : "Beauty, made personal. From Cairo, everywhere."}</p>
              <div><Instagram size={18} /><Facebook size={18} /><MessageCircle size={18} /></div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export function Footer({ lang, onSubscribe }: { lang: "ar" | "en"; onSubscribe: (email: string) => void }) {
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <BrandMark inverse />
          <p className="footer-note">{ar ? "طقس جمالك، بصياغة مصرية معاصرة." : "Your beauty ritual, reimagined in Cairo."}</p>
          <div className="socials">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={17} /></a>
            <a href="https://wa.me/201000000000" target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a>
          </div>
        </div>
        <div>
          <h4>{ar ? "تسوّقي" : "Shop"}</h4>
          <a href="#/shop">{ar ? "كل المنتجات" : "All products"}</a>
          <a href="#/shop?category=Sets">{ar ? "المجموعات" : "Collections"}</a>
          <a href="#/shop?sort=new">{ar ? "الجديد" : "New in"}</a>
          <a href="#/shop?sort=best">{ar ? "الأكثر مبيعًا" : "Best sellers"}</a>
          <a href="#/shop?sort=rating">{ar ? "الأعلى تقييمًا ★" : "Top rated ★"}</a>
          <a href="#/shop?sort=offers">{ar ? "العروض" : "Offers"}</a>
        </div>
        <div>
          <h4>{ar ? "مساعدتك" : "Help"}</h4>
          <a href="#/track">{ar ? "تتبعي طلبكِ" : "Track order"}</a>
          <a href="#/faq">{ar ? "الأسئلة الشائعة" : "FAQ"}</a>
          <a href="#/shipping">{ar ? "الشحن والتوصيل" : "Shipping"}</a>
          <a href="#/returns">{ar ? "الاستبدال والإرجاع" : "Returns"}</a>
          <a href="#/contact">{ar ? "تواصلي معنا" : "Contact"}</a>
          <a href="#/account">{ar ? "حسابي" : "Account"}</a>
        </div>
        <div>
          <h4>{ar ? "النشرة البريدية" : "The edit"}</h4>
          <p className="footer-copy">{ar ? "إلهام، وصول مبكر، وطقوس جمال مختارة بعناية." : "Early access, beauty notes, and considered rituals."}</p>
          <div className="newsletter-inline">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder={ar ? "بريدك الإلكتروني" : "Your email address"} type="email" />
            <button type="button" aria-label="Subscribe" onClick={() => { if (!email.trim()) { toast.error(ar ? "اكتبي بريدك أولًا" : "Enter your email first"); return; } onSubscribe(email); setEmail(""); }}>
              {ar ? "تسجيل" : "Join"}
            </button>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 LUBNÉL. {ar ? "جميع الحقوق محفوظة" : "All rights reserved."}</span>
        <span>{ar ? "صنع بحب في القاهرة" : "Made with care in Cairo"}</span>
      </div>
    </footer>
  );
}

export function MobileBottomNav({ lang, cartCount, wishCount }: { lang: "ar" | "en"; cartCount: number; wishCount: number }) {
  const ar = lang === "ar";
  return (
    <nav className="mobile-bottom-nav" aria-label={ar ? "تنقل المتجر" : "Store navigation"}>
      <a href="#/" className="mobile-bottom-item"><LayoutDashboard size={19} /><span>{ar ? "الرئيسية" : "Home"}</span></a>
      <a href="#/shop" className="mobile-bottom-item"><Search size={19} /><span>{ar ? "تسوّقي" : "Shop"}</span></a>
      <a href="#/wishlist" className="mobile-bottom-item badge-wrap"><Heart size={19} /><span>{ar ? "المفضلة" : "Wishlist"}</span>{wishCount > 0 && <b>{wishCount}</b>}</a>
      <a href="#/cart" className="mobile-bottom-item badge-wrap"><ShoppingBag size={19} /><span>{ar ? "الحقيبة" : "Bag"}</span>{cartCount > 0 && <b>{cartCount}</b>}</a>
    </nav>
  );
}

export function SearchPanel({ open, close, lang, products }: { open: boolean; close: () => void; lang: "ar" | "en"; products: Product[] }) {
  const [term, setTerm] = useState("");
  const ar = lang === "ar";
  const results = useMemo(
    () => products.map(product => ({ product, score: searchScore(product, term) }))
      .filter(result => !term.trim() || result.score > 0)
      .sort((a, b) => b.score - a.score).slice(0, 5).map(result => result.product),
    [products, term],
  );
  if (!open) return null;
  return (
    <div className="overlay search-overlay" onClick={close}>
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <div className="search-panel-head"><span>{ar ? "ماذا تبحثين عنه؟" : "What are you looking for?"}</span><button className="icon-button" onClick={close} aria-label="Close"><X size={20} /></button></div>
        <div className="search-input-wrap">
          <Search size={20} />
          <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder={ar ? "ابحثي عن منتج، فئة، أو مكوّن" : "Search a product, category, or ingredient"} />
        </div>
        {term ? (
          <div className="search-results">
            {results.map(p => (
              <a href={`#/product/${p.id}`} onClick={() => { close(); toast.success(ar ? "تم فتح المنتج" : "Product opened"); }} key={p.id}>
                <img src={p.image} alt={p.alt} loading="lazy" decoding="async" />
                <div><strong>{ar ? p.nameAr : p.name}</strong><span>{ar ? p.categoryAr : p.category} · {money(p.price)}</span></div>
                <ArrowLeft size={16} />
              </a>
            ))}
            {results.length === 0 && <div className="empty-state"><Search size={25} /><p>{ar ? "لم نجد ما تبحثين عنه بعد." : "No results yet."}</p></div>}
          </div>
        ) : (
          <div className="search-suggestions">
            <span>{ar ? "الأكثر بحثًا" : "Popular searches"}</span>
            <div>
              <button onClick={() => setTerm("Blush")}>Blush</button>
              <button onClick={() => setTerm("Makeup")}>{ar ? "مكياج" : "Makeup"}</button>
              <button onClick={() => setTerm("Skincare")}>{ar ? "عناية بالبشرة" : "Skincare"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NavigationProgress({ routeKey }: { routeKey: string }) {
  // CSS-only progress bar: animation replays on every route key change, no state needed
  return <div key={routeKey} className="navigation-progress" role="status" aria-label="Loading"><span /></div>;
}

export function ProductCard({ product, lang, isWish, toggleWish, addToCart, rating, rank, trendRank, wishCount, onQuickView }: {
  product: Product; lang: "ar" | "en"; isWish: boolean; toggleWish: () => void; addToCart: () => void; rating?: RatingSummary;
  rank?: number; trendRank?: number; wishCount?: number; onQuickView?: () => void;
}) {
  const ar = lang === "ar";
  const salePct = product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  // R45 — social-proof copy with proper Arabic number agreement
  // (1 مرة واحدة / 2 مرتين / 3–10 مرات / 11+ مرة).
  const wishProof = wishCount && wishCount > 0
    ? (ar
      ? wishCount === 1 ? "حُفظت مرة واحدة" : wishCount === 2 ? "حُفظت مرتين" : wishCount <= 10 ? `حُفظت ${wishCount} مرات` : `حُفظت ${wishCount} مرة`
      : `${wishCount} ${wishCount === 1 ? "save" : "saves"}`)
    : null;
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <a href={`#/product/${product.id}`} className="product-image"><img src={product.image} alt={product.alt} loading="lazy" /><span className="image-shine" /></a>
        {product.badge && <span className="product-badge">{ar ? product.badgeAr : product.badge}</span>}
        {salePct > 0 && <span className="sale-pct">−{salePct}%</span>}
        {rank !== undefined && rank >= 1 && rank <= 3 && (
          <span className={`rank-chip rank-${rank}`} title={ar ? `رقم ${rank} في الأعلى تقييمًا` : `Rank #${rank} top rated`}>
            <i aria-hidden>★</i> {ar ? `الأعلى تقييمًا #${rank}` : `Top rated #${rank}`}
          </span>
        )}
        {trendRank !== undefined && trendRank >= 1 && trendRank <= 3 && (
          <span className={`trend-chip trend-${trendRank}`} title={ar ? `رقم ${trendRank} في الأكثر مشاركة` : `Rank #${trendRank} most shared`}>
            <Share2 size={11} aria-hidden /> {ar ? `رائج #${trendRank}` : `Trending #${trendRank}`}
          </span>
        )}
        <button className={`wish-button ${isWish ? "active" : ""}`} onClick={toggleWish} aria-label={ar ? "إضافة للمفضلة" : "Add to wishlist"}>
          <Heart size={18} fill={isWish ? "currentColor" : "none"} />
        </button>
        {onQuickView && (
          <button className="quick-view" onClick={onQuickView} aria-label={ar ? "عرض سريع" : "Quick view"} title={ar ? "عرض سريع" : "Quick view"}>
            <Eye size={16} /><span>{ar ? "نظرة سريعة" : "Quick view"}</span>
          </button>
        )}
        <button className="quick-add" onClick={addToCart}><Plus size={15} /> {ar ? "أضيفي للحقيبة" : "Add to bag"}</button>
      </div>
      <a href={`#/product/${product.id}`} className="product-info">
        <div className="product-meta"><span>{ar ? product.categoryAr : product.category}</span>{product.stock < 10 && <span className="low-stock">{ar ? "متبقي قليل" : "Low stock"}</span>}{(product.shareCount || 0) >= 3 && <span className="share-hint" title={ar ? `تمت مشاركته ${product.shareCount} مرة` : `Shared ${product.shareCount} times`}><Share2 size={10} aria-hidden />{product.shareCount} {ar ? "مشاركة" : "shares"}</span>}{wishProof && <span className="wish-proof" title={ar ? `${product.nameAr}: ${wishProof}` : `${product.name}: ${wishProof}`}><Heart size={10} aria-hidden />{wishProof}</span>}</div>
        <h3>{ar ? product.nameAr : product.name}</h3>
        {rating && rating.count > 0
          ? <Stars average={rating.average} count={rating.count} lang={lang} />
          : <span className="card-rating card-rating-new">{ar ? "✦ جديد في المتجر" : "✦ New in"}</span>}
        <div className="price-row"><span className="price">{money(product.price)}</span>{product.oldPrice && <del>{money(product.oldPrice)}</del>}</div>
      </a>
    </article>
  );
}

export function HeroSlider({ lang, slides, initialSlideId }: { lang: "ar" | "en"; slides: HeroSlide[]; initialSlideId?: string }) {
  const ar = lang === "ar";
  const enabled = slides.filter(s => s.active);
  // R29 — deep-linked campaigns open on their slide (?s=<id> from /s/[id])
  const [rawIndex, setIndex] = useState(() => {
    if (!initialSlideId) return 0;
    const i = enabled.findIndex(s => s.id === initialSlideId);
    return i > 0 ? i : 0;
  });
  const index = enabled.length ? rawIndex % enabled.length : 0;
  // Slides hydrate asynchronously (bootstrap fetch) — re-sync via render-phase
  // update (allowed derived-state pattern; setState-in-effect is forbidden).
  const [syncedId, setSyncedId] = useState<string | undefined>(undefined);
  if (initialSlideId && initialSlideId !== syncedId && enabled.length) {
    const i = enabled.findIndex(s => s.id === initialSlideId);
    if (i > 0) setIndex(i);
    setSyncedId(initialSlideId);
  }
  const current = enabled[index];
  useEffect(() => {
    if (enabled.length < 2) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % enabled.length), 5200);
    return () => window.clearInterval(timer);
  }, [enabled.length]);
  const move = (direction: number) => { if (enabled.length < 2) return; setIndex(i => (i + direction + enabled.length) % enabled.length); };
  // R30 — campaign shares feed the studio analytics (fire-and-forget)
  const registerCampaignShare = (channel: "native" | "copy") => {
    if (!current) return;
    fetch("/api/store/campaigns/share", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideId: current.id, channel }),
    }).catch(() => undefined);
  };
  // R29 — share the current slide as a /s/<id> campaign deep link
  const shareSlide = async () => {
    if (!current) return;
    const url = `${window.location.origin}/s/${encodeURIComponent(current.id)}`;
    const text = oneLineText(ar ? current.titleAr : current.titleEn);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${text} — LUBNÉL`, text, url });
        registerCampaignShare("native");
        return;
      }
    } catch { /* user dismissed the share sheet — fall through to copy */ }
    const done = () => { toast.success(ar ? "تم نسخ رابط العرض" : "Offer link copied"); registerCampaignShare("copy"); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => legacyCopyLink(url, done));
    } else {
      legacyCopyLink(url, done);
    }
  };
  if (!current) return null;
  return (
    <section className="shofy-hero" aria-roledescription="carousel" aria-label={ar ? "شرائح LUBNÉL" : "LUBNÉL hero carousel"}>
      <div className="shofy-hero-slider">
        <div className="hero-slide-image" key={`${current.id}-image`}>
          <img src={current.image} alt={(ar ? current.titleAr : current.titleEn).replace("\n", " ")} fetchPriority="high" decoding="async" />
          <div className="hero-stamp" aria-hidden="true">
            <b>LUBNÉL</b>
            <span>CAIRO</span>
          </div>
        </div>
        <div className="hero-controls">
          <button onClick={() => move(1)} aria-label={ar ? "الشريحة السابقة" : "Previous slide"}>›</button>
          <div className="hero-dots">
            {enabled.map((slide, i) => (
              <button key={slide.id} className={i === index % enabled.length ? "active" : ""} onClick={() => setIndex(i)} aria-label={`${ar ? "الشريحة" : "Slide"} ${i + 1}`} />
            ))}
          </div>
          <button onClick={() => move(-1)} aria-label={ar ? "الشريحة التالية" : "Next slide"}>‹</button>
        </div>
      </div>
      <div className="shofy-hero-copy" key={`${current.id}-copy`}>
        <span className="shofy-kicker">{current.eyebrow}</span>
        <h1>{(ar ? current.titleAr : current.titleEn).split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}<b>{line}</b></span>)}</h1>
        <p>{ar ? current.bodyAr : current.bodyEn}</p>
        <a href="#/shop" className="shofy-primary">{ar ? current.ctaAr : current.ctaEn}<ArrowLeft size={16} /></a>
        <button type="button" className="hero-share" onClick={shareSlide} aria-label={ar ? "مشاركة العرض" : "Share this offer"}>
          <Share2 size={13} />
          <span>{ar ? "شاركي العرض" : "Share offer"}</span>
        </button>
        <div className="hero-count">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div /><span>{String(enabled.length).padStart(2, "0")}</span>
        </div>
      </div>
    </section>
  );
}

const RING_C = 2 * Math.PI * 20; // r=20 → circumference ≈ 125.66

// R29 — helpers for the hero share affordance
const oneLineText = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
function legacyCopyLink(url: string, done: () => void) {
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    done();
  } catch {
    toast.error("Copy failed");
  }
}

// R24 — floating back-to-top with a live scroll-progress ring.
// Appears after ~560px, rises above the mobile bottom nav, RTL-safe.
export function BackToTop() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      setVisible(window.scrollY > 560);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <button
      type="button"
      className={`back-top ${visible ? "show" : ""}`}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <svg className="ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle className="ring-track" cx="22" cy="22" r="20" />
        <circle
          className="ring-fill"
          cx="22" cy="22" r="20"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - progress)}
        />
      </svg>
      <ArrowUp size={16} strokeWidth={2.2} />
    </button>
  );
}
