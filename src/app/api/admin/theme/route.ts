// U29-THEME-STUDIO — Global Theme & Color Control API.
// GET  → the full v2 theme config (presets + activeId) or null (factory).
// PUT  → replaces the whole config (validated/clamped in resolveThemeConfig).
// Stored under StoreSettings key "theme_v2"; the legacy SUP-8 key "theme"
// stays untouched and only applies when no v2 config exists.
import { invalidateSettings } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from '@/lib/api-helpers';
import { resolveThemeConfig, emptyConfig } from '@/lib/theme-config';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, ['settings.read', 'theme.read']);
  if (!ctx) return jsonError('غير مصرح', 401);
  if (!(ctx.permissions.includes('settings.read') || ctx.permissions.includes('theme.read'))) {
    return jsonError('غير مصرح', 401);
  }
  const row = await db.storeSettings.findUnique({ where: { key: 'theme_v2' } });
  const config = row ? resolveThemeConfig(JSON.parse(row.value)) : null;
  return jsonOk({ ok: true, config: config ?? emptyConfig() });
}

export async function PUT(req: Request) {
  const ctx = await requireAdmin(req, ['settings.write', 'theme.write']);
  if (!ctx) return jsonError('غير مصرح', 401);
  if (!(ctx.permissions.includes('settings.write') || ctx.permissions.includes('theme.write'))) {
    return jsonError('غير مصرح', 401);
  }
  try {
    const body = await parseBody<Record<string, unknown>>(req);
    if (body.reset) {
      // Reset Theme — back to the factory look (confirmation handled in UI)
      const config = emptyConfig();
      await db.storeSettings.upsert({
        where: { key: 'theme_v2' },
        create: { key: 'theme_v2', value: JSON.stringify(config) },
        update: { value: JSON.stringify(config) },
      });
      invalidateSettings(); // U54-PERF-ROBUST
      await audit(ctx, 'settings.updated', 'store_settings:theme_v2', 'theme.reset');
      return jsonOk({ ok: true, config });
    }
    // resolveThemeConfig clamps/repairs everything untrusted
    const config = resolveThemeConfig(body.config);
    if (!config) return jsonError('صيغة الثيم غير صالحة', 400);
    await db.storeSettings.upsert({
      where: { key: 'theme_v2' },
      create: { key: 'theme_v2', value: JSON.stringify(config) },
      update: { value: JSON.stringify(config) },
    });
    invalidateSettings(); // U54-PERF-ROBUST
    await audit(ctx, 'settings.updated', 'store_settings:theme_v2', 'theme.saved');
    return jsonOk({ ok: true, config });
  } catch {
    return jsonError('تعذر حفظ الثيم', 500);
  }
}
