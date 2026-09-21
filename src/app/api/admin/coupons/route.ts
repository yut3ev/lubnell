import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, writeAudit } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('coupons.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ ok: true, coupons });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('coupons.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const b = await req.json();
    const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
    const value = Number(b.value);
    if (!code || !Number.isFinite(value) || value <= 0)
      return NextResponse.json({ ok: false, error: 'الكود وقيمة الخصم مطلوبان' }, { status: 400 });
    if (b.type === 'percent' && value > 100)
      return NextResponse.json({ ok: false, error: 'نسبة الخصم لا تتجاوز 100%' }, { status: 400 });
    const exists = await db.coupon.findUnique({ where: { code } });
    if (exists)
      return NextResponse.json({ ok: false, error: 'هذا الكود موجود بالفعل' }, { status: 400 });
    const coupon = await db.coupon.create({
      data: {
        code,
        type: b.type === 'fixed' ? 'fixed' : 'percent',
        value,
        minSubtotal: Number(b.minSubtotal) || 0,
        maxDiscount: b.maxDiscount ? Number(b.maxDiscount) : null,
        label: b.label ? String(b.label) : null,
        usageLimit: b.usageLimit ? Number(b.usageLimit) : null,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
        active: b.active !== false,
      },
    });
    await writeAudit({ actor: admin.username, action: 'coupon.created', entity: 'coupon', entityId: coupon.id });
    return NextResponse.json({ ok: true, coupon });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر إنشاء الكوبون' }, { status: 500 });
  }
}
