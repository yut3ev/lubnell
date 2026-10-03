// Admin store settings: GET, POST save.
// SUP-8 — multi-key support: `store` (identity/shipping/announcement),
// `texts` (all site copy + footer), `theme` (color palette).
// U71-NEWSLETTER-ADMIN — `smtp` (outgoing mail server for newsletter sends).
// U77-MAINTENANCE-MODE — `maintenance` (site open/close switch + custom message).
// Each key is an independent StoreSettings row stored as JSON, merged on save.
import { invalidateSettings } from "@/lib/settings-cache"; // U54-PERF-ROBUST
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { db } from "@/lib/db"; // U56-HOTFIX — bare `db` ReferenceError'd at runtime (500 on every settings save)
// U72-SMTP-BREVO — the smtp key never round-trips its password: GET masks it
// behind a `passSet` flag, and POST only overwrites it when a non-empty value
// is sent (so saving the form without retyping the key can't wipe it).

export const dynamic = "force-dynamic";

const KEYS = ["store", "texts", "theme", "brand", "seo", "smtp", "maintenance", "restock_alerts"] as const;
type SettingsKey = (typeof KEYS)[number];

function resolveKey(raw: unknown): SettingsKey {
  return (KEYS as readonly string[]).includes(String(raw)) ? (String(raw) as SettingsKey) : "store";
}

export async function GET(req: Request) {
  // U22-TEAM-PERMS — theme/content sections load their data from this same
  // endpoint; staff granted only theme.read / content.read must be able to
  // read the matching keys without holding the full settings.read key.
  const ctx = await requireAdmin(req, ["settings.read", "theme.read", "content.read"]);
  if (!ctx) return jsonError("غير مصرح", 401);
  const { searchParams } = new URL(req.url);
  const key = resolveKey(searchParams.get("key"));
  // key-scoped enforcement: theme rows need theme.*, texts rows need content.*
  if (key === "theme" && !(ctx.permissions.includes("settings.read") || ctx.permissions.includes("theme.read"))) {
    return jsonError("غير مصرح", 401);
  }
  if (key === "texts" && !(ctx.permissions.includes("settings.read") || ctx.permissions.includes("content.read"))) {
    return jsonError("غير مصرح", 401);
  }
  const row = await db.storeSettings.findUnique({ where: { key } });
  let settings: Record<string, unknown> | null = row ? JSON.parse(row.value) : null;
  if (key === "smtp" && settings) {
    const { pass, ...rest } = settings as Record<string, unknown>;
    settings = { ...rest, pass: "", passSet: Boolean(pass) }; // U72 — never leak the SMTP key
  }
  return jsonOk({ ok: true, key, settings });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, ["settings.write", "theme.write", "content.write"]);
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const body = await parseBody<Record<string, unknown>>(req);
    const key = resolveKey(body.key);
    // key-scoped enforcement on save as well
    if (key === "theme" && !(ctx.permissions.includes("settings.write") || ctx.permissions.includes("theme.write"))) {
      return jsonError("غير مصرح", 401);
    }
    if (key === "texts" && !(ctx.permissions.includes("settings.write") || ctx.permissions.includes("content.write"))) {
      return jsonError("غير مصرح", 401);
    }
    const values: Record<string, unknown> = { ...body };
    delete values.key;
    if (key === "smtp") {
      // U72 — empty password field = «keep the stored key»; also drop the GET-only flag
      if (typeof values.pass !== "string" || !values.pass.trim()) delete values.pass;
      delete values.passSet;
    }
    const existing = await db.storeSettings.findUnique({ where: { key } });
    const merged = { ...(existing ? JSON.parse(existing.value) : {}), ...values };
    await db.storeSettings.upsert({ where: { key }, create: { key, value: JSON.stringify(merged) }, update: { value: JSON.stringify(merged) } });
    invalidateSettings(); // U54-PERF-ROBUST — storefront serves the new values on the next request
    await audit(ctx, "settings.updated", `store_settings:${key}`, key);
    return jsonOk({ ok: true, success: true, key, settings: merged });
  } catch {
    return jsonError("تعذر حفظ الإعدادات", 500);
  }
}
