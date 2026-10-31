import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, audit, jsonError, jsonOk, parseBody } from '@/lib/api-helpers';
import {
  DEFAULT_ANNOUNCE_CONFIG,
  type AnnounceBarConfig,
  type AnnounceMessage,
} from '@/app/api/announce/route';

export const dynamic = 'force-dynamic';

const ALLOWED_ICONS = new Set(['flower', 'truck', 'gift', 'tag', 'star']);
const ALLOWED_THEMES = new Set(['rose', 'peach', 'sage', 'lilac']);
const ALLOWED_EFFECTS = new Set(['slide', 'fade']);

function isHexColor(c: unknown): boolean {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c);
}

function sanitizeText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Strip all HTML tags while strictly preserving {b} and {/b}
  let s = raw.replace(/<[^>]*>/g, '');
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // Limit to 90 characters
  return s.slice(0, 90);
}

function sanitizeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^javascript:/i.test(t)) return null;
  if (/^(https?:\/\/|\/|#)/i.test(t)) return t;
  return null;
}

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, ['settings.read', 'theme.read', 'homepage.read']);
  if (!ctx) return jsonError('غير مصرح', 401);

  try {
    const [cfgRow, historyRow] = await Promise.all([
      db.storeSettings.findUnique({ where: { key: 'announce_bar' } }),
      db.storeSettings.findUnique({ where: { key: 'announce_bar_history' } }),
    ]);

    let config: AnnounceBarConfig = DEFAULT_ANNOUNCE_CONFIG;
    if (cfgRow?.value) {
      try {
        config = { ...DEFAULT_ANNOUNCE_CONFIG, ...JSON.parse(cfgRow.value) };
      } catch {
        config = DEFAULT_ANNOUNCE_CONFIG;
      }
    }

    let history: { version: number; updatedAt: string; adminName?: string; config: AnnounceBarConfig }[] = [];
    if (historyRow?.value) {
      try {
        history = JSON.parse(historyRow.value);
        if (!Array.isArray(history)) history = [];
      } catch {
        history = [];
      }
    }

    return jsonOk({ ok: true, config, history });
  } catch (err) {
    console.error('Admin announce GET error:', err);
    return jsonError('فشل تحميل إعدادات شريط الإعلانات', 500);
  }
}

