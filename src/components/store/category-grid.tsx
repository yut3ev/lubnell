'use client';

import { useState } from 'react';
import { EditorialCard } from '@/components/store/editorial-card';
import { Reveal } from '@/components/store/reveal';
import { ImageLightbox } from '@/components/store/image-lightbox'; // U58-GALLERY
import type { ProductCardData } from '@/components/store/product-card';
import { useT } from '@/lib/i18n';

export function CategoryGrid({
  category,
  count,
  products,
}: {
  category: {
    slug: string;
    nameAr: string;
    nameEn: string;
    description: string | null;
    /** U22 — سطر تعريفي أعلى العنوان (اختياري) */
    intro?: string | null;
    /** U22 — بانر صفحة القسم (اختياري — غير صورة البطاقة؛ الفاضي = صورة الفئة) */
    banner?: string | null;
    image: string | null;
    /** U58 — صور إضافية للقسم (شريط احترافي أسفل الترويسة) */
    gallery?: string[];
  };
  count: number;
  products: ProductCardData[];
}) {
  const { ar, t } = useT();
  // U58-GALLERY — lightbox state (null = closed)
  const [lb, setLb] = useState<number | null>(null);
  const gallery = category.gallery ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60">
        <div className="absolute inset-0">
          { }
          <img
            src={category.banner || category.image || '/products/placeholder-box.svg'}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-primary/85 to-primary/55" aria-hidden />
        </div>
        <div className="relative px-6 py-12 text-primary-foreground sm:px-10">
          {/* U22 — سطر تعريفي أعلى العنوان */}
          {category.intro && category.intro.trim() && (
            <p className="mb-1 text-sm font-bold opacity-90">{category.intro}</p>
          )}
          <p className="text-xs font-bold uppercase tracking-widest opacity-80" dir="ltr">
            {category.nameEn} / LUBNÉL
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">{ar ? category.nameAr : category.nameEn}</h1>
          {category.description && (
            <p className="mt-2 max-w-lg text-sm leading-relaxed opacity-90">{category.description}</p>
          )}
          <p className="mt-3 text-xs font-bold opacity-85">
            {count} {t.products}
          </p>
        </div>
      </div>

      {/* U58-GALLERY — شريط صور القسم الاحترافي (scroll-snap + lightbox) */}
      {gallery.length > 0 && (
        <section className="mt-8" aria-label={t.galleryTitle}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t.galleryTitle}</h2>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-black tabular-nums text-muted-foreground">
              {gallery.length} {ar ? 'صورة' : 'photos'}
            </span>
          </div>
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {gallery.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => setLb(i)}
                  aria-label={`${ar ? 'فتح الصورة' : 'Open photo'} ${i + 1}`}
                  className="group relative aspect-[4/3] w-[260px] shrink-0 snap-center overflow-hidden rounded-2xl border border-border/60 bg-secondary/30 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 sm:w-[320px]"
                >
                  <img
                    src={img}
                    alt={`${ar ? category.nameAr : category.nameEn} — ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-black tabular-nums text-foreground backdrop-blur">
                    {i + 1} / {gallery.length}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] font-bold text-muted-foreground sm:hidden">{t.gallerySwipeHint}</p>
          </div>
          {lb !== null && (
            <ImageLightbox
              images={gallery}
              index={Math.min(lb, gallery.length - 1)}
              onClose={() => setLb(null)}
              onIndexChange={setLb}
              alt={ar ? category.nameAr : category.nameEn}
            />
          )}
        </section>
      )}

      {/* grid — U28: editorial cards + staggered reveal cascade */}
      {products.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i * 60, 300)}>
              <EditorialCard product={p} />
            </Reveal>
          ))}
        </div>
      ) : (
        <p className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t.noProducts}
        </p>
      )}
    </div>
  );
}
