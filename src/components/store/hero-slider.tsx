'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

/**
 * Hero slider — DB-backed via /api/store/slides (admin homepage editor),
 * with the recovered brand campaign slides as offline fallback.
 * U19-SLIDER — slides may carry an MP4 (muted autoplay loop) + height presets
 * controlled from Studio → الصفحة الرئيسية (قصير/عادي/طويل).
 * U21-MOBILE-HERO — phones no longer get the desktop hero squeezed down:
 * below sm the slider renders its OWN composition — a portrait/square media
 * area on top (slide.imageMobile when the owner uploads one, else the main
 * image) and a text block underneath. U35-MOBILE-OVERLAY — per the owner,
 * the image now covers the ENTIRE mobile slide and the text overlays it on
 * a brand gradient scrim (no more solid bg-primary panel): same full-bleed
 * language as desktop, portrait proportions, full-width clear CTA, touch
 * swipe. sm+ keeps the approved desktop overlay hero untouched.
 * U37-PORTRAIT-MOBILE — the owner rejected the cream text panel that sat
 * under the ultra-wide banner («مش عايز اللون اللي تحت الصورة دي… عايز
 * الصورة واخدة الشكل كامل وفوقها الكلام»): a 2.87:1 banner can never fill a
 * portrait phone box, so the BANNER ITSELF was redesigned into a tall
 * 720×1440 portrait (same products, LUBNÉL logo and palette — AI
 * recomposed, seam-free defocused lower third) shipped as the slide's
 * imageMobile. The mobile hero is ONE uniform composition again for every
 * slide and every width: the image covers the WHOLE slide, the text
 * overlays it on the brand scrim. The U36/U36-R2 wide-slide special case
 * (aspect-ratio box, cream panel, panel dots, md: flips, HEIGHTS_MD) is
 * removed entirely.
 */

const SLIDES = [
  {
    id: 'soft-ritual',
    image: '/images/hero-1-wide.webp',
    // U37 — portrait redesign of the banner for phones (720×1440 webp):
    // logo on top, products centered, soft defocused lower third for text.
    imageMobile: '/images/hero-1-mob.webp',
    eyebrowAr: 'LUBNÉL / تشكيلة جديدة',
    eyebrowEn: 'LUBNÉL / NEW COLLECTION',
    titleAr: 'جمالك يبدأ\nمن هنا.',
    titleEn: 'Your beauty\nstarts here.',
    bodyAr: 'منتجات مختارة بعناية لبشرة وشعر أكثر عناية.',
    bodyEn: 'Carefully selected products for skin and hair with extra care.',
    ctaAr: 'تسوقي الآن',
    ctaEn: 'Shop now',
    href: '/c/all',
  },
  {
    id: 'skin-edit',
    // U39-R2 — owner's studio model photo for «بشرة تشعرين بها»: phones get
    // the AI-recomposed 720×1440 portrait (U38-R2 full-content recipe) with
    // the lower half behind the text kept LIGHT (white chiffon + pearls +
    // hand) instead of the dark hair mass the owner read as "a color block
    // below the image".
    // U41-NO-FLIP — the owner rejected the U39 desktop flop: «لا ميقلبش
    // بشكل افقي». Desktop is now the photo at its ORIGINAL orientation
    // (hero-2-wide.webp, no mirror); the RTL text overlays the right side
    // over the existing brand gradient. The mobile portrait was regenerated
    // from the ORIGINAL (unflipped) source with an explicit no-mirror
    // instruction — same approved light-bottom recipe as R2.
    image: '/images/hero-2-wide.webp',
    imageMobile: '/images/hero-2-mob3.webp',
    eyebrowAr: 'LUBNÉL / العناية',
    eyebrowEn: 'LUBNÉL / THE SKIN EDIT',
    titleAr: 'بشرة\nتشعرين بها.',
    titleEn: 'Skin\nthat feels like you.',
    bodyAr: 'روتينات بسيطة، ملمس ناعم، واختيارات تناسب يومك الحقيقي.',
    bodyEn: 'Simple routines, soft textures, and essentials for real everyday skin.',
    ctaAr: 'اكتشفي العناية',
    ctaEn: 'Discover skincare',
    href: '/c/skincare',
  },
  {
    id: 'soft-glow',
    // U38-R2 — owner's tote-bag campaign banner: desktop gets the clean bag
    // crop (baked-in site UI + campaign text cropped out — the slide text
    // overlays instead). R2: the portrait recomposition now fills the whole
    // frame with real scene content (bag on terrazzo pedestal + product
    // still-life below) — the owner rejected the first version's empty
    // blurred lower half ("الصورة تاخد الشكل كامل، من غير لون تحتها").
    image: '/images/hero-3-bag.webp',
    imageMobile: '/images/hero-3-mob2.webp',
    eyebrowAr: 'LUBNÉL / إشراقة ناعمة',
    eyebrowEn: 'LUBNÉL / SOFT GLOW',
    titleAr: 'ضوءكِ\nالخاص.',
    titleEn: 'Your\nsoft glow.',
    bodyAr: 'لمسات مختارة تمنحكِ إحساسًا أجمل، لا مظهرًا مختلفًا.',
    bodyEn: 'Considered touches that make you feel more like yourself.',
    ctaAr: 'شاهدي المختارات',
    ctaEn: 'Explore the edit',
    href: '/c/body-care',
  },
];

