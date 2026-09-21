import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCatalog } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('categories.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.nameAr !== undefined) data.nameAr = String(b.nameAr).trim();
    if (b.nameEn !== undefined) data.nameEn = String(b.nameEn).trim();
    if (b.description !== undefined) data.description = b.description ? String(b.description) : null;
    // U22 — صفحة القسم: سطر تعريفي + بانر (فاضي = صورة الفئة) + تعديل المعرّف
    if (b.intro !== undefined) data.intro = b.intro ? String(b.intro) : null;
    if (b.banner !== undefined) data.banner = b.banner ? String(b.banner) : null;
    if (b.slug !== undefined && String(b.slug).trim()) {
      const slug = String(b.slug).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      if (slug) {
        const taken = await db.category.findFirst({ where: { slug, id: { not: id } } });
        if (taken)
          return NextResponse.json({ ok: false, error: 'المعرّف مستخدم بالفعل' }, { status: 400 });
        data.slug = slug;
      }
    }
    if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder) || 0;
    if (b.image !== undefined) data.image = b.image ? String(b.image) : null;
    const category = await db.category.update({ where: { id }, data });
    await writeAudit({ actor: admin.username, action: 'category.updated', entity: 'category', entityId: id });
    invalidateCatalog(); // U54-PERF-ROBUST
    return NextResponse.json({ ok: true, category });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر تحديث القسم' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('categories.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const count = await db.product.count({ where: { categoryId: id } });
  if (count > 0)
    return NextResponse.json(
      { ok: false, error: `لا يمكن حذف قسم به ${count} منتج — انقلي المنتجات أولًا` },
      { status: 400 }
    );
  try {
    await db.category.delete({ where: { id } });
    await writeAudit({ actor: admin.username, action: 'category.deleted', entity: 'category', entityId: id });
    invalidateCatalog(); // U54-PERF-ROBUST
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حذف القسم' }, { status: 400 });
  }
}
