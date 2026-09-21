#!/usr/bin/env node
// R145 — the R120 contract re-earned probe: the browser chrome & transport face.
// Digest (recovery appendix, line 2980): themeColor = the topbar's own paper,
// single value by honesty; poweredByHeader: false; headers() on /:path* —
// X-Frame-Options DENY (a framed admin rides a localStorage session the owner
// cannot see), X-Content-Type-Options nosniff (global), Referrer-Policy
// strict-origin-when-cross-origin (the wa.me handoff declares only the origin).
// RE-DERIVED for this era: --paper is #f8f6f2 here (the lost pin's #faf7f4 was
// R120-era vocabulary — the R136 lesson: derive from the era's OWN source).
// As-found before this rung: X-Powered-By present, ZERO trio headers on either
// face, theme-color #11100f (--ink) against a paper topbar — chrome and topbar
// disagreed.
// GET-only by construction: no login, no cookies, zero audit rows, re-run-safe
// on any state (the r139 lesson). r143 tool lessons baked in: whole-line
// comment stripping only; absence guards on their own block.
const BASE = process.env.BASE || "http://localhost:3000";
const GATE = process.env.GATE || "http://localhost:81";
const LOST = "/this-path-never-existed-r145";

let n = 0, fail = 0;
function pin(name, ok, detail) {
  n++;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${String(n).padStart(2, "0")} — ${name}${detail ? ` :: ${detail}` : ""}`);
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter(l => !l.trim().startsWith("//"))
    .join("\n");
}

const TRIO = [
  ["x-frame-options", "DENY"],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
];

(async () => {
  const head = async (base, p) => {
    const r = await fetch(base + p, { redirect: "manual" });
    return { status: r.status, headers: r.headers, body: p === "/" ? await r.text() : null };
  };

  // ---- origin face (:3000) ----
  const a = await head(BASE, "/");
  for (const [k, v] of TRIO) pin(`origin / -> ${k}: ${v}`, a.headers.get(k) === v, `served=${a.headers.get(k) || "ABSENT"}`);
  pin("origin / -> X-Powered-By ABSENT", !a.headers.has("x-powered-by"), a.headers.get("x-powered-by") || "gone");
  const lostA = await head(BASE, LOST);
  pin("origin lost-path -> trio rides /:path*", TRIO.every(([k, v]) => lostA.headers.get(k) === v) && lostA.status === 404, `status=${lostA.status}`);

  // ---- gateway face (:81 — Caddy adds nothing, strips nothing of ours) ----
  const b = await head(GATE, "/");
  pin("gateway / -> trio passes through", TRIO.every(([k, v]) => b.headers.get(k) === v), TRIO.map(([k]) => `${k}=${b.headers.get(k) || "ABSENT"}`).join(" "));
  pin("gateway / -> X-Powered-By ABSENT", !b.headers.has("x-powered-by"), b.headers.get("x-powered-by") || "gone");
  const lostB = await head(GATE, LOST);
  pin("gateway lost-path -> trio present", TRIO.every(([k, v]) => lostB.headers.get(k) === v) && lostB.status === 404, `status=${lostB.status}`);

  // ---- the chrome half ----
  pin("theme-color wears the era's paper", (a.body.match(/<meta name="theme-color" content="#f8f6f2"/g) || []).length === 1, "topbar's own --paper #f8f6f2, once");
  pin("the old ink chrome retired", !a.body.includes('content="#11100f"'), "#11100f gone from the head");
  pin("color-scheme stays an honest-wait", !a.body.includes('name="color-scheme"'), "forced-dark not verifiable headless — absent, not fake");
  const icon = await fetch(BASE + "/icon.svg");
  pin("static unaffected + nosniff on assets", icon.status === 200 && icon.headers.get("x-content-type-options") === "nosniff", `icon.svg ${icon.status}`);
  pin("home body intact", a.body.includes("LUBNÉL — Premium Beauty, Cairo") && a.status === 200, "page untouched by the transport change");

  // ---- verbatim source pins ----
  const fs = require("fs");
  const lay = stripComments(fs.readFileSync("src/app/layout.tsx", "utf8"));
  pin("source: themeColor = #f8f6f2 verbatim", lay.includes('themeColor: "#f8f6f2"'), "layout.tsx viewport export");
  pin("source: no ink chrome in viewport", !lay.includes("#11100f"), "the as-found value fully retired");
  const cfg = stripComments(fs.readFileSync("next.config.ts", "utf8"));
  pin("source: poweredByHeader: false", cfg.includes("poweredByHeader: false"), "next.config.ts");
  pin("source: the trio verbatim", cfg.includes('"DENY"') && cfg.includes('"nosniff"') && cfg.includes('"strict-origin-when-cross-origin"'), "all three key/value pairs");
  pin("source: CSP/HMAC stay unbundled (guard)", !cfg.includes("Content-Security-Policy") && !cfg.includes("hmac"), "owner-blocked prepared places stay absent");

  // ---- as-found support ----
  pin("apple-touch-icon exists as-found", fs.existsSync("public/icons/apple-touch-icon.png"), "the R120 deferral was about creating it — here it ships");

  console.log(`\n${n - fail}/${n} PASS${fail ? ` — ${fail} FAILED` : " — the chrome & transport face holds on both faces"}`);
  process.exit(fail ? 1 : 0);
})();
