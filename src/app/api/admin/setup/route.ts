import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  hashSecret,
  hasOwner,
  requestMeta,
  validateCredentials,
  writeAudit,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (await hasOwner()) {
      return NextResponse.json({ ok: false, error: 'يوجد Owner بالفعل' }, { status: 403 });
    }
    const body = await req.json();
    const { username, displayName, password, verificationCode } = body as Record<string, string>;
    validateCredentials({ username, password, verificationCode });
    if (!displayName || displayName.trim().length < 2) {
      return NextResponse.json({ ok: false, error: 'الاسم الظاهر قصير جدًا' }, { status: 400 });
    }
    const admin = await db.adminUser.create({
      data: {
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        passwordHash: hashSecret(password),
        verificationCodeHash: hashSecret(verificationCode.trim()),
        role: 'owner',
        active: true,
      },
    });
    await writeAudit({
      actor: admin.username,
      action: 'owner.created',
      entity: 'admin_user',
      entityId: admin.id,
      meta: requestMeta(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SETUP_FAILED';
    const map: Record<string, string> = {
      INVALID_USERNAME: 'اسم المستخدم غير صالح (حروف إنجليزية/أرقام، 3+ حروف)',
      PASSWORD_TOO_SHORT: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
      INVALID_VERIFICATION_CODE: 'كود التحقق غير صالح (4–32 حرفًا)',
    };
    return NextResponse.json(
      { ok: false, error: map[msg] || 'تعذر إنشاء حساب Owner' },
      { status: 400 }
    );
  }
}
