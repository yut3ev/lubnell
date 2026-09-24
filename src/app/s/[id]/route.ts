import { db } from "@/lib/db";
import { shareOrigin } from "@/lib/share-helpers";

// R29 — hero campaign share deep link: /s/[id]
// Same crawler/visitor split as /p/[id] and /c/[slug]: crawlers get the
// campaign slide's real OG meta (the slide's own artwork as og:image), while
// human browsers bounce into the hash-routed home with ?s=<slideId> so the
// carousel opens on that exact slide. Unknown/inactive slides 302 home.
// noindex,follow — shareable links, not search surface.

export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const clamp = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: slideId } = await params;
  const origin = await shareOrigin();

  let slide: { id: string; eyebrow: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; image: string } | null = null;
  try {
    slide = await db.heroSlide.findFirst({
      where: { id: slideId, active: true },
      select: { id: true, eyebrow: true, titleAr: true, titleEn: true, bodyAr: true, bodyEn: true, image: true },
    });
  } catch {
    slide = null;
  }

  if (!slide) {
    return Response.redirect(`${origin}/`, 302);
  }

  const title = `${oneLine(slide.titleAr)} — LUBNÉL`;
  const body = oneLine(slide.bodyAr) || oneLine(slide.bodyEn);
  const desc = clamp(body || "اكتشفي عالم LUBNÉL — جمال يومي من القلب القاهرة، توصيل 2-5 أيام والدفع عند الاستلام", 160);
  // The slide artwork IS the campaign creative — serve it directly instead of
  // compositing a sharp card (hero images are already 1.75:1, close to 1.91:1).
  const ogImage = slide.image.startsWith("http") ? slide.image : `${origin}${slide.image}`;
  const appUrl = `${origin}/?s=${encodeURIComponent(slide.id)}`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: desc,
    url: `${origin}/s/${slide.id}`,
    isPartOf: { "@type": "WebSite", name: "LUBNÉL", url: `${origin}/` },
  };
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${esc(`${origin}/s/${slide.id}`)}"/>
<meta property="og:image" content="${esc(ogImage)}"/>
<meta property="og:image:alt" content="${esc(oneLine(slide.titleAr))}"/>
<meta property="og:site_name" content="LUBNÉL"/>
<meta property="og:locale" content="ar_EG"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${esc(ogImage)}"/>
<meta name="twitter:image:alt" content="${esc(oneLine(slide.titleAr))}"/>
<meta name="robots" content="noindex, follow"/>
<link rel="icon" href="/icon.svg" type="image/svg+xml"/>
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}"/>
<script type="application/ld+json">${ldJson}</script>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: grid; place-items: center; background: #11100f; color: #fdfcfa;
         font-family: Georgia, "Times New Roman", serif; text-align: center; }
  .mark { font-size: 30px; letter-spacing: .22em; }
  .mark span { color: #d9b8ae; }
  .dot { width: 9px; height: 9px; margin: 18px auto 0; border-radius: 50%;
         background: #d9b8ae; animation: pulse 1s ease-in-out infinite; }
  .pname { max-width: 560px; margin: 22px auto 0; padding: 0 24px;
           font: 600 20px/1.5 "Noto Kufi Arabic", Tahoma, sans-serif; color: #fdfcfa;
           overflow-wrap: anywhere; white-space: pre-line; }
  .note { margin-top: 10px; font: 13px/1.8 "Noto Kufi Arabic", Tahoma, sans-serif; color: #9d958f; }
  a { color: #d9b8ae; }
  @keyframes pulse { 50% { transform: scale(.55); opacity: .4; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
</style>
</head>
<body>
<main>
  <div class="mark">LUBNÉL<span>.</span></div>
  <div class="dot" aria-hidden="true"></div>
  <p class="pname">${esc(oneLine(slide.titleAr))}</p>
  <p class="note">${esc("جارٍ فتح العرض…")} · Opening campaign…</p>
  <noscript><a href="${esc(appUrl)}">${esc("افتحي العرض في المتجر")} / Open in store</a></noscript>
</main>
<script>try { location.replace(${JSON.stringify(appUrl)}); } catch (e) {}</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
