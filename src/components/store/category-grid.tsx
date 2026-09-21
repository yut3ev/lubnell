'use client';

import { EditorialCard } from '@/components/store/editorial-card';
import { Reveal } from '@/components/store/reveal';
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
  };
  count: number;
  products: ProductCardData[];
}) {
  const { ar, t } = useT();

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
