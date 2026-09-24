// Admin «أقسام الموقع» — read/write section-level texts & images
// (StoreSettings key "sections"). Permission: sections.read / sections.write.
import { invalidateSettings } from "@/lib/settings-cache"; // U54-PERF-ROBUST
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { resolveSectionTexts } from "@/lib/section-texts";
import { db } from "@/lib/db"; // U56-HOTFIX — bare `db` ReferenceError'd at runtime

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "sections.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  const row = await db.storeSettings.findUnique({ where: { key: "sections" } });
  let stored: unknown = {};
  if (row) {
    try {
      stored = JSON.parse(row.value);
    } catch {
      stored = {};
    }
  }
  return jsonOk({ ok: true, sections: resolveSectionTexts(stored) });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "sections.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const body = await parseBody<Record<string, unknown>>(req);
    // whitelist keys against the known section texts
    const allowed = new Set(Object.keys(resolveSectionTexts({})));
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowed.has(k) && (typeof v === "string")) values[k] = v.slice(0, 500);
    }
    const existing = await db.storeSettings.findUnique({ where: { key: "sections" } });
    const merged = { ...(existing ? JSON.parse(existing.value) : {}), ...values };
    await db.storeSettings.upsert({
      where: { key: "sections" },
      create: { key: "sections", value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });
    invalidateSettings(); // U54-PERF-ROBUST
    await audit(ctx, "sections.updated", "store_settings:sections");
    return jsonOk({ ok: true, success: true, sections: resolveSectionTexts(merged) });
  } catch {
    return jsonError("تعذر حفظ نصوص الأقسام", 500);
  }
}
