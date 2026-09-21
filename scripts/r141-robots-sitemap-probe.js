#!/usr/bin/env node
// R141 — ladder rung 5: R83 re-earned. robots.txt + sitemap.xml origin
// dynamism + the LIVE catalog sitemap, pinned through BOTH faces:
//   :3000 the direct origin (probe path)
//   :81   the Caddy gateway (the PUBLIC face every real visitor uses)
// Contract re-derived from the recovery digest ("robots.txt + sitemap.xml
// originOf(req) dynamic; sitemap 10 urls") + the R121 gateway pins
// ("the sitemap's 10 urls through the gateway", both Host variants):
//   1. robots.txt: 200 text/plain, User-agent * / Allow / / Disallow /api/,
//      Sitemap line carries the REQUEST's origin.
//   2. sitemap.xml: 200 xml, EXACTLY the set { base } ∪ { /p/<slug> for every
//      VISIBLE product } — the same `visible: true` filter the bootstrap feed
//      and the R25 share routes serve, so the sitemap can never list a 404.
//      At the R65 universe (9 products) that is exactly 10 urls — the digest
//      pin. A catalog change is an owner move: the probe fails loudly and the
//      next round re-pins (same convention as the book anchors).
//   3. crawl-the-list: every listed /p/<slug> answers 200 — no dead urls.
//   4. host-follow proven on three paths: direct localhost, direct
//      127.0.0.1 (as-found byte pin — see the proto note), and through the
//      gateway with BOTH host variants (Caddy forwards Host + XFP).
//   5. Hygiene: this probe is GET-only by construction — no POSTs, no admin
//      login, zero audit rows. It reads the store exactly like a crawler.
//
// AS-FOUND TRADE (recorded, not fixed — shared R25 vocabulary): a direct
// request whose Host is not "localhost*" and carries no x-forwarded-proto
// (i.e. http://127.0.0.1:3000 from this probe) renders https:// in the
// derived origin — the shared heuristic in robots.ts / sitemap.ts /
// shareOrigin guesses https for non-localhost hosts. Real visitors always
// arrive through :81 where Caddy sends x-forwarded-proto: http, so the
// heuristic is correct on the public path; the https guess is reachable
// only by direct-origin probes. Pinned byte-exactly as-found; a stricter
// proto policy is a future decision, not this rung.

const ORIGIN = process.env.BASE || "http://localhost:3000";
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

