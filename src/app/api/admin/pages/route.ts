// Admin static pages: CRUD stored in StoreSettings under key "pages"
// Shape: { pages: [{ slug, titleAr, titleEn, contentAr, contentEn, custom, updatedAt }] }
// U22-PAGES — rebuilt to the owner's screenshot (brave_HaG5DxB5r3): the 7
// built-in info slugs always show as cards (افتراضية / مخصصة), «استيراد
// الصفحات الافتراضية» seeds starter copies, and every page is bilingual
// (AR + EN) — the storefront /info/[slug] renderer already prefers the EN
// pair when the visitor browses in English.
import { db } from "@/lib/db";
import { invalidateSettings } from "@/lib/settings-cache"; // U54-PERF-ROBUST
import { jsonOk, jsonError, parseBody, requireAdmin, audit, slugify } from "@/lib/api-helpers";
import { DEFAULT_INFO_PAGES } from "@/lib/info-pages";

export const dynamic = "force-dynamic";

const KEY = "pages";

type AdminPage = {
  slug: string;
  titleAr: string;
  titleEn?: string;
  contentAr: string;
  contentEn?: string;
  /** true = saved/edited by the owner (شارة «مخصصة») */
  custom?: boolean;
  updatedAt: string;
};

async function readPages(): Promise<AdminPage[]> {
  const row = await db.storeSettings.findUnique({ where: { key: KEY } });
  try {
    const parsed = JSON.parse(row?.value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePages(pages: AdminPage[]) {
  await db.storeSettings.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(pages) },
    update: { value: JSON.stringify(pages) },
  });
  invalidateSettings(); // U54-PERF-ROBUST — /info/* reflects edits immediately
}

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "pages.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  const pages = await readPages();
  return jsonOk({ ok: true, pages });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "pages.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const input = await parseBody<{
      action?: "save" | "remove" | "seedDefaults";
      slug?: string;
      titleAr?: string;
      titleEn?: string;
      contentAr?: string;
      contentEn?: string;
    }>(req);
    const pages = await readPages();

    // U22 — «استيراد الصفحات الافتراضية»: seed editable starter copies of the
    // built-in info pages that have no stored entry yet (never overwrites).
    if (input.action === "seedDefaults") {
      const known = new Set(pages.map((p) => p.slug));
      const now = new Date().toISOString();
      let seeded = 0;
      for (const [slug, base] of Object.entries(DEFAULT_INFO_PAGES)) {
        if (known.has(slug)) continue;
        pages.push({
          slug,
          titleAr: base.titleAr,
          titleEn: base.titleEn,
          contentAr: base.contentAr,
          contentEn: base.contentEn,
          custom: false,
          updatedAt: now,
        });
        seeded++;
      }
      await writePages(pages);
      await audit(ctx, "page.defaults_imported", "store_page", String(seeded));
      return jsonOk({ ok: true, success: true, seeded, pages });
    }

    if (input.action === "remove") {
      if (!input.slug) return jsonError("صفحة غير محددة");
      const next = pages.filter(p => p.slug !== input.slug);
      await writePages(next);
      await audit(ctx, "page.removed", "store_page", input.slug);
      return jsonOk({ ok: true, success: true, pages: next });
    }

    const titleAr = (input.titleAr || "").trim();
    if (!titleAr) return jsonError("عنوان الصفحة مطلوب");
    const slug = slugify(input.slug || titleAr);
    const existing = pages.find(p => p.slug === slug);
    const page: AdminPage = {
      slug,
      titleAr,
      titleEn: (input.titleEn || existing?.titleEn || "").trim(),
      contentAr: input.contentAr ?? existing?.contentAr ?? "",
      contentEn: (input.contentEn ?? existing?.contentEn ?? "").trim(),
      custom: true, // any manual save marks the page «مخصصة»
      updatedAt: new Date().toISOString(),
    };
    const next = existing
      ? pages.map(p => (p.slug === slug ? page : p))
      : [...pages, page];
    await writePages(next);
    await audit(ctx, existing ? "page.updated" : "page.created", "store_page", slug);
    return jsonOk({ ok: true, success: true, pages: next });
  } catch (error) {
    console.error("page save failed", error);
    return jsonError("تعذر حفظ الصفحة", 500);
  }
}
