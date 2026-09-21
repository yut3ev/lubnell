// U57-TEXTS-COMPLETE — the 404 shelf query lives here (server-only) so
// not-found-parts.tsx can become a client component and make every 404
// string owner-editable via useT (Studio → «كل النصوص»).
// Same ordering the homepage trusts (featured first, then rating), 4 cards
// max. DB down or empty store → [] and the shelf simply doesn't render
// — a 404 must NEVER throw its own exception.
import { db } from "@/lib/db";
import type { ProductCardData } from "@/components/store/product-card";

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
