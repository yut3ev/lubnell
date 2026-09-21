#!/usr/bin/env node
// R144 — the R119 contract re-earned probe: the branded server-side 404.
// The digest (recovery appendix, line 2979): "R119: the branded 404 —
// ضاعتِ من الخريطة." R121's gateway sweep pinned "404 status + Arabic voice".
// Before R144 the restored tree served Next's DEFAULT English 404 inside the
// Arabic shell; src/app/not-found.tsx now carries the quiet branded sibling
// of the R62 in-app NotFoundView (same nf-* vocabulary, no shelf, NO wa.me —
// the real WhatsApp number is still an owner wait, so the deferred button
// stays deferred; absence is pinned, not assumed).
// GET-only by construction: no login, no cookies, zero audit rows, zero
// writes — safe to re-run on any state (the r139 re-run-safety lesson).
// r143 tool lessons baked in: comments are stripped as whole-line "//" or
// block comments only (never eat "http://" inside live code), and absence
// guards anchor on their own block (no tripping on a sibling's url:).
const BASE = process.env.BASE || "http://localhost:3000";
const GATE = process.env.GATE || "http://localhost:81";
const LOST = "/this-path-never-existed-r144";
const DEEP = "/a/deeper/lost/path-r144";

let n = 0, fail = 0;
function pin(name, ok, detail) {
  n++;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${String(n).padStart(2, "0")} — ${name}${detail ? ` :: ${detail}` : ""}`);
}

function stripComments(src) {
  // whole-block comments + whole-line // only — the r143 URL-eating fix
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter(l => !l.trim().startsWith("//"))
    .join("\n");
}

(async () => {
  const g = async (base, p) => {
    const r = await fetch(base + p, { redirect: "manual" });
    return { status: r.status, body: await r.text() };
  };

  // ---- the origin face (:3000) ----
  const a = await g(BASE, LOST);
  pin("origin unknown path -> 404", a.status === 404, `status=${a.status}`);
  pin("Arabic voice headline served", a.body.includes("ضاعتِ من الخريطة"), "the digest phrase, verbatim");
  pin("branded markup (nf-digits + nf-hero)", a.body.includes("nf-digits") && a.body.includes("nf-hero"), "the R62 vocabulary, reused");
  pin("default English 404 GONE", !a.body.includes("This page could not be found"), "Next's stock page replaced");
  pin("shell stays Arabic-first (lang=ar dir=rtl)", a.body.includes('<html lang="ar" dir="rtl"'), "layout carries through");
  pin("custom Arabic title served", /<title>[^<]*ضاعتِ[^<]*<\/title>/.test(a.body), "metadata export, not the stock title");
  pin("noindex guard stays", a.body.includes('name="robots" content="noindex"'), "Next's not-found robots meta");
  const themeCount = (a.body.match(/name="theme-color"/g) || []).length;
  pin("theme-color exactly once", themeCount === 1, `count=${themeCount}`);
  pin("NO wa.me on the 404 face", !a.body.includes("wa.me"), "the R119 deferred button stays owner-blocked");
  pin("honest ways back (shop + home)", a.body.includes('href="/#/shop"') && a.body.includes('href="/"'), "both server-real paths");
  pin("icon link rides the 404 head", a.body.includes('href="/icon.svg"'), "chrome consistency through layout");

  // ---- depth + the gateway face (:81) ----
  const d = await g(BASE, DEEP);
  pin("deep unknown path -> 404 + same voice", d.status === 404 && d.body.includes("ضاعتِ من الخريطة"), `status=${d.status}`);
  const b = await g(GATE, LOST);
  pin("gateway unknown path -> 404", b.status === 404, `status=${b.status}`);
  pin("gateway carries the Arabic voice", b.body.includes("ضاعتِ من الخريطة"), "Caddy passes the branded page through");
  pin("gateway 404 carries NO wa.me", !b.body.includes("wa.me"), "absence holds through :81");

  // ---- neighbours unharmed ----
  const api = await fetch(BASE + "/api/definitely-not-a-route-r144");
  pin("unknown /api stays 404 (status only)", api.status === 404, `status=${api.status}`);
  const home = await fetch(BASE + "/");
  pin("home unaffected (200)", home.status === 200, `status=${home.status}`);

  // ---- verbatim source pins ----
  const fs = require("fs");
  const srcPath = "src/app/not-found.tsx";
  let src = "";
  try { src = fs.readFileSync(srcPath, "utf8"); } catch {}
  const s = stripComments(src);
  pin("not-found.tsx exists at src/app", src.length > 0, srcPath);
  pin("source carries the digest phrase", s.includes("ضاعتِ من الخريطة"), "verbatim in the JSX headline");
  pin("source ways back verbatim", s.includes('href="/#/shop"') && s.includes('href="/"'), "both links pinned in source");
  pin("source ships NO wa.me (guard)", !s.includes("wa.me"), "nobody bundles the owner-blocked button");
  let css = "";
  try { css = fs.readFileSync("src/app/globals.css", "utf8"); } catch {}
  pin("nf-* vocabulary reused, not duplicated", css.includes(".nf-digits") && css.includes(".nf-hero"), "zero new CSS this rung");

  console.log(`\n${n - fail}/${n} PASS${fail ? ` — ${fail} FAILED` : " — the branded 404 holds on both faces"}`);
  process.exit(fail ? 1 : 0);
})();
