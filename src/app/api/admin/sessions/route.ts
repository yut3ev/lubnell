// TEAM-2 — Admin visit/session log:
// GET  → list sessions (live + history) with admin, device, IP, lastSeen, audit counts
// DELETE ?id= → owner revokes a session (ends it; row kept as history)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { endSessionById } from '@/lib/admin-auth';
import { audit, jsonError, jsonOk, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'users.read');
  if (!ctx) return jsonError('غير مصرح', 401);

  const sessions = await db.adminSession.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      admin: { select: { username: true, displayName: true, role: true } },
      _count: { select: { audits: true } },
    },
  });

  const visits = sessions.map((s) => ({
    id: s.id,
    admin: s.admin,
    ip: s.ip,
    userAgent: s.userAgent,
    device: s.device,
    deviceLabel: s.deviceLabel,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.expiresAt,
    endedAt: s.endedAt,
    endedReason: s.endedReason,
    active: !s.endedAt && s.expiresAt.getTime() > Date.now(),
    actionCount: s._count.audits,
    current: s.id === ctx.sessionId,
  }));

  return jsonOk({ ok: true, sessions: visits });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin(req, 'users.read');
  if (!ctx || ctx.admin.role !== 'owner')
    return jsonError('غير مصرح — الإنهاء للمالك فقط', 401);
  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  if (!id) return jsonError('جلسة غير محددة', 400);

  const session = await db.adminSession.findUnique({
    where: { id },
    include: { admin: { select: { username: true } } },
  });
  if (!session) return jsonError('الجلسة غير موجودة', 404);
  if (session.endedAt) return jsonOk({ ok: true }); // already ended — idempotent

  await endSessionById(id, 'revoked');
  await audit(ctx, 'session.revoked', 'admin_session', id, { target: session.admin.username });
  return jsonOk({ ok: true });
}
