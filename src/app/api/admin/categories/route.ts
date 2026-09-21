import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCatalog } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('categories.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const categories = await db.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ ok: true, categories });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('categories.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const b = await req.json();
    const nameAr = String(b.nameAr || '').trim();
    const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!nameAr || !slug)
      return NextResponse.json({ ok: false, error: 'الاسم والمعرّف مطلوبان' }, { status: 400 });
    const exists = await db.category.findUnique({ where: { slug } });
    if (exists)
      return NextResponse.json({ ok: false, error: 'المعرّف مستخدم بالفعل' }, { status: 400 });
    const category = await db.category.create({
      data: {
        slug,
        nameAr,
        nameEn: String(b.nameEn || nameAr).trim(),
        description: b.description ? String(b.description) : null,
        // U22 — صفحة القسم: سطر تعريفي أعلى العنوان + بانر (اختياري — غير صورة البطاقة)
        intro: b.intro ? String(b.intro) : null,
        banner: b.banner ? String(b.banner) : null,
        image: b.image ? String(b.image) : null,
        sortOrder: Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 99,
      },
    });
    await writeAudit({ actor: admin.username, action: 'category.created', entity: 'category', entityId: category.id });
    invalidateCatalog(); // U54-PERF-ROBUST
    return NextResponse.json({ ok: true, category });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر إنشاء القسم' }, { status: 500 });
  }
}
