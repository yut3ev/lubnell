import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCatalog } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('products.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.nameAr !== undefined) data.nameAr = String(b.nameAr).trim();
    if (b.nameEn !== undefined) data.nameEn = String(b.nameEn).trim();
    if (b.description !== undefined) data.description = String(b.description);
    if (b.price !== undefined) data.price = Number(b.price);
    if (b.compareAt !== undefined) data.compareAt = b.compareAt ? Number(b.compareAt) : null;
    if (b.image !== undefined) data.image = String(b.image);
    if (b.categoryId !== undefined) data.categoryId = String(b.categoryId);
    if (b.badgeAr !== undefined) data.badgeAr = b.badgeAr ? String(b.badgeAr) : null;
    if (b.badgeEn !== undefined) data.badgeEn = b.badgeEn ? String(b.badgeEn) : null;
    if (b.stock !== undefined) data.stock = Math.max(0, Math.floor(Number(b.stock) || 0));
    if (b.featured !== undefined) data.featured = !!b.featured;
    if (b.published !== undefined) data.published = !!b.published;
    if (b.variants !== undefined) data.variants = b.variants ? JSON.stringify(b.variants) : null;
    if (b.gallery !== undefined) {
      // gallery: array of image URLs/paths (strings) — stored as JSON string
      data.gallery = Array.isArray(b.gallery)
        ? JSON.stringify(b.gallery.map((g: unknown) => String(g)).filter(Boolean).slice(0, 12))
        : null;
    }
    const product = await db.product.update({ where: { id }, data });
    await writeAudit({
      actor: admin.username,
      action: 'product.updated',
      entity: 'product',
      entityId: id,
      meta: { ip: req.headers.get('x-forwarded-for') || undefined },
    });
    invalidateCatalog(); // U54-PERF-ROBUST
    return NextResponse.json({ ok: true, product });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر تحديث المنتج' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  // U22-TEAM-PERMS — deleting a product is now its OWN grant (حذف المنتجات);
  // «تعديل المنتجات» alone no longer allows destructive deletes. Owners pass
  // implicitly (permissionsFor gives owners every key).
  if (!admin || !admin.perms.includes('products.delete'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    const used = await db.orderItem.count({ where: { productId: id } });
    if (used > 0) {
      // product referenced by orders — hide instead of hard delete
      await db.product.update({ where: { id }, data: { stock: 0, featured: false, badgeAr: null, badgeEn: null } });
      await writeAudit({ actor: admin.username, action: 'product.cleared', entity: 'product', entityId: id });
      invalidateCatalog(); // U54-PERF-ROBUST
      return NextResponse.json({ ok: true, softCleared: true });
    }
    await db.product.delete({ where: { id } });
    await writeAudit({
      actor: admin.username,
      action: 'product.deleted',
      entity: 'product',
      entityId: id,
      meta: { ip: req.headers.get('x-forwarded-for') || undefined },
    });
    invalidateCatalog(); // U54-PERF-ROBUST
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حذف المنتج' }, { status: 400 });
  }
}
