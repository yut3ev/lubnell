// U17-HOME-EDITOR — persist the «أقسام الصفحة» editor state (visibility +
// template per homepage section) under StoreSettings key "home_sections".
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateSettings } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { requireAdmin, writeAudit } from '@/lib/admin-auth';
import { resolveHomeSections } from '@/lib/home-sections-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('homepage.read'))
    return NextResponse.json({ ok: false }, { status: 401 });
  const rows = await db.storeSettings.findMany({ where: { key: 'home_sections' } }).catch(() => []);
  let raw: unknown = {};
  try {
    raw = JSON.parse(rows[0]?.value ?? '{}');
  } catch {
    raw = {};
  }
  return NextResponse.json({ ok: true, config: resolveHomeSections(raw) });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin || !admin.perms.includes('homepage.write'))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const b = await req.json();
    // resolve through the whitelist — unknown keys/templates never reach the DB
    const config = resolveHomeSections(b?.config);
    const value = JSON.stringify(config);
    const existing = await db.storeSettings.findUnique({ where: { key: 'home_sections' } });
    if (existing) {
      await db.storeSettings.update({ where: { key: 'home_sections' }, data: { value } });
    } else {
      await db.storeSettings.create({ data: { key: 'home_sections', value } });
    }
    invalidateSettings(); // U54-PERF-ROBUST
    await writeAudit({ actor: admin.username, action: 'home_sections.published', entity: 'store_settings', entityId: 'home_sections' });
    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حفظ أقسام الصفحة' }, { status: 500 });
  }
}
