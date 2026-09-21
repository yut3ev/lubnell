// U61-BLOG — admin CRUD for the store journal (Studio → «المدونة»).
// GET (pages.read) lists every post; POST (pages.write) saves / removes /
// toggles. The storefront reads the Post table directly (force-dynamic), so
// edits are live on the next request with no cache layer to invalidate.
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody, requireAdmin, audit, slugify } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type PostInput = {
  action?: "save" | "remove" | "toggle";
  id?: string;
  slug?: string;
  titleAr?: string;
  titleEn?: string;
  excerptAr?: string;
  excerptEn?: string;
  contentAr?: string;
  contentEn?: string;
  coverImage?: string;
  productSlugs?: string[];
  published?: boolean;
};

const MAX_FEATURED = 4;

/** pick a free unique slug: base, base-2, base-3 … (skips the post's own row) */
async function freeSlug(base: string, ownId?: string) {
  let candidate = base;
  for (let i = 2; i < 50; i += 1) {
    const clash = await db.post.findUnique({ where: { slug: candidate } });
    if (!clash || clash.id === ownId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "pages.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  const posts = await db.post.findMany({ orderBy: { createdAt: "desc" } });
  return jsonOk({ ok: true, posts });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "pages.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const input = await parseBody<PostInput>(req);

    if (input.action === "remove") {
      if (!input.id) return jsonError("مقال غير محدد");
      await db.post.deleteMany({ where: { id: input.id } });
      await audit(ctx, "post.removed", "post", input.id);
      return jsonOk({ ok: true, success: true });
    }

    if (input.action === "toggle") {
      if (!input.id) return jsonError("مقال غير محدد");
      const existing = await db.post.findUnique({ where: { id: input.id } });
      if (!existing) return jsonError("المقال غير موجود", 404);
      const published = !existing.published;
      await db.post.update({
        where: { id: input.id },
        data: { published, publishedAt: published ? existing.publishedAt ?? new Date() : existing.publishedAt },
      });
      await audit(ctx, "post.toggled", "post", input.id);
      return jsonOk({ ok: true, success: true, published });
    }

    // save
    if (!input.titleAr?.trim() || !input.contentAr?.trim()) {
      return jsonError("العنوان والمحتوى العربي مطلوبان");
    }
    const baseSlug = slugify(input.slug?.trim() || input.titleEn?.trim() || input.titleAr);
    const slug = await freeSlug(baseSlug, input.id);
    const slugs = Array.isArray(input.productSlugs)
      ? input.productSlugs.filter((s) => typeof s === "string" && s.trim()).slice(0, MAX_FEATURED)
      : [];

    const existing = input.id ? await db.post.findUnique({ where: { id: input.id } }) : null;
    const published = input.published !== false;
    const data = {
      slug,
      titleAr: input.titleAr.trim(),
      titleEn: input.titleEn?.trim() || "",
      excerptAr: input.excerptAr?.trim() || input.contentAr.trim().split("\n")[0].slice(0, 180),
      excerptEn: input.excerptEn?.trim() || "",
      contentAr: input.contentAr,
      contentEn: input.contentEn || "",
      coverImage: input.coverImage?.trim() || null,
      productSlugs: JSON.stringify(slugs),
      published,
      // first publish stamps publishedAt; unpublish keeps the original date
      publishedAt: published ? existing?.publishedAt ?? new Date() : existing?.publishedAt ?? null,
    };

    const post = existing
      ? await db.post.update({ where: { id: existing.id }, data })
      : await db.post.create({ data });
    await audit(ctx, "post.saved", "post", post.id);
    return jsonOk({ ok: true, success: true, post });
  } catch (error) {
    console.error("post save failed", error);
    return jsonError("تعذر حفظ المقال", 500);
  }
}
