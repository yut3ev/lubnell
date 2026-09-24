// Admin hero slides: GET list (any admin), POST upsert/remove/toggle (homepage.write)
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireAdmin(req);
  if (!ctx) return jsonError("غير مصرح", 401);
  const slides = await db.heroSlide.findMany({ orderBy: { sortOrder: "asc" } });
  return jsonOk({ ok: true, slides });
}

type SlideInput = {
  action?: "upsert" | "remove";
  id?: string;
  eyebrow?: string;
  titleAr?: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
  ctaAr?: string;
  ctaEn?: string;
  image?: string;
  imageMobile?: string; // U21-MOBILE-HERO — portrait crop for phones
  video?: string;
  href?: string;
  active?: boolean;
  sortOrder?: number;
};

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "homepage.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const input = await parseBody<SlideInput>(req);
    if (input.action === "remove") {
      if (!input.id) return jsonError("شريحة غير محددة");
      await db.heroSlide.deleteMany({ where: { id: input.id } });
      await audit(ctx, "slide.removed", "hero_slide", input.id);
      return jsonOk({ ok: true, success: true });
    }
    if (!input.id || !input.titleAr || !input.titleEn || !input.image) {
      return jsonError("العنوان والصورة مطلوبان");
    }
    const data = {
      id: input.id,
      eyebrow: input.eyebrow || "LUBNÉL",
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      bodyAr: input.bodyAr || "",
      bodyEn: input.bodyEn || "",
      ctaAr: input.ctaAr || "تسوّقي الآن",
      ctaEn: input.ctaEn || "Shop now",
      image: input.image,
      // U21-MOBILE-HERO — optional portrait crop; empty string clears it
      imageMobile:
        typeof input.imageMobile === "string" && input.imageMobile.trim()
          ? input.imageMobile.trim()
          : null,
      // U19-VIDEO — optional MP4; empty string clears it (null in DB)
      video: typeof input.video === "string" && input.video.trim() ? input.video.trim() : null,
      href: input.href || "/",
      active: input.active !== false,
      sortOrder: input.sortOrder ?? 99,
    };
    await db.heroSlide.upsert({ where: { id: input.id }, create: data, update: data });
    await audit(ctx, "slide.saved", "hero_slide", input.id);
    return jsonOk({ ok: true, success: true });
  } catch (error) {
    console.error("slide save failed", error);
    return jsonError("تعذر حفظ الشريحة", 500);
  }
}
