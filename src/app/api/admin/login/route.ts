import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  getAdminFromToken,
  permissionsFor,
  requestMeta,
  tokenDigest,
  tokenFromRequest,
  verifySecret,
  writeAudit,
} from '@/lib/admin-auth';
import { csrfOriginOk } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // SEC-AUDIT-2 — CSRF origin guard (login CSRF: attacker logging the
    // victim's browser into an attacker-known account). Same first-party
    // allowlist as requireAdmin.
    if (!csrfOriginOk(req)) {
      return NextResponse.json(
        { ok: false, error: 'بيانات الدخول أو كود التحقق غير صحيح' },
        { status: 401 }
      );
    }
    const body = await req.json();
    const { username, password, verificationCode } = body as Record<string, string>;
    if (!username?.trim() || !password || !verificationCode?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'بيانات الدخول أو كود التحقق غير صحيح' },
        { status: 400 }
      );
    }
    const admin = await db.adminUser.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (
      !admin ||
      !admin.active ||
      !verifySecret(password, admin.passwordHash) ||
      !verifySecret(verificationCode.trim(), admin.verificationCodeHash)
    ) {
      return NextResponse.json(
        { ok: false, error: 'بيانات الدخول أو كود التحقق غير صحيح' },
        { status: 401 }
      );
    }

    const token = randomBytes(32).toString('base64url');
    const meta = requestMeta(req);
    await db.adminSession.create({
      data: {
        tokenHash: tokenDigest(token),
        adminUserId: admin.id,
        expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    await db.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAudit({
      actor: admin.username,
      action: 'auth.login',
      entity: 'admin_session',
      meta,
    });

    // Token is returned in the body as well: clients in cookie-blocked
    // contexts (embedded preview iframes) store it and send `x-admin-token`.
    const res = NextResponse.json({
      ok: true,
      token,
      admin: { username: admin.username, displayName: admin.displayName, role: admin.role },
    });
    // Cookie must survive embedded-preview iframes: cross-site contexts drop
    // SameSite=Lax cookies, so use SameSite=None when the request is secure
    // (None requires Secure per spec). Plain-http keeps Lax (local dev).
    const secure = (req.headers.get('x-forwarded-proto') || '').includes('https');
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
      maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
      secure,
    });
    return res;
  } catch (err) {
    // U10-DIAG — a silent 500 here cost us a full diagnosis cycle; log it.
    console.error('[admin/login] failed:', err);
    return NextResponse.json({ ok: false, error: 'تعذر تسجيل الدخول' }, { status: 500 });
  }
}

/** Session probe used by the /admin page (cookie or x-admin-token header). */
export async function GET(req: NextRequest) {
  const admin = await getAdminFromToken(tokenFromRequest(req));
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
      permissions: permissionsFor(admin),
    },
  });
}
