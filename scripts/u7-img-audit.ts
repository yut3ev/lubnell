// U7-IMG: audit every image URL referenced in the DB against the filesystem.
// Owner report: "images upload but show as broken on the site".
// Finds: DB rows whose local URL has no file behind it, remote URLs that fail,
// and prints recent upload activity for timeline correlation.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const db = new PrismaClient();

type Ref = { label: string; url: string };

function collect(label: string, v: unknown, out: Ref[]) {
  if (typeof v === "string" && v.trim() && (v.startsWith("/") || v.startsWith("http"))) {
    out.push({ label, url: v.trim() });
  } else if (Array.isArray(v)) {
    v.forEach((item, i) => collect(`${label}[${i}]`, item, out));
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (/image|img|photo|video|logo|thumb|gallery|cta/i.test(k) || typeof val === "object") {
        collect(`${label}.${k}`, val, out);
      }
    }
  }
}

async function main() {
  const refs: Ref[] = [];

  const products = await db.product.findMany({ select: { slug: true, image: true, gallery: true } });
  for (const p of products) {
    collect(`product:${p.slug}`, p.image, refs);
    if (p.gallery) {
      try { collect(`product:${p.slug}.gallery`, JSON.parse(p.gallery), refs); } catch {}
    }
  }

  const cats = await db.category.findMany({ select: { slug: true, image: true, pageImage: true } });
  for (const c of cats) {
    collect(`category:${c.slug}`, c.image, refs);
    collect(`category:${c.slug}.pageImage`, c.pageImage, refs);
  }

  const slides = await db.heroSlide.findMany({ select: { id: true, image: true, video: true } });
  for (const s of slides) {
    collect(`slide:${s.id}`, s.image, refs);
    collect(`slide:${s.id}.video`, s.video, refs);
  }

  const reviews = await db.review.findMany({ where: { image: { not: null } }, select: { id: true, image: true } });
  for (const r of reviews) collect(`review:${r.id}`, r.image, refs);

  const settings = await db.storeSettings.findMany();
  for (const s of settings) {
    try { collect(`settings:${s.key}`, JSON.parse(s.value), refs); } catch {}
  }

  // dedupe
  const seen = new Map<string, Ref[]>();
  for (const r of refs) {
    const list = seen.get(r.url) || [];
    list.push(r);
    seen.set(r.url, list);
  }

  console.log(`total unique URLs referenced: ${seen.size}`);
  let missing = 0, remoteBad = 0, remoteOk = 0, localOk = 0;

  for (const [url, uses] of seen) {
    if (url.startsWith("/")) {
      const fp = path.join(process.cwd(), "public", url);
      let ok = false, size = 0;
      try { const st = fs.statSync(fp); ok = st.isFile(); size = st.size; } catch {}
      if (!ok || size === 0) {
        missing++;
        console.log(`MISSING ${url} (${size}b) <- ${uses.slice(0, 3).map((u) => u.label).join(", ")}${uses.length > 3 ? ` +${uses.length - 3} more` : ""}`);
      } else localOk++;
    } else {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const res = await fetch(url, { method: "GET", signal: ctl.signal, redirect: "follow" });
        clearTimeout(t);
        if (!res.ok) {
          remoteBad++;
          console.log(`REMOTE-BAD ${res.status} ${url} <- ${uses.slice(0, 2).map((u) => u.label).join(", ")}`);
        } else remoteOk++;
      } catch (e) {
        remoteBad++;
        console.log(`REMOTE-ERR ${url} <- ${uses.slice(0, 2).map((u) => u.label).join(", ")} (${(e as Error).message})`);
      }
    }
  }

  console.log(`\nsummary: localOk=${localOk} missing=${missing} remoteOk=${remoteOk} remoteBad=${remoteBad}`);

  const assets = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  console.log("\nrecent MediaAsset rows:");
  for (const a of assets) {
    const fp = path.join(process.cwd(), "public", a.storageKey);
    const onDisk = fs.existsSync(fp);
    console.log(`  ${a.createdAt.toISOString()} ${onDisk ? "on-disk" : "NO-FILE"} ${a.mimeType} ${a.url}`);
  }

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