(async () => {
  console.log(`== R141 robots/sitemap probe — origin ${ORIGIN}, gateway ${GATE} ==`);

  // 0. The oracle: the DB the sitemap itself reads (read-only), cross-checked
  // against the storefront's bootstrap feed. NOTE: bootstrap deliberately
  // strips `slug` from its product JSON (productFromRow vocabulary), so the
  // slug set MUST come from the DB — the same source sitemap.ts queries.
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: "file:" + process.cwd() + "/db/custom.db" } } });
  const rows = await db.storeProduct.findMany({ where: { visible: true }, select: { slug: true }, orderBy: { slug: "asc" } });
  await db.$disconnect();
  const slugs = rows.map((r) => r.slug).sort();
  check("db oracle: 9 visible products (universe 9)", slugs.length === 9,
    `got ${slugs.length}: ${slugs.join(",")}`);
  const expected = slugs.map((s) => `${ORIGIN}/p/${s}`).sort();

  // 0b. The storefront feed is up and serving the same catalog size.
  const boot = await get(ORIGIN + "/api/store/bootstrap");
  let bootCount = -1;
  try { bootCount = (JSON.parse(boot.text).products || []).length; } catch {}
  check("bootstrap feed reachable, same 9-product catalog",
    boot.status === 200 && bootCount === slugs.length, `boot=${bootCount} db=${slugs.length}`);

  // A. robots.txt through the direct origin.
  const robots = await get(ORIGIN + "/robots.txt");
  check("robots.txt 200 text/plain", robots.status === 200 && robots.ct.includes("text/plain"),
    `${robots.status} ${robots.ct}`);
  check("robots rules: User-Agent * / Allow / / Disallow /api/",
    /User-[Aa]gent:\s*\*/.test(robots.text) && /Allow:\s*\/\s*$/m.test(robots.text)
      && /Disallow:\s*\/api\/\s*$/m.test(robots.text));
  check("robots Sitemap line carries the request origin (localhost:3000)",
    new RegExp(`Sitemap:\\s*${ORIGIN.replace(/[:/]/g, "\\$&")}\\/sitemap\\.xml`).test(robots.text),
    robots.text.split("\n").find((l) => /Sitemap/i.test(l)) || "no Sitemap line");

  // B. sitemap.xml through the direct origin — the LIVE catalog contract.
  const sm = await get(ORIGIN + "/sitemap.xml");
  check("sitemap.xml 200 xml content-type", sm.status === 200 && sm.ct.includes("xml"),
    `${sm.status} ${sm.ct}`);
  const locs = [...sm.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  check("sitemap url count == 10 (digest pin at universe 9)", locs.length === 10,
    `got ${locs.length}`);
  check("base url / present exactly once", locs.filter((l) => l === ORIGIN + "/").length === 1);
  const prodLocs = locs.filter((l) => l !== ORIGIN + "/").sort();
  check("product locs == bootstrap slugs EXACTLY (same visible filter, zero 404s)",
    JSON.stringify(prodLocs) === JSON.stringify(expected),
    `sitemap=${prodLocs.length} oracle=${expected.length}` +
      (JSON.stringify(prodLocs) !== JSON.stringify(expected)
        ? ` diff: ${prodLocs.filter((x) => !expected.includes(x))} / ${expected.filter((x) => !prodLocs.includes(x))}` : ""));
  check("no hash fragments in any loc (SPA fragments are not indexable)",
    locs.every((l) => !l.includes("#")));
  check("every loc carries the request origin", locs.every((l) => l.startsWith(ORIGIN + "/")));

  // C. crawl-the-list: no dead urls listed.
  const crawls = [];
  for (const s of slugs) crawls.push((await get(`${ORIGIN}/p/${s}`)).status);
  check(`crawl-the-list: all 9 /p/<slug> answer 200 (${crawls.filter((c) => c === 200).length}/9)`,
    crawls.length === 9 && crawls.every((c) => c === 200), crawls.join(","));

  // D. host-follow, direct 127.0.0.1 (as-found byte pin — see header note).
  const r127 = await get("http://127.0.0.1:3000/robots.txt");
  check("host-follow direct: 127.0.0.1 request renders 127.0.0.1 origin (as-found https guess)",
    /Sitemap:\s*https?:\/\/127\.0\.0\.1:3000\/sitemap\.xml/.test(r127.text),
    r127.text.split("\n").find((l) => /Sitemap/i.test(l)) || "no Sitemap line");

  // E. The gateway face (:81) — both host variants, the R121 pin re-pointed.
  const rg1 = await get(GATE + "/robots.txt");
  check("gateway robots.txt 200 + Sitemap line == localhost:81",
    rg1.status === 200 && /Sitemap:\s*http:\/\/localhost:81\/sitemap\.xml/.test(rg1.text),
    rg1.text.split("\n").find((l) => /Sitemap/i.test(l)) || "no Sitemap line");
  const rg2 = await get("http://127.0.0.1:81/robots.txt");
  check("gateway host variant: 127.0.0.1:81 request renders 127.0.0.1:81 origin",
    rg2.status === 200 && /Sitemap:\s*http:\/\/127\.0\.0\.1:81\/sitemap\.xml/.test(rg2.text),
    rg2.text.split("\n").find((l) => /Sitemap/i.test(l)) || "no Sitemap line");
  for (const host of ["localhost:81", "127.0.0.1:81"]) {
    const sg = await get(`http://${host}/sitemap.xml`);
    const glocs = [...sg.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    check(`gateway sitemap (${host}): 200 xml, 10 urls, every loc == http://${host} origin`,
      sg.status === 200 && sg.ct.includes("xml") && glocs.length === 10
        && glocs.every((l) => l.startsWith(`http://${host}/`)),
      `${sg.status} ${glocs.length} locs`);
  }

  console.log(`── ${pass} PASS / ${fail} FAIL ──`);
  process.exit(fail ? 1 : 0);
})();
