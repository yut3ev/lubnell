// VISITS-1 — admin read API for storefront visitor tracking.
// GET                      → stats + paginated visits (lastSeenAt desc)
// GET ?id=                 → one visit + its full event trail (what they did)
// GET ?device=&q=&page=    → filters (device class, ip/path search)
// Guard: visits.read OR audit.read — U22-TEAM-PERMS gave the visits log its
// own dedicated key so the team matrix can grant it independently.
import { db } from '@/lib/db';
import { jsonOk, jsonError, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, ['visits.read', 'audit.read']);
  if (!ctx) return jsonError('غير مصرح', 401);

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();

  // ---- detail mode: full event replay for one visit ----
  if (id) {
    const visit = await db.visit.findUnique({
      where: { id },
      include: { visitEvents: { orderBy: { createdAt: 'asc' }, take: 300 } },
    });
    if (!visit) return jsonError('الزيارة غير موجودة', 404);
    return jsonOk({ ok: true, visit });
  }

  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const device = (searchParams.get('device') || '').trim();
  const q = (searchParams.get('q') || '').trim().slice(0, 120);

  const where = {
    ...(device && ['mobile', 'tablet', 'desktop'].includes(device) ? { device } : {}),
    ...(q
      ? {
          OR: [
            { ip: { contains: q } },
            { entryPath: { contains: q } },
            { lastPath: { contains: q } },
            { deviceLabel: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, visits, dayStart] = await Promise.all([
    db.visit.count({ where }),
    db.visit.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.visit.findMany({
      where: { lastSeenAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      select: { ip: true, device: true },
    }),
  ]);

  const [allTime, deviceGroups] = await Promise.all([
    db.visit.count(),
    db.visit.groupBy({ by: ['device'], _count: { _all: true } }),
  ]);

  const uniqueIps = new Set(dayStart.map((v) => v.ip).filter(Boolean)).size;
  const deviceBreakdown: Record<string, number> = {};
  for (const g of deviceGroups) deviceBreakdown[g.device || 'unknown'] = g._count._all;

  return jsonOk({
    ok: true,
    stats: {
      today: dayStart.length,
      total: allTime,
      uniqueIpsToday: uniqueIps,
      deviceBreakdown,
    },
    visits,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
