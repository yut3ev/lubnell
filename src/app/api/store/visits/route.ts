// VISITS-1 — public storefront visitor tracker.
// One Visit row per browser session (client UUID in localStorage); every
// tracked action appends a VisitEvent. Feeds the admin «الزيارات» section:
// IP (x-forwarded-for via Caddy), device/browser from UA, entry time, and a
// replayable "what were they doing" event trail. No auth, no PII beyond
// IP/UA — same metadata the order flow already stores.
import { db } from '@/lib/db';
import { jsonOk, jsonError, parseBody } from '@/lib/api-helpers';
import { requestMeta } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const MAX_PATH = 300;
const MAX_DETAIL = 300;
const ACTIONS = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'cart_view',
  'checkout_start',
  'order_placed',
  'review_submitted',
  'newsletter_subscribed',
  'search',
]);

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ sid?: string; path?: string; action?: string; detail?: string }>(req);
    const sid = (body.sid || '').trim().slice(0, 64);
    if (!sid || !/^[A-Za-z0-9_-]+$/.test(sid)) return jsonError('معرّف زيارة غير صالح');
    const path = (body.path || '/').slice(0, MAX_PATH);
    const action = ACTIONS.has((body.action || '').trim()) ? (body.action || '').trim() : 'page_view';
    const detail = (body.detail || '').slice(0, MAX_DETAIL) || null;

    const meta = requestMeta(req);

    const visit = await db.visit.upsert({
      where: { sessionId: sid },
      create: {
        sessionId: sid,
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        deviceLabel: meta.deviceLabel,
        entryPath: path,
        lastPath: path,
        events: 1,
      },
      update: {
        lastSeenAt: new Date(),
        lastPath: path,
        events: { increment: 1 },
        // keep IP fresh — visitors may rotate networks mid-session
        ip: meta.ip !== 'unknown' ? meta.ip : undefined,
      },
    });

    await db.visitEvent.create({
      data: { visitId: visit.id, path, action, detail },
    });

    // housekeeping: ~2% of writes prune visits idle >60 days (events cascade)
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      await db.visit.deleteMany({ where: { lastSeenAt: { lt: cutoff } } }).catch(() => undefined);
    }

    return jsonOk({ ok: true });
  } catch {
    return jsonError('تعذر تسجيل الزيارة', 500);
  }
}
