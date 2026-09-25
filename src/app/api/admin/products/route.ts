import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCatalog } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `product-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('products.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const products = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { slug: true, nameAr: true } } },
  });
  return NextResponse.json({ ok: true, products });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('products.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const b = await req.json();
    const nameAr = String(b.nameAr || '').trim();
    const price = Number(b.price);
    const categoryId = String(b.categoryId || '');
    if (!nameAr || !Number.isFinite(price) || price <= 0 || !categoryId) {
      return NextResponse.json({ ok: false, error: 'الاسم والسعر والقسم مطلوبة' }, { status: 400 });
    }
    const slugBase = String(b.slug || '').trim() || slugify(String(b.nameEn || nameAr));
    // U85 — Arabic-only names produce Arabic slugs; App Router params stay
    // percent-encoded so /p/<arabic-slug> 404s. Guarantee a latin-safe slug.
    const latinSafe = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slugBase);
    let slug = latinSafe ? slugBase : `p-${Date.now()}`;
    let n = 1;
    while (await db.product.findUnique({ where: { slug } })) slug = `${slug}-${n++}`;
    const product = await db.product.create({
      data: {
        slug,
        nameAr,
        nameEn: String(b.nameEn || nameAr).trim(),
        description: String(b.description || '').trim() || nameAr,
        price,
        compareAt: b.compareAt ? Number(b.compareAt) : null,
        image: String(b.image || '/products/placeholder.svg'),
        gallery: b.gallery ? JSON.stringify(b.gallery) : null,
        categoryId,
        badgeAr: b.badgeAr ? String(b.badgeAr) : null,
        badgeEn: b.badgeEn ? String(b.badgeEn) : null,
        variants: b.variants ? JSON.stringify(b.variants) : null,
        stock: Number.isFinite(Number(b.stock)) ? Math.max(0, Math.floor(Number(b.stock))) : 20,
        featured: !!b.featured,
      },
    });
    await writeAudit({
      actor: admin.username,
      action: 'product.created',
      entity: 'product',
      entityId: product.id,
      meta: { ip: req.headers.get('x-forwarded-for') || undefined },
    });
    invalidateCatalog(); // U54-PERF-ROBUST — storefront catalog refreshes on next request
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    console.error('[admin/products POST]', err);
    return NextResponse.json({ ok: false, error: 'تعذر إنشاء المنتج' }, { status: 500 });
  }
}