type Slide = (typeof SLIDES)[number] & {
  video?: string;
  imageMobile?: string;
};

// U21 — mobile media-area heights vary per preset (panel auto-grows below);
// sm+/md+ keep the classic full-bleed hero heights. U22 — «ملئ تقريبًا»
// (near-full viewport) joins the presets; per-device px from the owner's
// config ride CSS vars (see HERO_LAYOUT below).
// U35-MOBILE-OVERLAY — full-bleed mobile hero: the image now covers the
// WHOLE slide (the old media area AND the old solid bg-primary text panel)
// with the text overlaid on a brand gradient scrim (owner: «الصورة تبقى
// مغطية مكان اللون الأحمر والكلام فوقها»). This px map feeds --mob-media
// (how much clean image shows above the text block) so the owner's presets
// keep exactly their old meaning.
const MOBILE_MEDIA_PX: Record<string, number> = {
  short: 150,
  default: 185,
  tall: 235,
  fill: 300,
};
const HEIGHTS: Record<string, string> = {
  short: 'sm:h-[360px] md:h-[400px]',
  default: 'sm:h-[440px] md:h-[500px]',
  tall: 'sm:h-[560px] md:h-[640px]',
  fill: 'sm:h-[85vh] md:h-[88vh]',
};
// U22 — الأبعاد والمُظهر from Studio → الصفحة الرئيسية. When the owner sets
// per-device px heights they take over the sm/md breakpoint heights via CSS
// vars (inline styles can't be responsive); textPos drops the text block to
// the bottom edge; overlay scales the classic side gradient (0–90).
export type HeroLayout = {
  height?: 'short' | 'default' | 'tall' | 'fill';
  heightDesktop?: number;
  heightTablet?: number;
  heightMobile?: number;
  textPos?: 'center' | 'start';
  overlay?: number;
};

