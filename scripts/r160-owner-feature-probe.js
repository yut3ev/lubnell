// r160-owner-feature-probe.js — R160 owner round: end-to-end verification of the
// AI-result product editing feature. READ-ONLY by construction:
//   - mode "plan" everywhere (mutations can only dry-run)
//   - get_catalog is a read tool (safe in both modes)
// Writes: its own tolerated auth.login row + ai.planned audit rows. Nothing else.
// Run: node scripts/r160-owner-feature-probe.js
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const BASE = "http://127.0.0.1:3000";
let passCount = 0;
let failCount = 0;
const fails = [];

function check(name, ok, detail) {
  if (ok) { passCount += 1; console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failCount += 1; fails.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function j(path, opts = {}) {
  const raw = await fetch(`${BASE}${path}`, opts);
  const body = await raw.json().catch(() => null);
  return { status: raw.status, body, raw };
}

// 1x1 transparent PNG
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

(async () => {
  // 1. owner login (full permissions incl. ai.execute)
  let login = await j("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
  });
  if (login.status === 429) {
    const wait = ((login.body && login.body.retryAfter) || 15) + 1;
    await new Promise((r) => setTimeout(r, wait * 1000));
    login = await j("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "owner", password: "lubnel1234", verificationCode: "7777" }),
    });
  }
  check("owner login", login.status === 200, `status=${login.status}`);
  const cookie = (login.raw.headers.get("set-cookie") || "").split(";")[0];

  const post = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });

  // 2. THE OWNER'S REQUEST — "edit the published product straight from the AI
  //    result" needs the AI result to CARRY the products. Ask for the catalog
  //    and require the get_catalog action to bring the FULL products array.
  //    R168 hardening: the z-ai provider can emit a single turn with NO tool
  //    call (audit row #1436 class). Retry the SAME plan request ONCE on an
  //    empty executed[] — pins unchanged, only the provider flake absorbed.
  let catalog = null, catalogTook = 0, retried = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    catalog = await j("/api/admin/ai", post({
      message: "اعرضي لي قائمة منتجات المتجر بالأسعار",
      history: [],
      mode: "plan",
    }));
    catalogTook = Date.now() - t0;
    if (catalog.status === 200 && catalog.body && (catalog.body.executed || []).some((a) => a.tool === "get_catalog")) break;
    if (attempt === 1) { retried = true; await new Promise((r) => setTimeout(r, 2000)); }
  }
  if (retried) console.log("NOTE provider one-turn no-tool-call flake — absorbed by the probe's single retry (R168 class)");
  check("ai endpoint answers", catalog.status === 200, `status=${catalog.status} took=${catalogTook}ms provider=${catalog.body && catalog.body.provider}`);
  const catActions = (catalog.body && catalog.body.executed) || [];
  const cat = catActions.find((a) => a.tool === "get_catalog");
  check("get_catalog action present", !!cat, cat ? `ok=${cat.ok}` : "missing");
  const list = (cat && cat.products) || [];
  check("get_catalog carries the FULL products array (not just the first)", list.length >= 9, `products=${list.length}`);
  check("every catalog product is card-ready (slug+name+price+image+visible)",
    list.every((p) => p.slug && (p.nameAr || p.name) && typeof p.price === "number" && p.image && typeof p.visible === "boolean"),
    `${list.filter((p) => p.slug && (p.nameAr || p.name) && typeof p.price === "number" && p.image && typeof p.visible === "boolean").length}/${list.length}`);

  // 3. plan-mode safety: a price change MUST dry-run and MUST NOT touch the DB
  const before = await db.storeProduct.findFirst({ where: { nameAr: { contains: "بوكس الجامعة" } }, select: { id: true, price: true } });
  const change = await j("/api/admin/ai", post({
    message: "عدّلي سعر بوكس الجامعة إلى 99999",
    history: [],
    mode: "plan",
  }));
  const chActions = (change.body && change.body.executed) || [];
  const upd = chActions.find((a) => a.tool === "update_product");
  check("update_product planned as DRY-RUN", !!upd && upd.dryRun === true && upd.ok === true, upd ? `dryRun=${upd.dryRun} summary=${(upd.summary || "").slice(0, 60)}` : "missing");
  const after = before ? await db.storeProduct.findUnique({ where: { id: before.id }, select: { price: true } }) : null;
  check("plan mode wrote NOTHING to the product", !!before && !!after && before.price === after.price && after.price !== 99999, `price=${after ? after.price : "?"}`);

  // 4. plan-mode image replacement (R160's replaceImages path) — dry preview only
  const img = await j("/api/admin/ai", post({
    message: "غيّري صورة بوكس الجامعة بالصورة المرفقة",
    images: [{ url: TINY_PNG, mimeType: "image/png", name: "test.png" }],
    history: [],
    mode: "plan",
  }));
  const imgActions = (img.body && img.body.executed) || [];
  const imgUpd = imgActions.find((a) => a.tool === "update_product" && a.dryRun);
  check("replaceImages planned (dry) with the R160 image placeholder", !!imgUpd && JSON.stringify(imgUpd.summary || "").includes("الصور"), imgUpd ? `summary=${(imgUpd.summary || "").slice(0, 70)}` : "missing");

  // 5. the book must be untouched
  const products = await db.storeProduct.count();
  const resolveRows = await db.auditLog.count({ where: { action: { contains: "resolve" } } });
  check("BOOK intact after the whole run", products === 9 && resolveRows === 0, `products=${products} resolve=${resolveRows}`);

  console.log(`── ${passCount} PASS / ${failCount} FAIL ──`);
  if (fails.length) { console.log(`FAILED: ${fails.join(" | ")}`); process.exit(1); }
  await db.$disconnect();
})().catch(async (e) => { console.error("PROBE-ERROR", e); process.exit(1); });
