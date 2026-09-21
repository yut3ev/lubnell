import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get('category') || undefined;
    const q = req.nextUrl.searchParams.get('q') || undefined;

    const products = await db.product.findMany({
      where: {
        published: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(q
          ? {
              OR: [
                { nameAr: { contains: q } },
                { nameEn: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      include: { category: { select: { slug: true, nameAr: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ ok: true, products });
  } catch (err) {
    console.error('[products]', err);
    return NextResponse.json(
      { ok: false, error: 'failed to list products' },
      { status: 500 }
    );
  }
}
