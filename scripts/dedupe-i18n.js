#!/usr/bin/env node
// Dedupe ADMIN_EN dict keys (keep deliberate override values), then print result.
const fs = require("fs");
const file = "/home/z/my-project/src/lib/admin-i18n.ts";
const src = fs.readFileSync(file, "utf8");
const start = src.indexOf("export const ADMIN_EN");
const openBrace = src.indexOf("{", start);
// find matching closing brace of the object literal
let depth = 0, end = -1;
for (let i = openBrace; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
}
const block = src.slice(openBrace + 1, end);
// parse entries: "key": "value",
const entryRe = /"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g;
const map = new Map();
let m;
while ((m = entryRe.exec(block))) map.set(m[1], m[2]);
// deliberate overrides where the LAST value was wrong for all contexts
const overrides = {
  "منشور": "Published",
  "إلغاء": "Cancel",
  "قبول": "Accept",
  "رفض": "Reject",
  "تعديل منتج": "Product updated",
};
for (const [k, v] of Object.entries(overrides)) if (map.has(k)) map.set(k, v);
// extra missing entries discovered by coverage check
const extras = {
  "تم إخفاء التقييم من صفحة المنتج": "Review hidden from the product page",
  "تم تثبيت التقييم في الصفحة الرئيسية ✨": "Review featured on the homepage ✨",
  "تم إزالة التقييم من الصفحة الرئيسية": "Review removed from the homepage",
  "تم حذف التقييم نهائيًا": "Review deleted permanently",
  "إشعار العميلة": "Notify the customer",
  "اكتبي أمرًا… مثال: عدّلي سعر بوكس الجامعة إلى 180 وانشريه": "Type a command… e.g. set the University Box price to 180 and publish it",
  "اكتبي طلبكِ لمعاينته أولًا…": "Type your request to preview it first…",
  "وضع التنفيذ المباشر: كل أمر يُسجَّل في سجل التدقيق باسمكِ — ولا تصل مفاتيح النظام إلى المساعد أبدًا.": "Direct execution mode: every command is logged in the audit trail under your name — system keys never reach the agent.",
  "وضع المعاينة: لا يتغير شيء في المتجر حتى تختاري «تنفيذ الآن».": "Preview mode: nothing changes in the store until you choose “Execute now”.",
  "ج.م": "EGP",
  "الطلبات": "Orders",
  "من قاعدة البيانات": "from the database",
};
for (const [k, v] of Object.entries(extras)) map.set(k, v);
// emit sorted-by-first-seen (stable) dict body
const oldOrder = [];
{
  const re2 = /"((?:[^"\\]|\\.)*)":/g;
  while ((m = re2.exec(block))) oldOrder.push(m[1]);
}
const seen = new Set(); const order = [];
for (const k of oldOrder) if (!seen.has(k)) { seen.add(k); order.push(k); }
for (const k of Object.keys(extras)) if (!seen.has(k)) { seen.add(k); order.push(k); }
let body = "";
for (const k of order) {
  const v = map.get(k);
  body += `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`;
}
const out = src.slice(0, openBrace + 1) + "\n" + body + src.slice(end);
fs.writeFileSync(file, out);
console.log(`dict rebuilt: ${order.length} unique keys`);
