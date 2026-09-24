import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, writeAudit, hashSecret, ADMIN_PERMISSIONS } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || admin.role !== 'owner')
    return NextResponse.json({ ok: false, error: 'Owner فقط يعدّل المستخدمين' }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.active !== undefined) data.active = !!b.active;
  if (b.displayName !== undefined) data.displayName = String(b.displayName).trim();
  // U19-PERMS — full control: edit permissions / reset password / reset code
  if (b.permissions !== undefined) {
    if (!Array.isArray(b.permissions))
      return NextResponse.json({ ok: false, error: 'صيغة الصلاحيات غير صحيحة' }, { status: 400 });
    const perms = b.permissions.filter((p: unknown) =>
      typeof p === 'string' && (ADMIN_PERMISSIONS as readonly string[]).includes(p)
    );
    data.permissions = JSON.stringify(perms);
  }
  if (typeof b.password === 'string' && b.password.length > 0) {
    if (b.password.length < 8)
      return NextResponse.json({ ok: false, error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });
    data.passwordHash = hashSecret(b.password);
  }
  if (typeof b.verificationCode === 'string' && b.verificationCode.trim()) {
    data.verificationCodeHash = hashSecret(b.verificationCode.trim());
  }
  if (Object.keys(data).length === 0)
    return NextResponse.json({ ok: false, error: 'لا يوجد تغييرات' }, { status: 400 });
  try {
    const target = await db.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ ok: false, error: 'المستخدم غير موجود' }, { status: 404 });
    if (target.role === 'owner' && b.active === false)
      return NextResponse.json({ ok: false, error: 'لا يمكن تعطيل Owner' }, { status: 400 });
    const user = await db.adminUser.update({ where: { id }, data });
    await writeAudit({
      actor: admin.username,
      action: 'staff.updated',
      entity: 'admin_user',
      entityId: id,
    });
    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, active: user.active },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر تحديث المستخدم' }, { status: 400 });
  }
}

// U19-PERMS — full team control: remove a member (owner-only). Their sessions
// are revoked immediately; owners themselves can never be deleted.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin || admin.role !== 'owner')
    return NextResponse.json({ ok: false, error: 'Owner فقط يحذف المستخدمين' }, { status: 403 });
  const { id } = await params;
  try {
    const target = await db.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ ok: false, error: 'المستخدم غير موجود' }, { status: 404 });
    if (target.role === 'owner')
      return NextResponse.json({ ok: false, error: 'لا يمكن حذف حساب Owner' }, { status: 400 });
    await db.adminSession.deleteMany({ where: { adminUserId: id } });
    await db.adminUser.delete({ where: { id } });
    await writeAudit({ actor: admin.username, action: 'staff.deleted', entity: 'admin_user', entityId: id });
    return NextResponse.json({ ok: true, deleted: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حذف المستخدم' }, { status: 400 });
  }
}
