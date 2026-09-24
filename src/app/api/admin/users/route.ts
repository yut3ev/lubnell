import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ADMIN_PERMISSIONS,
  hashSecret,
  requireAdmin,
  writeAudit,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('users.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const users = await db.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      permissions: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || admin.role !== 'owner')
    return NextResponse.json({ ok: false, error: 'Owner فقط يضيف مستخدمين' }, { status: 403 });
  try {
    const b = await req.json();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    const code = String(b.verificationCode || '').trim();
    if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(username))
      return NextResponse.json({ ok: false, error: 'اسم مستخدم غير صالح' }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ ok: false, error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });
    if (code.length < 4 || code.length > 32)
      return NextResponse.json({ ok: false, error: 'كود تحقق غير صالح' }, { status: 400 });
    const exists = await db.adminUser.findUnique({ where: { username } });
    if (exists)
      return NextResponse.json({ ok: false, error: 'اسم المستخدم مستخدم بالفعل' }, { status: 400 });
    const perms = Array.isArray(b.permissions)
      ? b.permissions.filter((p: string) => (ADMIN_PERMISSIONS as readonly string[]).includes(p))
      : [];
    const user = await db.adminUser.create({
      data: {
        username,
        displayName: String(b.displayName || username).trim(),
        passwordHash: hashSecret(password),
        verificationCodeHash: hashSecret(code),
        role: 'staff',
        permissions: JSON.stringify(perms),
        active: true,
      },
    });
    await writeAudit({
      actor: admin.username,
      action: 'staff.created',
      entity: 'admin_user',
      entityId: user.id,
    });
    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر إنشاء المستخدم' }, { status: 500 });
  }
}