export async function PUT(req: Request) {
  const ctx = await requireAdmin(req, ['settings.write', 'theme.write', 'homepage.write']);
  if (!ctx) return jsonError('غير مصرح', 401);

  try {
    const body = await parseBody<Record<string, unknown>>(req);

    // 1. Check for Restore action
    if (body.action === 'restore' && typeof body.version === 'number') {
      const historyRow = await db.storeSettings.findUnique({ where: { key: 'announce_bar_history' } });
      let history: { version: number; config: AnnounceBarConfig }[] = [];
      if (historyRow?.value) {
        try {
          history = JSON.parse(historyRow.value);
        } catch {}
      }

      const target = history.find((h) => h.version === body.version);
      if (!target || !target.config) {
        return jsonError('النسخة المطلوبة غير موجودة في السجل', 404);
      }

      await db.storeSettings.upsert({
        where: { key: 'announce_bar' },
        create: { key: 'announce_bar', value: JSON.stringify(target.config) },
        update: { value: JSON.stringify(target.config) },
      });

      await audit(ctx, 'restore', 'announce_bar', String(body.version), {
        restoredVersion: body.version,
      });

      return jsonOk({ ok: true, message: 'تم استرجاع النسخة بنجاح', config: target.config });
    }

    // 2. Full Server-side Validation & Sanitization
    const data = (body && typeof body.config === 'object' && body.config !== null ? body.config : body) as Record<string, unknown>;

    const enabled = data.enabled !== false;
    const theme = ALLOWED_THEMES.has(String(data.theme)) ? (String(data.theme) as AnnounceBarConfig['theme']) : 'rose';
    const effect = ALLOWED_EFFECTS.has(String(data.effect)) ? (String(data.effect) as AnnounceBarConfig['effect']) : 'slide';

    // Interval: 0 (stopped) or 2000 - 15000 ms
    let intervalMs = 5000;
    if (typeof data.intervalMs === 'number') {
      if (data.intervalMs === 0) intervalMs = 0;
      else intervalMs = Math.max(2000, Math.min(15000, Math.round(data.intervalMs)));
    }

    // Transition: 150 - 2000 ms
    let transitionMs = 700;
    if (typeof data.transitionMs === 'number') {
      transitionMs = Math.max(150, Math.min(2000, Math.round(data.transitionMs)));
    }

    // Colors
    const rawColors = (data.colors || {}) as Record<string, unknown>;
    const colors: AnnounceBarConfig['colors'] = {
      bg: isHexColor(rawColors.bg) ? String(rawColors.bg) : null,
      fg: isHexColor(rawColors.fg) ? String(rawColors.fg) : null,
      hi: isHexColor(rawColors.hi) ? String(rawColors.hi) : null,
      rope: isHexColor(rawColors.rope) ? String(rawColors.rope) : null,
      stem: isHexColor(rawColors.stem) ? String(rawColors.stem) : null,
      flags: Array.isArray(rawColors.flags)
        ? rawColors.flags.filter(isHexColor).slice(0, 8)
        : [],
    };

    // Flags, flowers, dismissible, TTL, showOn
    const flags = data.flags !== false;
    const flowers = data.flowers !== false;
    const dismissible = data.dismissible !== false;
    const rememberDismiss = data.rememberDismiss !== false;
    const dismissTtlHours = [0, 24, 168].includes(Number(data.dismissTtlHours))
      ? Number(data.dismissTtlHours)
      : 0;

    let showOn = ['*'];
    if (Array.isArray(data.showOn) && data.showOn.length > 0) {
      showOn = data.showOn.map(String).filter((p) => p.trim().length > 0);
      if (showOn.length === 0) showOn = ['*'];
    }

    // Messages validation
    let rawMsgs = Array.isArray(data.messages) ? data.messages : [];
    let messages: AnnounceMessage[] = [];
    let orderIndex = 1;

    for (const m of rawMsgs) {
      if (!m || typeof m !== 'object') continue;
      const text = sanitizeText((m as Record<string, unknown>).text);
      if (!text) continue;

      const rawIcon = String((m as Record<string, unknown>).icon || 'flower').toLowerCase();
      const icon = ALLOWED_ICONS.has(rawIcon) ? (rawIcon as AnnounceMessage['icon']) : 'flower';
      const href = sanitizeHref((m as Record<string, unknown>).href);
      const active = (m as Record<string, unknown>).active !== false;

      const fromRaw = (m as Record<string, unknown>).from;
      const toRaw = (m as Record<string, unknown>).to;
      const from = typeof fromRaw === 'string' && fromRaw.trim() ? fromRaw.trim() : null;
      const to = typeof toRaw === 'string' && toRaw.trim() ? toRaw.trim() : null;

      const id = String((m as Record<string, unknown>).id || `msg_${Date.now()}_${orderIndex}`);

      messages.push({
        id,
        icon,
        text,
        href,
        active,
        from,
        to,
        order: orderIndex++,
      });
    }

    // Check active messages count <= 8
    const activeCount = messages.filter((m) => m.active).length;
    if (activeCount > 8) {
      return jsonError('الحد الأقصى للرسائل المفعّلة في نفس الوقت هو 8 رسائل.', 400);
    }

    // Fetch existing for versioning
    const [existingRow, historyRow] = await Promise.all([
      db.storeSettings.findUnique({ where: { key: 'announce_bar' } }),
      db.storeSettings.findUnique({ where: { key: 'announce_bar_history' } }),
    ]);

    let previousConfig: AnnounceBarConfig | null = null;
    let currentVersion = 1;

    if (existingRow?.value) {
      try {
        previousConfig = JSON.parse(existingRow.value);
        currentVersion = (Number(previousConfig?.version) || 1) + 1;
      } catch {}
    }

    const newConfig: AnnounceBarConfig = {
      enabled,
      theme,
      colors,
      intervalMs,
      transitionMs,
      effect,
      flags,
      flowers,
      dismissible,
      rememberDismiss,
      dismissTtlHours,
      showOn,
      messages,
      version: currentVersion,
    };

    // Save history (last 10 versions)
    let history: { version: number; updatedAt: string; adminName?: string; config: AnnounceBarConfig }[] = [];
    if (historyRow?.value) {
      try {
        history = JSON.parse(historyRow.value);
        if (!Array.isArray(history)) history = [];
      } catch {}
    }

    if (previousConfig) {
      history.unshift({
        version: previousConfig.version || currentVersion - 1,
        updatedAt: new Date().toISOString(),
        adminName: ctx.admin.displayName || ctx.admin.username,
        config: previousConfig,
      });
      // Keep only last 10 versions
      history = history.slice(0, 10);
    }

    await Promise.all([
      db.storeSettings.upsert({
        where: { key: 'announce_bar' },
        create: { key: 'announce_bar', value: JSON.stringify(newConfig) },
        update: { value: JSON.stringify(newConfig) },
      }),
      db.storeSettings.upsert({
        where: { key: 'announce_bar_history' },
        create: { key: 'announce_bar_history', value: JSON.stringify(history) },
        update: { value: JSON.stringify(history) },
      }),
    ]);

    await audit(ctx, 'update', 'announce_bar', String(currentVersion), {
      version: currentVersion,
      activeMessages: activeCount,
      theme,
    });

    return jsonOk({ ok: true, message: 'تم حفظ ونشر الإعدادات بنجاح', config: newConfig });
  } catch (err) {
    console.error('Admin announce save error:', err);
    return jsonError('فشل حفظ إعدادات شريط الإعلانات', 500);
  }
}
