// Lightweight product view counter — no auth, keyed by slug.
// Increments StoreSettings key "views" ({ [slug]: count }) for the
// admin dashboard "most viewed" widget. No schema change needed.
import { db } from '@/lib/db';
import { jsonOk, jsonError, parseBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ slug?: string }>(req);
    const slug = body.slug?.trim();
    if (!slug || slug.length > 200) return jsonError('منتج غير محدد');

    const row = await db.storeSettings.findUnique({ where: { key: 'views' } });
    let views: Record<string, number> = {};
    if (row) {
      try {
        views = JSON.parse(row.value) as Record<string, number>;
      } catch {
        views = {};
      }
    }
    views[slug] = (views[slug] || 0) + 1;

    await db.storeSettings.upsert({
      where: { key: 'views' },
      update: { value: JSON.stringify(views) },
      create: { key: 'views', value: JSON.stringify(views) },
    });

    return jsonOk({ ok: true });
  } catch {
    return jsonError('تعذر تسجيل المشاهدة', 500);
  }
}
