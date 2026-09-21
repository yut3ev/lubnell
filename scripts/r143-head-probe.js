#!/usr/bin/env node
// R143 — re-earning ladder rung 7 verification: the R118 share face (the
// browser-chrome head a WhatsApp/Facebook/X card renders from). Contract
// under test (digest: "R118: the share face — og:title/description/locale/
// type/site_name + twitter:card summary + link[rel=icon] → /icon.svg"):
//   1. The SERVED head carries every digest-named piece, through BOTH faces
//      (:3000 direct and the :81 gateway — the public face).
//   2. The icon link's target actually resolves: /icon.svg 200 image/svg+xml.
//   3. Verbatim SOURCE pins with comments STRIPPED (the R118 lesson: an
//      absence guard must not be fooled by a commented-out line; the R120
//      lesson bites both ways — code pins quote the file exactly).
//   4. Absence guards for the DEFERRED prepared places: og:url / metadataBase
//      upgrade stay owner-blocked with the path-URLs decision — their presence
//      would mean someone bundled an owner-blocked change.
//   5. Hygiene: GET-only by construction — no POSTs, no admin login, zero
//      audit rows. It reads the store exactly like a scraper does.
// AS-FOUND notes (recorded, not fixed):
//   - twitter:card serves "summary_large_image" — richer than the digest's
//     shorthand "summary"; the as-found live value is pinned.
//   - og:image resolves against the metadataBase default (localhost:3000 on
//     this stack) — the absolute-URL upgrade waits for the owner's domain.
//   - theme-color serves #11100f — R120's lost pin (the paper #faf7f4) is
//     rung (g)'s business, NOT this rung; recorded as its entry state.

const BASE = process.env.BASE || "http://localhost:3000";
const GATE = process.env.GATE || "http://localhost:81";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
}
async function get(url) {
  const r = await fetch(url, { redirect: "manual" });
  return { status: r.status, ct: r.headers.get("content-type") || "", text: await r.text() };
}
const META = (html, prop) => (html.match(new RegExp(`<meta[^>]*(?:property|name)="${prop}"[^>]*content="([^"]*)"`, "i")) || [])[1];
const LINK = (html, rel) => (html.match(new RegExp(`<link[^>]*rel="${rel}"[^>]*>`, "i")) || [])[0] || "";

(async () => {
  console.log(`== R143 head/share-face probe — origin ${BASE}, gateway ${GATE} ==`);

  for (const [face, url] of [["origin", BASE], ["gateway", GATE]]) {
    const page = await get(url + "/");
    check(`${face}: / serves 200 html`, page.status === 200 && page.ct.includes("text/html"), `${page.status} ${page.ct}`);
    check(`${face}: og:title (digest-named)`, META(page.text, "og:title") === "LUBNÉL — Premium Beauty, Cairo",
      META(page.text, "og:title"));
    check(`${face}: og:description (digest-named)`, (META(page.text, "og:description") || "").includes("Your beauty ritual, reimagined in Cairo"),
      META(page.text, "og:description"));
    check(`${face}: og:locale = ar_EG (digest-named)`, META(page.text, "og:locale") === "ar_EG", META(page.text, "og:locale"));
    check(`${face}: og:type = website (digest-named)`, META(page.text, "og:type") === "website", META(page.text, "og:type"));
    check(`${face}: og:site_name = LUBNÉL (digest-named)`, META(page.text, "og:site_name") === "LUBNÉL", META(page.text, "og:site_name"));
    check(`${face}: og:image present (as-found, metadataBase default)`, !!META(page.text, "og:image"), META(page.text, "og:image"));
    check(`${face}: twitter:card = summary_large_image (as-found value)`, META(page.text, "twitter:card") === "summary_large_image",
      META(page.text, "twitter:card"));
    check(`${face}: link[rel=icon] -> /icon.svg (digest-named)`, /rel="icon"[^>]*href="\/icon\.svg"/i.test(LINK(page.text, "icon")),
      LINK(page.text, "icon"));
    check(`${face}: og:url ABSENT (the owner-blocked prepared place stays unbundled)`, !META(page.text, "og:url"));
  }

  // The icon target resolves.
  const icon = await get(BASE + "/icon.svg");
  check("icon target: /icon.svg 200 image/svg+xml", icon.status === 200 && icon.ct.includes("image/svg+xml"),
    `${icon.status} ${icon.ct}`);
  const iconG = await get(GATE + "/icon.svg");
  check("icon target through the gateway: 200 image/svg+xml", iconG.status === 200 && iconG.ct.includes("image/svg+xml"),
    `${iconG.status} ${iconG.ct}`);

  // Verbatim source pins (comments stripped first — the R118 lesson; only
  // whole-line // comments are stripped so URLs inside strings survive).
  const fs = require("fs");
  const src = fs.readFileSync("src/app/layout.tsx", "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // JSX block comments
    .replace(/^\s*\/\/.*$/gm, "");        // whole-line comments only
  for (const [name, needle] of [
    ["metadataBase derivation (the as-found origin rule)", 'metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")'],
    ["og siteName", 'siteName: "LUBNÉL"'],
    ["og locale ar_EG", 'locale: "ar_EG"'],
    ["og type website", 'type: "website"'],
    ["twitter card (as-found value)", 'card: "summary_large_image"'],
    ["icon -> /icon.svg", 'url: "/icon.svg", type: "image/svg+xml"'],
  ]) {
    check(`source verbatim: ${name}`, src.includes(needle), needle);
  }
  const ogBlock = (src.match(/openGraph: \{[\s\S]*?\n  \},/) || [""])[0].replace(/images: \[[\s\S]*?\]/, "");
  check("source absence guard: openGraph carries no og:url property (owner-blocked)",
    ogBlock.length > 0 && !ogBlock.includes("url:"), ogBlock.slice(0, 80));

  console.log(`── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})();
