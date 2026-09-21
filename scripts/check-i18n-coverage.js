#!/usr/bin/env node
// Verify admin-i18n dictionary coverage: every Arabic UI string in the three
// admin files should exist as a key in ADMIN_EN (exact match) or be whitelisted.
const fs = require("fs");
const path = "/home/z/my-project/src";
const files = [
  "components/lubnel/admin/studio.tsx",
  "components/lubnel/admin/ai-section.tsx",
  "components/lubnel/admin/access.tsx",
];
// 1) extract dict keys by requiring via regex on the source (no TS runtime here)
const i18nSrc = fs.readFileSync(path + "/lib/admin-i18n.tsx", "utf8");
const dictBlock = i18nSrc.slice(i18nSrc.indexOf("export const ADMIN_EN"), i18nSrc.indexOf("// ── core translation"));
const dictKeys = new Set();
const keyRe = /\n\s*"((?:[^"\\]|\\.)*)":/g;
let m;
while ((m = keyRe.exec(dictBlock))) dictKeys.add(m[1].replace(/\\"/g, '"'));
// detect duplicate keys (last-wins is fine, but flag for awareness)
const seen = new Map(); const dupes = [];
const dupeRe = /\n {2}"((?:[^"\\]|\\.)*)":/g;
while ((m = dupeRe.exec(dictBlock))) {
  const k = m[1];
  if (seen.has(k)) dupes.push(k); else seen.set(k, true);
}
// 2) extract AR strings from tsx files (double-quoted literals containing Arabic; backtick excluded so template/JSX spans don't cross)
const arRe = /"((?:[^"\\\x60]|\\.)*[\u0600-\u06FF](?:[^"\\\x60]|\\.)*)"/g;
const found = new Map();
for (const f of files) {
  const src = fs.readFileSync(path + "/" + f, "utf8");
  let mm;
  while ((mm = arRe.exec(src))) {
    const s = mm[1];
    if (!found.has(s)) found.set(s, f);
  }
}
// 3) whitelist: dynamic fragments, prompts sent to AI, customer-facing WA copy, data strings
const whitelist = new Set([
  // WA templates (customer-facing Arabic — intentionally untranslated)
  "أهلًا ${o.customerName} 🌸\\nاستلمنا طلبكِ ${o.orderNumber} بنجاح، وفريقنا يراجعه الآن — سنؤكد لكِ قريبًا.\\n— فريق LUBNÉL",
  // quick-action prompts (functional AR prompts to the AI agent; display is translated)
  "أضيفي منتج: اسم المنتج … — القسم … — السعر …",
  "عدّلي سعر … إلى … جنيه",
  "خفي منتج … / انشري منتج …",
  "فين طلبات الرقم 01…؟",
  "افتحي تفاصيل الطلب الأخير",
  "إيه حالة المتجر النهارده؟",
  "اعملي كوبون خصم 15٪ لمدة 3 أيام بكود …",
  "غيّري حالة الطلب … إلى تم الشحن",
  "خفي كل المنتجات تحت 90 جنيه",
  // AI greeting seeds are handled with in-place branches
]);
// long template strings that are branch-handled in code (start with these prefixes)
const branchPrefixes = ["أهلًا", "🛍️", "✕ طلب", "★ تقييم", "↺ ", "صفحة ", "صباح الخير يا $", "تم رفع $", "تم نشر «", "تم إخفاء «", "حذف تقييم $", "حذف المنتج «", "قبول إلغاء الطلب $", "رفض طلب الإلغاء", "تم تحديث حالة $", "تم إلغاء $", "تم استمرار $", "إليكِ لمحة", "تعطيل $", `حذف فئة "`, "تكبير صورة", "صورة من", "صورة مشاركتها", "أهلًا 🌸", "عدّلي الطلب السابق: ", "تحديث جماعي ("];
let missing = 0;
for (const [s, f] of found) {
  if (dictKeys.has(s) || whitelist.has(s)) continue;
  if (branchPrefixes.some(p => s.startsWith(p))) continue;
  // strings that are pure dynamic templates with ${} inside are branch-handled
  if (s.includes("${")) continue;
  missing++;
  console.log(`MISSING [${f}]: ${s.slice(0, 110)}`);
}
console.log(`\ndict keys: ${dictKeys.size} | AR strings found: ${found.size} | missing: ${missing}`);
if (dupes.length) console.log("duplicate dict keys (last-wins):", [...new Set(dupes)].join(" | "));
