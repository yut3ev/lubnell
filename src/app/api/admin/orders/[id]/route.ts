import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('orders.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status?: string };
  if (!status || !STATUSES.includes(status))
    return NextResponse.json({ ok: false, error: 'حالة غير صالحة' }, { status: 400 });
  try {
    await db.order.update({ where: { id }, data: { status } });
    await writeAudit({
      actor: admin.username,
      action: 'order.status_updated',
      entity: 'order',
      entityId: id,
      meta: { ip: req.headers.get('x-forwarded-for') || undefined, userAgent: req.headers.get('user-agent') || undefined },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'الطلب غير موجود' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  // U79 — الاونر أو أدمن مُنحت صلاحية «orders.delete»
  if (!admin || !(admin.role === 'owner' || admin.perms.includes('orders.delete')))
    return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  try {
    await db.order.delete({ where: { id } });
    await writeAudit({
      actor: admin.username,
      action: 'order.deleted',
      entity: 'order',
      entityId: id,
      meta: { ip: req.headers.get('x-forwarded-for') || undefined },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'الطلب غير موجود' }, { status: 404 });
  }
}
