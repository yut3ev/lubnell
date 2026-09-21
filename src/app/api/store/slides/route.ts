// Public hero slides for the storefront slider (active only, ordered)
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// U36-WIDE-BANNER — the storefront needs each slide's pixel dimensions to
// decide the mobile composition: ultra-wide banners (w÷h ≥ 2.2) render
// fit-to-width with NO cropping (owner: «من غير قص ولا مساحات فاضية») while
// normal/portrait art keeps the cover+overlay hero. sharp metadata is a
// header read (~1ms); a small mtime-keyed cache keeps repeat hits at ~0.
type MediaMeta = { w: number; h: number; imageSmall?: string };
const metaCache = new Map<string, MediaMeta>();

async function mediaMeta(publicPath: string): Promise<MediaMeta | undefined> {
  if (!publicPath || !publicPath.startsWith("/") || publicPath.startsWith("/uploads")) {
    return undefined; // DB-blob media has no file to stat → cover mode
  }
  try {
    const abs = join(process.cwd(), "public", publicPath);
    const key = `${publicPath}@${statSync(abs).mtimeMs}`;
    const hit = metaCache.get(key);
    if (hit) return hit;
    const sharp = (await import("sharp")).default;
    const meta = await sharp(abs).metadata();
    if (!meta.width || !meta.height) return undefined;
    // light twin convention: «hero-1-wide.webp» + «hero-1-wide-s.webp» —
    // when present the -s variant is served to phones (<640px)
    const small = publicPath.replace(/(\.\w+)$/, "-s$1");
    const out: MediaMeta = {
      w: meta.width,
      h: meta.height,
      imageSmall: existsSync(join(process.cwd(), "public", small)) ? small : undefined,
    };
    metaCache.set(key, out);
    if (metaCache.size > 300) metaCache.clear();
    return out;
  } catch {
    return undefined;
  }
}

export async function GET() {
  try {
    const rows = await db.heroSlide.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, eyebrow: true, titleAr: true, titleEn: true,
        bodyAr: true, bodyEn: true, ctaAr: true, ctaEn: true, image: true,
        imageMobile: true, // U21-MOBILE-HERO — portrait crop served to phones
        video: true, // U19-VIDEO — MP4 slides play in the storefront hero
        href: true,
      },
    });
    const slides = await Promise.all(
      rows.map(async (s) => {
        const meta = await mediaMeta(s.image);
        return { ...s, w: meta?.w, h: meta?.h, imageSmall: meta?.imageSmall ?? null };
      })
    );
    return NextResponse.json(
      { ok: true, slides },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: true, slides: [] });
  }
}
