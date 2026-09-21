'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Gift, MessageCircleHeart, Truck } from 'lucide-react';
import { EditorialCard } from '@/components/store/editorial-card';
import { Reveal } from '@/components/store/reveal';
import { AiStylistBanner } from '@/components/store/ai-stylist-banner';
import { useT } from '@/lib/i18n';
import type { SectionTexts } from '@/lib/section-texts';
import type { ProductCardData } from '@/components/store/product-card';

// resolved (all-defaults-filled) section texts
type SectionTextsResolved = { [K in keyof SectionTexts]-?: SectionTexts[K] };

interface CategoryData {
  slug: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  image: string | null;
}

export function HomeSections({
  categories,
  featured,
  texts,
  layout,
}: {
  categories: CategoryData[];
  featured: ProductCardData[];
  /** SUP-9 — Studio-editable section copy, resolved server-side over defaults */
  texts?: Partial<SectionTexts>;
  /** U17-HOME-EDITOR — per-section visibility + template from Studio → الصفحة الرئيسية */
  layout?: {
    categories: { visible: boolean; template: 'grid' | 'rail' };
    featured: { visible: boolean; template: 'grid' | 'rail' };
    whatsapp: {
      visible: boolean;
      template: 'banner' | 'strip';
      /** U22 — وسائط بانر الدعوة (image/video behind the CTA gradient) */
      bannerImage?: string;
      bannerVideo?: string;
    };
  };
}) {
  const { ar, t } = useT();
  const s = texts as SectionTextsResolved | undefined;
  const catL = layout?.categories ?? { visible: true, template: 'grid' as const };
  const featL = layout?.featured ?? { visible: true, template: 'grid' as const };
  const ctaL = layout?.whatsapp ?? { visible: true, template: 'banner' as const };

  return (
    <>
      {/* trust strip — U10-TRUSTRIP: on phones this used to render as a
          loose centered stack (ragged widths → owner: «باين انه عشوايي»),
          then a 2-per-view snap rail (owner: «ميضطرش قلب للجنب علشان
          ايقونة واحدة» — the third card needed a sideways swipe). Now the
          phone shows a true 3-up compact grid: all three icons side by
          side, nothing to swipe, and the swipe-hint line is gone with it.
          sm+ keeps the approved 3-column row layout untouched. */}
      <section className="overflow-x-clip border-b border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-4">
            {[
              { icon: Truck, t: s ? (ar ? s.trust1TitleAr : s.trust1TitleEn) : ar ? 'شحن مجاني' : 'Free shipping', s: s ? (ar ? s.trust1SubAr : s.trust1SubEn) : ar ? 'للطلبات فوق 900 ج.م' : 'over 900 EGP' },
              { icon: BadgeCheck, t: s ? (ar ? s.trust2TitleAr : s.trust2TitleEn) : ar ? 'منتجات أصلية' : 'Authentic products', s: s ? (ar ? s.trust2SubAr : s.trust2SubEn) : ar ? 'مصادر موثوقة 100%' : '100% trusted sources' },
              { icon: Gift, t: s ? (ar ? s.trust3TitleAr : s.trust3TitleEn) : ar ? 'بوكسات جاهزة للإهداء' : 'Gift-ready boxes', s: s ? (ar ? s.trust3SubAr : s.trust3SubEn) : ar ? 'تغليف أنيق لكل طلب' : 'elegant packaging' },
            ].map(({ icon: Icon, t: title, s }, i) => (
              <Reveal key={title} delay={i * 90} className="h-full">
              <div
                className="flex h-full flex-col items-center gap-2 rounded-xl border border-border/60 bg-card px-1.5 py-3 text-center shadow-sm sm:flex-row sm:gap-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right sm:shadow-none"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-primary ring-1 ring-primary/10 sm:h-10 sm:w-10 sm:bg-card sm:shadow-sm sm:ring-0">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                </span>
                {/* line-clamps guard the compact card against long
                    Studio-authored copy (trust*Title/Sub are owner-editable) */}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] font-bold leading-tight sm:text-[13px]">{title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">{s}</p>
                </div>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* categories — U17: grid / rail / U24-CATS-EDITORIAL templates, hideable.
          U25-RHYTHM — every homepage section now shares one spacing scale
          (py-10 sm:py-12, header→content mt-6 sm:mt-8) — the owner: «التباعد
          بين الأقسام مش موحّد». U25-MOTION — headers and content rise in. */}
      {catL.visible && (
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{s ? (ar ? s.categoriesTitleAr : s.categoriesTitleEn) : t.shopByCat}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{s ? (ar ? s.categoriesSubAr : s.categoriesSubEn) : t.shopByCatSub}</p>
          </div>
          {catL.template === 'editorial' && (
            <Link href="/c/all" className="group inline-flex shrink-0 items-center gap-1 pb-1 text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
              كل التصنيفات
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          )}
        </div>
        </Reveal>

        {catL.template === 'editorial' ? (
        /* U24-CATS-EDITORIAL — «كل Category لها شخصية بصرية» (owner): the
           uniform 6-card grid becomes an asymmetric magazine mosaic — one
           BIG hero tile + alternating wide/narrow spans + a closing trio.
           Spans are static class strings (Tailwind JIT can't see dynamic
           interpolation). Fallback cycle keeps the mosaic sane if the owner
           adds categories later. Mobile: hero full-width + 2-col stack. */
        <Reveal delay={80} className="mt-6 sm:mt-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:auto-rows-[320px] md:grid-cols-12 lg:auto-rows-[440px]">
          {categories.slice(0, 8).map((c, i) => {
            const hero = i === 0;
            const finale = i === 6;
            const P = [7, 5, 5, 7, 4, 4, 4, 6, 6, 7, 5, 4, 4, 4];
            const span = P[i] ?? (i % 2 === 1 ? 4 : 8);
            const spanClass = span === 12 ? 'md:col-span-12' : span === 5 ? 'md:col-span-5' : span === 7 ? 'md:col-span-7' : span === 6 ? 'md:col-span-6' : 'md:col-span-4';
            return (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className={`group relative overflow-hidden rounded-2xl border border-border/60 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/15 ${hero ? 'col-span-2' : ''} ${spanClass}`}
              >
                <div className={`h-full w-full ${hero ? 'aspect-[16/10] md:aspect-auto' : finale ? 'aspect-[16/10] md:aspect-auto' : 'aspect-[4/5] md:aspect-auto'}`}>
                  <img
                    src={c.image || '/products/placeholder-box.svg'}
                    alt={ar ? c.nameAr : c.nameEn}
                    loading={hero ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                {/* neutral cinematic gradient — wine would colourise the photos */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden />
                <div className="absolute bottom-0 w-full p-4 text-primary-foreground sm:p-5">
                  <h3 className={hero ? 'text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl' : 'text-base font-extrabold leading-tight sm:text-lg'}>
                    {ar ? c.nameAr : c.nameEn}
                  </h3>
                  {c.description && (
                    <p className={`mt-1 line-clamp-2 opacity-90 ${hero || finale ? 'text-xs sm:text-sm' : 'hidden text-[11px] sm:block sm:text-xs'}`}>
                      {c.description}
                    </p>
                  )}
                  <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-sm transition-colors duration-300 group-hover:bg-primary-foreground group-hover:text-foreground">
                    تسوّقي الآن
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        </Reveal>
        ) : catL.template === 'rail' ? (
          <Reveal className="mt-6 sm:mt-8">
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className="group relative w-[70%] shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 sm:w-[31%]"
              >
                <div className="aspect-[4/3] overflow-hidden bg-secondary/40">
                  <img
                    src={c.image || '/products/placeholder-box.svg'}
                    alt={ar ? c.nameAr : c.nameEn}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-primary/75 via-primary/15 to-transparent" aria-hidden />
                <div className="absolute bottom-0 w-full p-4 text-primary-foreground">
                  <h3 className="text-base font-extrabold">{ar ? c.nameAr : c.nameEn}</h3>
                  {c.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs opacity-90">{c.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          </Reveal>
        ) : (
        <Reveal className="mt-6 sm:mt-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categories.slice(0, 8).map((c) => (
            <Link
              key={c.slug}
              href={`/c/${c.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-border/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="aspect-[4/3] overflow-hidden bg-secondary/40">
                { }
                <img
                  src={c.image || '/products/placeholder-box.svg'}
                  alt={ar ? c.nameAr : c.nameEn}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/75 via-primary/15 to-transparent" aria-hidden />
              <div className="absolute bottom-0 w-full p-4 text-primary-foreground">
                <h3 className="text-base font-black">{ar ? c.nameAr : c.nameEn}</h3>
                {c.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs opacity-90">{c.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
        </Reveal>
        )}
      </section>
      )}

      {/* featured — U17: grid or horizontal rail template, hideable.
          U23-FEATURED-SWIPE — the owner: «الأكثر رواجًا… المستخدم مش هيقعد
          يعمل اسكرول كتير». Below sm the section used to render the 2-col
          grid = 4 rows of tall cards ≈ 1550px of scrolling on a 390px phone.
          It's now a premium snap rail (one card + a peek, progress bar,
          «عرض الكل» jump to /c/all) NO MATTER the Studio template — the
          template choice keeps governing sm+ where the approved grid/rail
          markup renders unchanged. One DOM tree, breakpoint-switched. */}
      {featL.visible && (
      <section className="w-full bg-secondary/30 py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{s ? (ar ? s.featuredTitleAr : s.featuredTitleEn) : t.bestSellers}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{s ? (ar ? s.featuredSubAr : s.featuredSubEn) : t.bestSellersSub}</p>
            </div>
            {/* U25-BTNTIER — secondary pill: same style as «شاهدي الكل» in
                offers, so the two “view all” pills read as one system */}
            <Link
              href="/c/all"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-card px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-secondary active:scale-[0.97] sm:text-[13px]"
            >
              {ar ? 'عرض الكل' : 'View all'}
              <ArrowLeft className={`h-3.5 w-3.5 ${ar ? '' : 'rotate-180'}`} aria-hidden />
            </Link>
          </div>
          </Reveal>

          <Reveal delay={80}>
          <FeaturedTrack featured={featured} template={featL.template} title={s ? (ar ? s.featuredTitleAr : s.featuredTitleEn) : t.bestSellers} />
          </Reveal>
        </div>
      </section>
      )}

      {/* CTA banner — U17: big banner or compact strip template, hideable.
          U22-OWNER-ARTWORK — the big template now renders the owner's exact
          reference artwork (the terracotta AI STYLIST banner with the white
          «اسألي لُو الآن» pill) instead of the plain primary gradient box;
          the strip keeps Studio copy but its pill opens Lou, not WhatsApp. */}
      {ctaL.visible && (
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <Reveal>
        {ctaL.template === 'strip' ? (
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-5 shadow-sm sm:flex-row sm:px-7">
            <div className="text-center sm:text-right">
              <h2 className="text-base font-extrabold">{s ? (ar ? s.ctaTitleAr : s.ctaTitleEn) : t.askLou}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{s ? (ar ? s.ctaSubAr : s.ctaSubEn) : t.askLouSub}</p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-lou'))}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              <MessageCircleHeart className="h-4 w-4" aria-hidden />
              {ar ? 'اسألي لُو الآن' : 'Ask Lou now'}
            </button>
          </div>
        ) : (
          <AiStylistBanner media={{ image: ctaL.bannerImage, video: ctaL.bannerVideo }} />
        )}
        </Reveal>
      </section>
      )}
    </>
  );
}

// U23-FEATURED-SWIPE — the swipeable featured track. Mobile: horizontal snap
// rail (64vw cards + peek, hidden scrollbar, progress bar underneath).
// sm+: the Studio template decides — «rail» keeps a 31%/23.5% snap rail,
// «grid» restores the approved 2/3/4-column grid byte-for-byte.
function FeaturedTrack({
  featured,
  template,
  title,
}: {
  featured: ProductCardData[];
  template: 'grid' | 'rail';
  title: string;
}) {
  const { ar } = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Direction-proof progress mapping (RTL scrollLeft is negative → abs()).
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const span = el.scrollWidth - el.clientWidth;
    if (span <= 0) {
      setActive(0);
      return;
    }
    const idx = Math.round((Math.abs(el.scrollLeft) / span) * (featured.length - 1));
    setActive(Math.max(0, Math.min(featured.length - 1, idx)));
  };

  return (
    <>
      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={title}
        className={`mt-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none sm:mt-8 sm:gap-4 ${
          template === 'rail'
            ? ''
            : 'sm:grid sm:grid-cols-2 sm:snap-none sm:overflow-visible sm:pb-0 md:grid-cols-3 lg:grid-cols-4'
        }`}
      >
        {featured.map((p, i) => (
          <div
            key={p.id}
            className={`h-full w-[calc(100%-3.5rem)] max-w-[320px] shrink-0 snap-start ${
              template === 'rail' ? 'sm:w-[31%] lg:w-[23.5%]' : 'sm:w-auto'
            } sm:max-w-none`}
          >
            <Reveal delay={Math.min(i * 60, 300)}>
              <EditorialCard product={p} />
            </Reveal>
          </div>
        ))}
      </div>

      {/* mobile-only swipe progress — signals «there's more, swipe» the same
          way the reviews carousel does (one shared rail language) */}
      {featured.length > 1 && (
        <div className="mx-auto mt-4 h-1 w-24 overflow-hidden rounded-full bg-border sm:hidden" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-transform duration-300"
            style={{
              width: `${100 / featured.length}%`,
              transform: `translateX(${(ar ? -1 : 1) * active * 100}%)`,
            }}
          />
        </div>
      )}
    </>
  );
}
