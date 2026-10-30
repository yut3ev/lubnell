import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/* LU-ASSISTANT-2026-10 — tiny read-only feed for the «اسألي لُو» gift card.
   Published + in-stock products only, just the fields the card's map needs
   (name, price, slug, occasion-capable category/badge) so the homepage card
   never ships the full catalog payload and always fits its 4s fetch budget.
   Public by design: the same data /api/products already exposes. */
export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { published: true, stock: { gt: 0 } },
      select: {
        nameAr: true,
        nameEn: true,
        price: true,
        slug: true,
        badgeAr: true,
        category: { select: { nameAr: true } },
      },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });
    return NextResponse.json({ ok: true, products });
  } catch {
    return NextResponse.json({ ok: false, products: [] }, { status: 500 });
  }
}
