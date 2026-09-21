import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('audit.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const action = req.nextUrl.searchParams.get('action');
  const actor = req.nextUrl.searchParams.get('actor');
  const ip = req.nextUrl.searchParams.get('ip');
  const where: Record<string, { contains: string }> = {};
  if (action) where.action = { contains: action };
  if (actor) where.actor = { contains: actor };
  if (ip) where.ip = { contains: ip };
  const logs = await db.adminAudit.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ ok: true, logs });
}
