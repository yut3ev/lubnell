import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('coupons.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.active !== undefined) data.active = !!b.active;
    if (b.value !== undefined) data.value = Number(b.value);
    if (b.minSubtotal !== undefined) data.minSubtotal = Number(b.minSubtotal) || 0;
    if (b.maxDiscount !== undefined) data.maxDiscount = b.maxDiscount ? Number(b.maxDiscount) : null;
    if (b.label !== undefined) data.label = b.label ? String(b.label) : null;
    if (b.endsAt !== undefined) data.endsAt = b.endsAt ? new Date(b.endsAt) : null;
    const coupon = await db.coupon.update({ where: { id }, data });
    await writeAudit({ actor: admin.username, action: 'coupon.updated', entity: 'coupon', entityId: id });
    return NextResponse.json({ ok: true, coupon });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر تحديث الكوبون' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  // U22 — «حذف العروض» is its own grant (write no longer implies delete)
  if (!admin || !admin.perms.includes('coupons.delete'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    await db.coupon.delete({ where: { id } });
    await writeAudit({ actor: admin.username, action: 'coupon.deleted', entity: 'coupon', entityId: id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حذف الكوبون' }, { status: 400 });
  }
}
