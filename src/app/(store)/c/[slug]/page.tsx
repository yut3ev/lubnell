import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
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

  // U10-CATALOG-PAGE — /c/all renders the standalone «كل المنتجات» catalog
  // (AI stylist banner + count pills + filter toolbar) exactly like the
  // owner-approved screenshots.
  if (slug === 'all') {
    const [categories, products] = await Promise.all([
      db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.product.findMany({
        where: { published: true },
        orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);
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

  const category = await db.category.findUnique({ where: { slug } });
  if (!category) notFound();

  const products = await db.product.findMany({
    where: { categoryId: category.id, published: true },
    orderBy: [{ featured: 'desc' }, { createdAt: 'asc' }],
  });

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
