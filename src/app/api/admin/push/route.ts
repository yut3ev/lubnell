import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, can } from '@/lib/admin-auth';
import { broadcastPush, pushStatus } from '@/lib/push';

export const dynamic = 'force-dynamic';

// PUSH-ADMIN — owner-only broadcast composer + subscriber status.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !can(admin, 'products.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const status = await pushStatus();
  return NextResponse.json({ ok: true, ...status });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !can(admin, 'products.write'))
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim().slice(0, 60);
    const message = String(body?.body || '').trim().slice(0, 180);
    const url = String(body?.url || '/').startsWith('/') ? String(body?.url || '/') : '/';
    if (!title || !message) {
      return NextResponse.json({ ok: false, error: 'اكتبي عنوان ونص الإشعار' }, { status: 400 });
    }
    const result = await broadcastPush({ title, body: message, url, tag: `broadcast-${Date.now()}` });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر الإرسال' }, { status: 500 });
  }
}
