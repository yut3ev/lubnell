// PUSH-2026-10 — self-hosted Web Push helpers (no external push service).
// - VAPID keys are generated ONCE and persisted in StoreSettings key=push
//   (never re-generated: rotating them silently invalidates every subscription)
// - subscriptions live in StoreSettings key=push_subscriptions as a JSON array
//   ({endpoint, keys:{p256dh, auth}, at}) — no schema migration needed
// - dead endpoints (404/410) are pruned automatically on every broadcast
import { db } from '@/lib/db';
import webpush from 'web-push';

export type PushSubscriptionRow = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  at: string;
};

const SUBJECT = 'https://lubnel.vercel.app';
const MAX_SUBS = 3000;

type VapidKeys = { publicKey: string; privateKey: string };

async function loadVapid(): Promise<VapidKeys | null> {
  try {
    const row = await db.storeSettings.findUnique({ where: { key: 'push' } });
    const parsed = row ? (JSON.parse(row.value || '{}') as Partial<VapidKeys>) : {};
    if (parsed.publicKey && parsed.privateKey) return parsed as VapidKeys;
    // first use → generate once and persist (rotation would kill subscriptions)
    const fresh = webpush.generateVAPIDKeys();
    await db.storeSettings.upsert({
      where: { key: 'push' },
      update: { value: JSON.stringify(fresh) },
      create: { key: 'push', value: JSON.stringify(fresh) },
    });
    return fresh;
  } catch {
    return null;
  }
}

export async function pushStatus(): Promise<{ vapidReady: boolean; subscribers: number }> {
  try {
    const vapid = await loadVapid();
    const subs = await loadSubscriptions();
    return { vapidReady: !!vapid, subscribers: subs.length };
  } catch {
    return { vapidReady: false, subscribers: 0 };
  }
}

/** The VAPID public key is public by design — the browser needs it to subscribe. */
export async function publicKeyForClient(): Promise<string> {
  try {
    const vapid = await loadVapid();
    return vapid?.publicKey || '';
  } catch {
    return '';
  }
}

async function loadSubscriptions(): Promise<PushSubscriptionRow[]> {
  try {
    const row = await db.storeSettings.findUnique({ where: { key: 'push_subscriptions' } });
    const parsed = JSON.parse(row?.value || '{}');
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.subs) ? parsed.subs : [];
    return list.filter((s: PushSubscriptionRow) => s && s.endpoint && s.keys?.p256dh && s.keys?.auth);
  } catch {
    return [];
  }
}

async function saveSubscriptions(subs: PushSubscriptionRow[]): Promise<void> {
  while (subs.length > MAX_SUBS) subs.shift();
  await db.storeSettings.upsert({
    where: { key: 'push_subscriptions' },
    update: { value: JSON.stringify(subs) },
    create: { key: 'push_subscriptions', value: JSON.stringify(subs) },
  });
}

export async function addSubscription(sub: PushSubscriptionRow): Promise<{ ok: boolean; count: number }> {
  const vapid = await loadVapid();
  if (!vapid) return { ok: false, count: 0 };
  const subs = await loadSubscriptions();
  const clean = String(sub.endpoint || '');
  if (!clean || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, count: subs.length };
  const idx = subs.findIndex((s) => s.endpoint === clean);
  const row: PushSubscriptionRow = { endpoint: clean, keys: sub.keys, at: new Date().toISOString() };
  if (idx >= 0) subs[idx] = row;
  else subs.push(row);
  await saveSubscriptions(subs);
  return { ok: true, count: subs.length };
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subs = await loadSubscriptions();
  await saveSubscriptions(subs.filter((s) => s.endpoint !== endpoint));
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Broadcast to every subscriber; prunes endpoints the browser reports dead. */
export async function broadcastPush(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const vapid = await loadVapid();
  if (!vapid) return { sent: 0, failed: 0 };
  const subs = await loadSubscriptions();
  if (subs.length === 0) return { sent: 0, failed: 0 };

  webpush.setVapidDetails(SUBJECT, vapid.publicKey, vapid.privateKey);
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ ...payload, icon: '/brand/logo-dark.png', badge: '/brand/logo-dark.png' })
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) dead.push(sub.endpoint);
        else sent += 0; // transient — keep the subscription
      }
    })
  );
  if (dead.length) {
    const kept = await loadSubscriptions();
    await saveSubscriptions(kept.filter((s) => !dead.includes(s.endpoint)));
  }
  return { sent, failed: dead.length };
}

/** PUSH×RESTOCK — a sold-out product got stock back: notify every push
 *  subscriber, then mark that product's pending «أعلمني لما يتوفر» rows done. */
export async function notifyRestockSubscribers(slug: string, productName: string): Promise<number> {
  try {
    const row = await db.storeSettings.findUnique({ where: { key: 'restock_alerts' } });
    let alerts: { slug: string; phone: string; productName: string; at: string; done: boolean }[] = [];
    try {
      const parsed = JSON.parse(row?.value || '{}');
      if (Array.isArray(parsed)) alerts = parsed;
      else if (Array.isArray(parsed?.alerts)) alerts = parsed.alerts;
    } catch {
      alerts = [];
    }
    const pending = alerts.filter((a) => a.slug === slug && !a.done);
    if (pending.length === 0) return 0;
    const { sent } = await broadcastPush({
      title: 'بقى متوفر تاني 🌸',
      body: `${productName} رجع عندنا — الكمية محدودة، اطلبيه قبل ما يخلص`,
      url: `/p/${slug}`,
      tag: `restock-${slug}`,
    });
    await db.storeSettings.upsert({
      where: { key: 'restock_alerts' },
      update: { value: JSON.stringify(alerts.map((a) => (a.slug === slug ? { ...a, done: true } : a))) },
      create: { key: 'restock_alerts', value: JSON.stringify({ alerts: alerts.map((a) => (a.slug === slug ? { ...a, done: true } : a)) }) },
    });
    return sent;
  } catch {
    return 0;
  }
}
