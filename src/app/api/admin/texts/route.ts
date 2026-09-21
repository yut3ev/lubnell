// U51-GLOBAL-TEXTS — Admin «كل النصوص»: read/write the storefront dictionary
// overrides (StoreSettings key "uitexts"). Permission: sections.read/write
// (same content-editing family as نصوص الأقسام; the owner holds all).
import { invalidateSettings } from "@/lib/settings-cache"; // U54-PERF-ROBUST
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { sanitizeTextBag } from "@/lib/text-keys";
import { db } from "@/lib/db"; // U56-HOTFIX — bare `db` ReferenceError'd at runtime

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "sections.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  const row = await db.storeSettings.findUnique({ where: { key: "uitexts" } });
  let stored: unknown = {};
  if (row) {
    try {
      stored = JSON.parse(row.value);
    } catch {
      stored = {};
    }
  }
  return jsonOk({ ok: true, overrides: sanitizeTextBag(stored) });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "sections.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const body = await parseBody<Record<string, unknown>>(req);
    // sanitizeTextBag whitelists keys against the registry and clamps values.
    // An empty pair ({}) means "clear this override" → the key is removed so
    // the dictionary default wins again.
    const incoming = sanitizeTextBag(body);
    const existing = await db.storeSettings.findUnique({ where: { key: "uitexts" } });
    let merged: Record<string, { ar?: string; en?: string }> = {};
    if (existing) {
      try {
        merged = sanitizeTextBag(JSON.parse(existing.value));
      } catch {
        merged = {};
      }
    }
    for (const [k, pair] of Object.entries(incoming)) {
      if (!pair.ar && !pair.en) delete merged[k];
      else merged[k] = pair;
    }
    await db.storeSettings.upsert({
      where: { key: "uitexts" },
      create: { key: "uitexts", value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });
    invalidateSettings(); // U54-PERF-ROBUST
    await audit(ctx, "texts.updated", "store_settings:uitexts");
    return jsonOk({ ok: true, success: true, overrides: merged });
  } catch {
    return jsonError("تعذر حفظ النصوص", 500);
  }
}
