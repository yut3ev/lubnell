import { notFound } from 'next/navigation';
import { getCatalog } from '@/lib/catalog-cache'; // PERF-2026-11
import { ProductCard } from '@/components/store/product-card';
import { CategoryGrid } from '@/components/store/category-grid';
import { CatalogPageView } from '@/components/store/catalog-page';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // PERF-2026-11 — one cached snapshot serves both branches (no Turso
  // round trips per pageview; invalidated on admin saves)
  const snap = await getCatalog();

  // U10-CATALOG-PAGE — /c/all renders the standalone «كل المنتجات» catalog
  // (Lou card + count pills + filter toolbar + 2-row desktop carousel).
  if (slug === 'all') {
    const categories = snap.categories;
    const products = snap.products;
    const catById = new Map(categories.map((c) => [c.id, c.slug]));

    return (
      <CatalogPageView
        categories={categories.map((c) => ({
          slug: c.slug,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
        }))}
        products={products.map((p) => ({
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
          categorySlug: catById.get(p.categoryId) ?? 'all',
        }))}
      />
    );
  }

  const category = snap.categories.find((c) => c.slug === slug);
  if (!category) notFound();

  // U58-GALLERY — صور القسم الإضافية (JSON string array → string[])
  let catGallery: string[] = [];
  try {
    catGallery = category.gallery ? (JSON.parse(category.gallery) as string[]).filter(Boolean) : [];
  } catch {
    catGallery = [];
  }

  // نفس ترتيب الاستعلام القديم (featured desc, createdAt asc) — من السنابشوت
  const products = snap.products
    .filter((p) => p.categoryId === category.id)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  return (
    <CategoryGrid
      category={{
        slug: category.slug,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        description: category.description,
        // U22 — صفحة القسم: سطر تعريفي أعلى العنوان + بانر (فاضي = صورة الفئة)
        intro: category.intro,
        banner: category.banner,
        image: category.image,
        gallery: catGallery, // U58
      }}
      count={products.length}
      products={products.map((p) => ({
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
      }))}
    />
  );
}