// U17-HOME-EDITOR — template='banner' renders a static hero from the first
// active slide (no rotation/controls); 'slider' keeps the full carousel.
export function HeroSlider({
  template = 'slider',
  height = 'default',
  layout,
}: {
  template?: 'slider' | 'banner';
  height?: 'short' | 'default' | 'tall' | 'fill';
  /** U22 — full الأبعاد والمُظهر config; overrides `height` when present */
  layout?: HeroLayout;
} = {}) {
  const { ar } = useT();
  const [slides, setSlides] = useState<Slide[]>(SLIDES);
  const [idx, setIdx] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // DB slides win when present — edited live from the admin homepage section
  useEffect(() => {
    let alive = true;
    fetch('/api/store/slides', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok || !Array.isArray(d.slides) || !d.slides.length) return;
        setIdx(0);
        setSlides(
          d.slides.map((s: Record<string, string | number>) => ({
            id: String(s.id),
            image: String(s.image),
            imageMobile:
              typeof s.imageMobile === 'string' && s.imageMobile ? s.imageMobile : undefined,
            video: typeof s.video === 'string' && s.video ? s.video : undefined,
            eyebrowAr: s.eyebrow || 'LUBNÉL',
            eyebrowEn: s.eyebrow || 'LUBNÉL',
            titleAr: s.titleAr || '',
            titleEn: s.titleEn || '',
            bodyAr: s.bodyAr || '',
            bodyEn: s.bodyEn || '',
            ctaAr: s.ctaAr || 'تسوقي الآن',
            ctaEn: s.ctaEn || 'Shop now',
            href: s.href || '/',
          }))
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (template === 'banner') return; // static banner — no auto-rotate
    // U18-PERF — pause rotation when the tab is hidden (battery/CPU on
    // mobile). U21 — the interval re-arms on every idx change, so a manual
    // swipe/dot tap always gets a full 6s before the next auto-advance.
    const timer = setInterval(() => {
      if (document.hidden) return;
      setIdx((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length, template, idx]);

  // U21-MOBILE-HERO — thumb swipe on phones (RTL-aware: swiping toward the
  // left edge of reading direction advances). Desktop uses the chevrons.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current || template !== 'slider' || slides.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    const forward = ar ? dx > 0 : dx < 0;
    setIdx((i) => (forward ? (i + 1) % slides.length : (i - 1 + slides.length) % slides.length));
  };

  const s = slides[Math.min(idx, slides.length - 1)];
  void s;
  // U22 — resolved layout (config object wins over the legacy preset prop)
  const lay: HeroLayout = layout ?? { height };
  const preset = lay.height ?? height;
  const mobilePx = lay.heightMobile; // phones: exact px on the media area
  const tabletPx = lay.heightTablet; // sm: (640–767px)
  const desktopPx = lay.heightDesktop; // md:+ (768px+)
  const hasPx = Boolean(mobilePx || tabletPx || desktopPx);
  // U35 — image clearance above the text block (old media-area height):
  // the owner's exact px wins, else the preset's px. Drives --mob-media.
  const mobMediaPx = mobilePx ?? MOBILE_MEDIA_PX[preset] ?? MOBILE_MEDIA_PX.default;
  // px heights: sm tablet / md desktop via CSS vars (no responsive inline styles)
  const heightClass = hasPx
    ? 'sm:h-[var(--hero-h-sm,440px)] md:h-[var(--hero-h-md,500px)]'
    : HEIGHTS[preset] ?? HEIGHTS.default;
  const heroVars = hasPx
    ? ({
        '--hero-h-sm': `${tabletPx ?? desktopPx ?? 440}px`,
        '--hero-h-md': `${desktopPx ?? tabletPx ?? 500}px`,
      } as React.CSSProperties)
    : undefined;
  // قوة التدرج اللوني: the shipped gradient peaks at /85; scale it (0 = none)
  const overlayOpacity = lay.overlay === undefined ? 1 : Math.min(1, Math.max(0, lay.overlay / 85));

  const media = (slide: Slide, i: number) =>
    'video' in slide && slide.video ? (
      <video
        src={slide.video}
        poster={slide.image || undefined}
        muted
        loop
        autoPlay
        playsInline
        preload={i === 0 ? 'auto' : 'none'}
        aria-hidden={i !== idx}
        className="h-full w-full object-cover"
      />
    ) : (
      // U21 — <picture> lets the browser pick the portrait crop on phones
      // with zero JS and zero double-fetch; no imageMobile → plain img.
      // U37 — the portrait mobile asset is DESIGNED for the phone box, so
      // every slide (the banner included) uses the same cover overlay.
      slide.imageMobile ? (
        <picture>
          <source media="(max-width: 639px)" srcSet={slide.imageMobile} />
          <img
            src={slide.image}
            alt=""
            aria-hidden
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding={i === 0 ? 'sync' : 'async'}
            className={`h-full w-full object-cover ${i === idx ? 'scale-105' : ''} transition-transform duration-[6000ms] ease-out`}
          />
        </picture>
      ) : (
        <img
          src={slide.image}
          alt=""
          aria-hidden
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'auto'}
          decoding={i === 0 ? 'sync' : 'async'}
          className={`h-full w-full object-cover ${i === idx ? 'scale-105' : ''} transition-transform duration-[6000ms] ease-out`}
        />
      )
    );

  return (
    <section
      className="relative overflow-hidden rounded-none sm:mx-4 sm:mt-6 sm:rounded-[2rem] md:mx-6"
      aria-roledescription="carousel"
      aria-label="عروض لوبنيل"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={`relative grid sm:block ${heightClass}`}
        // U43-MOBILE-ARROWS — --mob-media rides the OUTER container too, so
        // the (now mobile-visible) chevrons can center themselves over the
        // clean image zone with calc() even when the owner sets custom px.
        style={{
          '--mob-media': `${mobMediaPx}px`,
          ...(heroVars ?? {}),
        } as React.CSSProperties}
      >
        {slides.map((slide, i) => {
          return (
          <div
            key={slide.id}
            // U21 — mobile: grid-stacked slides (in flow → the hero is
            // content-driven, no overflow risk); sm+ back to absolute
            // full-bleed stacking. Opacity fade works in both modes.
            // U35 — --mob-media = how much clean image shows above the text
            // block; min-h keeps short texts from collapsing the full-bleed
            // hero (sm+ returns to fixed heights).
            // U37 — one composition for ALL slides again (the wide-slide
            // branch is gone): image covers, text overlays.
            className={`col-start-1 row-start-1 relative flex min-h-[calc(var(--mob-media,185px)+11rem)] flex-col transition-opacity duration-700 sm:absolute sm:inset-0 sm:block sm:min-h-0 ${
              i === idx ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={i !== idx}
            style={{ '--mob-media': `${mobMediaPx}px` } as React.CSSProperties}
          >
            {/* U35-MOBILE-OVERLAY → U37 — media covers the WHOLE slide at
                every breakpoint; the text panel overlays it on a scrim.
                (The U36 no-crop banner branch is gone — the banner itself
                now ships as a portrait asset designed for this box.) */}
            <div className="absolute inset-0 overflow-hidden">
              {media(slide, i)}
              {/* dots — U40-EDGE-DOTS moved phones' indicator to a vertical
                  rail on the far (left) edge; U43-MOBILE-ARROWS — the owner
                  then asked for the DESKTOP arrows on phones instead («عايز
                  نفس علامة السهم دي تكون موجودة في الموبايل… يقلب بيها
                  للجنب زي الديسكتوب») because a vertical rail reads as
                  up/down navigation. Phones now flip with the same chevrons
                  as sm+ (below), so the dots row is sm+ only again — the
                  approved bottom-center look, pixel-identical. */}
              {template === 'slider' && slides.length > 1 && (
                <div
                  className="absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 flex-row items-center gap-2 sm:flex"
                >
                  {slides.map((_, d) => (
                    <button
                      key={d}
                      onClick={() => setIdx(d)}
                      aria-label={`شريحة ${d + 1}`}
                      aria-current={d === idx}
                      className="flex h-7 w-7 items-center justify-center opacity-90 transition-opacity hover:opacity-100 sm:h-2 sm:w-auto sm:opacity-100"
                    >
                      <span
                        className={`rounded-full transition-all duration-300 ${
                          d === idx
                            ? 'h-5 w-1.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)] sm:h-2 sm:w-7 sm:shadow-none'
                            : 'h-1.5 w-1.5 bg-white/55 sm:h-2 sm:w-2 sm:bg-white/60'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* desktop side gradient — phones use the scrim instead;
                U22: strength from قوة التدرج اللوني. */}
            <div
              className="absolute inset-0 hidden bg-gradient-to-l from-primary/85 via-primary/45 to-transparent sm:block"
              aria-hidden
              style={overlayOpacity < 1 ? { opacity: overlayOpacity } : undefined}
            />

            {/* U21-MOBILE → U35-MOBILE-OVERLAY → U37 — one overlay for every
                slide: transparent panel, image shows through, text sits on a
                brand gradient scrim (solid rust at the bottom → clear at the
                top, same direction as the desktop side-gradient). sm+ keeps
                the classic centered overlay untouched. */}
            <div
              className={`relative flex-1 overflow-hidden pt-[var(--mob-media,185px)] text-primary-foreground sm:absolute sm:inset-0 sm:flex sm:overflow-visible sm:pt-0 ${
                lay.textPos === 'start' ? 'sm:items-end' : 'sm:items-center'
              }`}
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/70 via-55% to-transparent to-90% sm:hidden"
                style={overlayOpacity < 1 ? { opacity: overlayOpacity } : undefined}
              />
              <div
                className={`relative w-full px-5 py-4 sm:px-12 sm:py-0 md:px-16 ${
                  lay.textPos === 'start' ? 'sm:pb-10' : ''
                } [text-shadow:0_1px_16px_rgba(0,0,0,0.28)] sm:[text-shadow:none]`}
              >
                <div className="max-w-xl">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-85 sm:text-xs sm:tracking-[0.25em]"
                    dir="ltr"
                  >
                    {ar ? slide.eyebrowAr : slide.eyebrowEn}
                  </p>
                  {/* SEC-AUDIT-7 — exactly ONE <h1> per page (the first slide,
                      i.e. the brand headline). The other slides render <h2>
                      with the identical classes → zero visual difference,
                      correct document outline for crawlers. */}
                  {(() => {
                    const Tag = (i === 0 ? 'h1' : 'h2') as 'h1' | 'h2';
                    return (
                      <Tag className="mt-1.5 whitespace-pre-line text-2xl font-black leading-[1.3] sm:mt-4 sm:text-5xl sm:leading-[1.2] md:text-6xl">
                        {ar ? slide.titleAr : slide.titleEn}
                      </Tag>
                    );
                  })()}
                  <p className="mt-1.5 line-clamp-2 max-w-md text-[13px] leading-relaxed opacity-90 sm:mt-4 sm:line-clamp-none sm:text-base">
                    {ar ? slide.bodyAr : slide.bodyEn}
                  </p>
                  {/* U10-CTAFIX — explicit cream bg + rust text with IDENTICAL
                      hover colors. U21: full-width h-10 thumb target on phones;
                      sm+ keeps the pill. U37: same pill everywhere again. */}
                  <Button
                    asChild
                    size="lg"
                    className="mt-3 h-10 w-full rounded-full bg-[rgb(253,246,242)] px-6 text-sm font-bold text-[rgb(180,90,60)] shadow-xl transition-all hover:scale-[1.03] hover:bg-[rgb(253,246,242)] hover:text-[rgb(180,90,60)] active:scale-[0.97] active:bg-[rgb(247,237,231)] active:text-[rgb(160,74,46)] [-webkit-tap-highlight-color:transparent] sm:mt-7 sm:h-12 sm:w-auto sm:px-8 sm:text-base"
                  >
                    <Link href={slide.href}>{ar ? slide.ctaAr : slide.ctaEn}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          );
        })}

        {/* side chevrons — U43-MOBILE-ARROWS: previously sm+ only (phones
            swiped and had the edge dots rail); the owner asked for the SAME
            arrow buttons on phones so users flip SIDEWAYS like desktop.
            Phones: centered over the clean image zone (media height /2),
            44px touch targets, z-20 so they paint above the text panel and
            actually receive taps (same mechanism as the old dots rail).
            sm+ untouched: 40px, dead-center.
            U43-R2-TRANSPARENT — the owner rejected the frosted-glass disc
            («السهمين خليهم شفافين للمحتوى ميكونش ليهم بلور خالص»): the
            buttons are now FULLY see-through — no background, no
            backdrop-blur anywhere, the content shows through untouched.
            The cream glyph carries only a 1px drop-shadow (a shadow on the
            icon itself, not a blur of the image behind) so it stays legible
            over the light chiffon/cream slides; feedback moved from a bg
            change to scale + the tap highlight is disabled. */}
        {template === 'slider' && (
          <>
            <button
              onClick={() => setIdx((idx + 1) % slides.length)}
              aria-label="التالي"
              className="hero-arrow absolute left-3 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center text-primary-foreground transition-transform duration-200 [-webkit-tap-highlight-color:transparent] hover:scale-110 active:scale-90 sm:left-4 sm:h-10 sm:w-10"
            >
              <ChevronLeft strokeWidth={2.5} className="h-6 w-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
            </button>
            <button
              onClick={() => setIdx((idx - 1 + slides.length) % slides.length)}
              aria-label="السابق"
              className="hero-arrow absolute right-3 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center text-primary-foreground transition-transform duration-200 [-webkit-tap-highlight-color:transparent] hover:scale-110 active:scale-90 sm:right-4 sm:h-10 sm:w-10"
            >
              <ChevronRight strokeWidth={2.5} className="h-6 w-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
