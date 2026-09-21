// U24-404 — the 404 experience, rebuilt in the store's live design language.
// History: the R144 server 404 (and the R62 hash-router NotFoundView before
// it) spoke the OLD `nf-*` CSS vocabulary — those classes died with the
// legacy stylesheet, so the page rendered as naked text on a cream body
// (owner screenshot). This file recreates the face with Tailwind classes the
// storefront actually ships, plus REAL recovery routes (/c/all, /, /search —
// not the dead #/shop hashes) and a DB-backed product shelf so a 404 becomes
// a second storefront instead of a dead end.
// Server-safe: no hooks, no handlers — the only client boundary is
// EditorialCard (U28, the shared product card), which brings its own
// cart/prefs context from the root layout.
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Search, Gift, Banknote, Truck, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { EditorialCard } from "@/components/store/editorial-card";
import type { ProductCardData } from "@/components/store/product-card";

// The shelf: same ordering the homepage trusts (featured first, then rating),
// 4 cards max. DB down or empty store → [] and the shelf simply doesn't render
// — a 404 must NEVER throw its own exception.
export async function fetchShelfProducts(): Promise<ProductCardData[]> {
  try {
    const products = await db.product.findMany({
      where: { published: true },
      orderBy: [{ featured: "desc" }, { rating: "desc" }, { createdAt: "asc" }],
      take: 4,
    });
    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      price: p.price,
      compareAt: p.compareAt,
      image: p.image,
      rating: p.rating,
      reviews: p.reviews,
      stock: p.stock,
      badgeAr: p.badgeAr,
      badgeEn: p.badgeEn,
    }));
  } catch {
    return [];
  }
}

// variant — "route": unknown URL / category / info page misses.
//            "product": a dead product link (PDP calls notFound()).
export function NotFoundHero({ variant = "route" }: { variant?: "route" | "product" }) {
  const product = variant === "product";
  return (
    <section className="relative overflow-hidden" aria-labelledby="nf-title">
      {/* soft brand glow behind the ghost digits */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-4 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/35 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute right-[10%] top-44 h-20 w-20 rounded-full bg-secondary/70 blur-2xl" />
        <div className="absolute left-[12%] top-24 h-14 w-14 rounded-full bg-primary/10 blur-xl" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-8 pt-12 text-center sm:px-6 sm:pb-12 sm:pt-16">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-card/80 px-4 py-1.5 text-[10px] font-bold tracking-[0.3em] text-muted-foreground backdrop-blur sm:text-[11px]">
          LUBNÉL
          <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
          {product ? "MISSING PRODUCT" : "LOST PATH"}
        </span>

        {/* ghost digits — outline stroke in the brand wine, headline overlaps */}
        <div className="relative mt-1 select-none" aria-hidden="true">
          <Sparkles
            className="absolute -left-5 top-3 h-5 w-5 text-primary/50 sm:-left-8 sm:h-7 sm:w-7"
            strokeWidth={1.5}
          />
          <span
            className="block bg-gradient-to-b from-primary/25 to-primary/5 bg-clip-text px-4 text-[clamp(6.5rem,24vw,13rem)] font-black leading-[0.95] tracking-tighter text-transparent"
            style={{
              WebkitTextStroke: "2px color-mix(in oklab, var(--primary) 32%, transparent)",
            }}
          >
            404
          </span>
        </div>

        <h1
          id="nf-title"
          className="-mt-5 text-3xl font-extrabold leading-tight sm:-mt-9 sm:text-5xl"
        >
          {product ? "المنتج غير موجود." : "ضاعتِ من الخريطة."}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-8 text-muted-foreground sm:text-base sm:leading-9">
          {product
            ? "الرابط قد يكون قديمًا أو المنتج لم يعد متوفرًا — لكن المجموعة ما زالت هنا، وهذه أقرب البدائل."
            : "الرابط الذي فتحتِه لا يقود لأي مكان هنا — ربما تغيّر الطريق أو تمّت إعادة ترتيب الموقع."}
        </p>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            href="/c/all"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
          >
            تسوّقي المجموعة
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-8 text-sm font-bold text-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-[0.98]"
          >
            العودة للرئيسية
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/search"
            className="group inline-flex h-12 items-center gap-1.5 px-2 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="border-b border-dashed border-current pb-0.5">
              ابحثي في المتجر
            </span>
          </Link>
        </div>

        {/* the store's reassurance line — the 404 still smells like LUBNÉL */}
        <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold text-muted-foreground sm:gap-x-8 sm:text-xs">
          <li className="inline-flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-primary/70" aria-hidden />
            تغليف هدايا مجاني
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 text-primary/70" aria-hidden />
            الدفع عند الاستلام
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-primary/70" aria-hidden />
            توصيل سريع لكل مصر
          </li>
        </ul>
      </div>
    </section>
  );
}

export function NotFoundShelf({
  products,
  variant = "route",
}: {
  products: ProductCardData[];
  variant?: "route" | "product";
}) {
  if (products.length < 2) return null; // empty/DB-down — a quiet page beats a broken one
  const product = variant === "product";
  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20"
      aria-label={product ? "أقرب البدائل" : "منتجات مختارة"}
    >
      <div className="mb-5 flex items-end justify-between gap-4 border-t border-border/60 pt-8">
        <div>
          <span className="text-[10px] font-bold tracking-[0.28em] text-primary sm:text-[11px]">
            {product ? "أقرب البدائل" : "اختيارات الزوار"}
          </span>
          <h2 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">
            {product ? "جرّبي هذه." : "ابدئي من هنا."}
          </h2>
        </div>
        <Link
          href="/c/all"
          className="group inline-flex shrink-0 items-center gap-1 pb-1 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
        >
          كل المنتجات
          <ArrowLeft
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((p) => (
          <EditorialCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
