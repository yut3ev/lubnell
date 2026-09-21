import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ADMIN_SESSION_COOKIE, requestMeta, tokenDigest, tokenFromRequest, writeAudit } from '@/lib/admin-auth';
import { csrfOriginOk } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // SEC-AUDIT-2 — CSRF origin guard (logout CSRF is an annoyance but the same
  // one-line guard keeps every admin session write consistent).
  if (!csrfOriginOk(req)) {
    return NextResponse.json({ ok: false, error: 'طلب غير مصرح' }, { status: 401 });
  }
  const token = tokenFromRequest(req);
  if (token) {
    const session = await db.adminSession
      .findUnique({ where: { tokenHash: tokenDigest(token) }, include: { admin: true } })
      .catch(() => null);
    if (session) {
      await db.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
      await writeAudit({
        actor: session.admin.username,
        action: 'auth.logout',
        entity: 'admin_session',
        meta: requestMeta(req),
      });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
