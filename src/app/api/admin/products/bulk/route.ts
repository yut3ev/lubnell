import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCatalog } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { requireAdmin, writeAudit, type AdminRecord } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const BULK_ACTIONS = ['publish', 'unpublish', 'feature', 'unfeature', 'delete'] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

const MAX_BULK_IDS = 200;

async function handle(req: NextRequest) {
  const admin = (await requireAdmin(req)) as (AdminRecord & { perms: string[] }) | null;
  if (!admin || !admin.perms.includes('products.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const b = await req.json();
    if (!Array.isArray(b?.ids))
      return NextResponse.json({ ok: false, error: 'لم يتم تحديد أي منتجات' }, { status: 400 });
    const ids = [
      ...new Set(
        (b.ids as unknown[])
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim())
      ),
    ];
    const action = String(b?.action || '') as BulkAction;
    if (!ids.length)
      return NextResponse.json({ ok: false, error: 'لم يتم تحديد أي منتجات' }, { status: 400 });
    if (ids.length > MAX_BULK_IDS)
      return NextResponse.json({ ok: false, error: `أقصى عدد للتحديد ${MAX_BULK_IDS} منتج` }, { status: 400 });
    if (!BULK_ACTIONS.includes(action))
      return NextResponse.json({ ok: false, error: 'إجراء غير مدعوم' }, { status: 400 });

    const meta = { ip: req.headers.get('x-forwarded-for') || undefined };

    if (action === 'delete') {
      // U22-TEAM-PERMS — destructive bulk delete now requires the dedicated
      // «حذف المنتجات» grant (products.delete), not just write access.
      if (!admin.perms.includes('products.delete'))
        return NextResponse.json({ ok: false }, { status: 401 });
      // Soft-delete semantics mirrored from the single-product DELETE route:
      // products referenced by order items are never hard-deleted — they are
      // cleared instead (stock zeroed, unfeatured, badges stripped) so order
      // history keeps rendering; only unreferenced products are truly removed.
      const referenced = await db.orderItem.findMany({
        where: { productId: { in: ids } },
        select: { productId: true },
        distinct: ['productId'],
      });
      const referencedIds = referenced.map((r) => r.productId).filter((x): x is string => !!x);
      const deletableIds = ids.filter((id) => !referencedIds.includes(id));

      const { cleared, deleted } = await db.$transaction(async (tx) => {
        if (referencedIds.length) {
          await tx.product.updateMany({
            where: { id: { in: referencedIds } },
            data: { stock: 0, featured: false, badgeAr: null, badgeEn: null },
          });
        }
        if (!deletableIds.length) return { cleared: referencedIds.length, deleted: 0 };
        const res = await tx.product.deleteMany({ where: { id: { in: deletableIds } } });
        return { cleared: referencedIds.length, deleted: res.count };
      });

      const affected = cleared + deleted;
      await writeAudit({
        actor: admin.username,
        action: `products.bulk.delete:${affected}`,
        entity: 'product',
        entityId: null,
        meta,
      });
      invalidateCatalog(); // U54-PERF-ROBUST
      return NextResponse.json({ ok: true, affected, cleared, deleted });
    }

    const data: { published?: boolean; featured?: boolean } =
      action === 'publish' ? { published: true }
      : action === 'unpublish' ? { published: false }
      : action === 'feature' ? { featured: true }
      : { featured: false };

    const res = await db.product.updateMany({ where: { id: { in: ids } }, data });
    await writeAudit({
      actor: admin.username,
      action: `products.bulk.${action}:${res.count}`,
      entity: 'product',
      entityId: null,
      meta,
    });
    invalidateCatalog(); // U54-PERF-ROBUST
    return NextResponse.json({ ok: true, affected: res.count });
  } catch (err) {
    console.error('[admin/products/bulk]', err);
    return NextResponse.json({ ok: false, error: 'تعذر تنفيذ الإجراء الجماعي' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
