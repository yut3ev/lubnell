import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// RESTOCK-ALERTS-2026-10 — «أعلمني لما يتوفر»: a customer leaves her phone on
// a sold-out product; the request lands in StoreSettings key=restock_alerts
// (no schema migration needed) and the Studio products screen surfaces the
// pending list with one-tap wa.me messages once the stock is back.
// Abuse guards: light per-IP throttle, phone shape check, dedupe per
// slug+phone, hard cap on the stored list.

type RestockAlert = { slug: string; productName: string; phone: string; at: string; done: boolean };

const CAP = 400;
const buckets = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  buckets.set(ip, hits);
  if (buckets.size > 500) buckets.clear();
  return hits.length > 6;
}

function normalizePhone(v: string): string {
  const digits = (v || '').replace(/\D/g, '');
  return digits.startsWith('20') ? digits.slice(2) : digits;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (throttled(ip)) {
      return NextResponse.json({ ok: false, error: 'محاولات كتير — جربي بعد دقيقة' }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim();
    const phone = normalizePhone(String(body?.phone || ''));
    if (!slug || !/^[0-9]{10,13}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: 'اكتبي رقم موبايل صحيح' }, { status: 400 });
    }

    const product = await db.product.findUnique({ where: { slug }, select: { nameAr: true, stock: true, published: true } });
    if (!product || !product.published) {
      return NextResponse.json({ ok: false, error: 'المنتج غير موجود' }, { status: 404 });
    }
    if (product.stock > 0) {
      return NextResponse.json({ ok: true, alreadyAvailable: true, message: 'المنتج متاح حاليًا — اطلبيه من صفحته 🌸' });
    }

    const row = await db.storeSettings.findUnique({ where: { key: 'restock_alerts' } });
    let alerts: RestockAlert[] = [];
    try {
      const parsed = JSON.parse(row?.value || '[]');
      // the Studio writes { alerts: [...] } (settings POST merges objects);
      // accept both shapes for robustness
      if (Array.isArray(parsed)) alerts = parsed as RestockAlert[];
      else if (Array.isArray(parsed?.alerts)) alerts = parsed.alerts as RestockAlert[];
    } catch {
      alerts = [];
    }
    alerts = alerts.filter((a) => a && typeof a === 'object');

    if (alerts.some((a) => a.slug === slug && a.phone === phone && !a.done)) {
      return NextResponse.json({ ok: true, duplicate: true, message: 'رقمكِ مسجل بالفعل لهذا المنتج — هنكلمك أول ما يتوفر 🌸' });
    }
    alerts.push({ slug, productName: product.nameAr, phone, at: new Date().toISOString(), done: false });
    while (alerts.filter((a) => !a.done).length > CAP) {
      const idx = alerts.findIndex((a) => !a.done);
      if (idx < 0) break;
      alerts.splice(idx, 1);
    }
    await db.storeSettings.upsert({
      where: { key: 'restock_alerts' },
      update: { value: JSON.stringify({ alerts }) },
      create: { key: 'restock_alerts', value: JSON.stringify({ alerts }) },
    });

    return NextResponse.json({ ok: true, message: 'تم تسجيل رقمكِ — هنكلمك أول ما المنتج يتوفر 🌸' });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر التسجيل الآن — جربي بعد قليل' }, { status: 500 });
  }
}
