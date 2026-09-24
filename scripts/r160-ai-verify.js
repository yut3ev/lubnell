// r160-ai-verify.js — R160 owner-build end-to-end verification (API level).
// Proves the owner's exact scenario on the live server: AI plan guard, AI
// direct execution (add product), the new catalog-cards payload, AI delete —
// and restores the book (products back to 9). Read-only except the two
// declared round-trip mutations, which cancel each other out.
const BASE = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
};

async function main() {
  // 1. login
  const loginRes = await fetch(`${BASE}/api/admin/auth`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", username: "owner", password: "lubnel1234", verificationCode: "7777" }),
  });
  const setCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie().join("; ") : "";
  const cookie = (setCookie.match(/lubnel_admin_session=[^;]+/) || [])[0];
  ok(loginRes.ok && !!cookie, "owner login", loginRes.status);
  if (!cookie) return;
  const H = { "Content-Type": "application/json", cookie };

  const agent = async (message, mode) => {
    const res = await fetch(`${BASE}/api/admin/ai`, {
      method: "POST", headers: H,
      body: JSON.stringify({ message, history: [], mode, images: [] }),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  // 2. plan mode = dry run, nothing changes
  const plan = await agent("أضيفي منتج اسمه فحص R160 — القسم Makeup — السعر 111", "plan");
  const planAdd = (plan.data.executed || []).find(a => a.tool === "add_product");
  ok(plan.status === 200 && !!planAdd, "plan-mode agent responds", `provider=${plan.data.provider} status=${plan.status}`);
  ok(planAdd && planAdd.dryRun === true && planAdd.ok === true, "plan-mode add is a DRY RUN — nothing written");

  // 3. execute mode: real add
  const add = await agent("أضيفي منتج اسمه فحص R160 — القسم Makeup — السعر 111", "execute");
  const addAction = (add.data.executed || []).find(a => a.tool === "add_product");
  ok(add.status === 200 && addAction && addAction.ok && !addAction.dryRun, "execute-mode add RAN live", addAction && addAction.summary);
  const slug = addAction && addAction.product && addAction.product.slug;
  ok(!!slug, "add result card carries the product ref", slug || "none");

  // 4. catalog search returns the products LIST (R160 capability)
  const cat = await agent("دوريلي على منتجات فحص R160", "execute");
  const catAction = (cat.data.executed || []).find(a => a.tool === "get_catalog");
  ok(catAction && Array.isArray(catAction.products) && catAction.products.some(p => p.slug === slug),
    "get_catalog returns the full products list", catAction && `${(catAction.products || []).length} refs`);

  // 5. execute-mode delete: the round-trip closes
  const del = await agent(`احذفي منتج فحص R160`, "execute");
  const delAction = (del.data.executed || []).find(a => a.tool === "delete_product");
  ok(delAction && delAction.ok && !delAction.dryRun, "execute-mode delete RAN live", delAction && delAction.summary);

  // 6. book restored: products back to 9
  const boot = await (await fetch(`${BASE}/api/store/bootstrap`)).json();
  const count = (boot.products || []).length;
  ok(count === 9, "book restored — universe back to 9", `products=${count}`);

  console.log(`\nVERDICT: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error("VERIFY-ERROR", e.message); process.exit(1); });
