#!/usr/bin/env node
// Append missing dict keys discovered during the component edit pass (idempotent).
const fs = require("fs");
const file = "/home/z/my-project/src/lib/admin-i18n.ts";
let src = fs.readFileSync(file, "utf8");
const additions = {
  "صورة من تقييم": "Photo from a review by",
  "صورة من": "Photo from",
  "تكبير صورة التقييم من": "Zoom the review photo by",
  "رسالة واتساب جاهزة حسب حالة الطلب": "WhatsApp message pre-filled for the order status",
  "تسلسل هرمي كامل: Owner، Admin، Moderator، Staff — بصلاحيات دقيقة وجلسات مشفرة.": "A full hierarchy: Owner, Admin, Moderator, Staff — with fine-grained permissions and encrypted sessions.",
  "الجلسات النشطة الآن:": "Active sessions now:",
  "جارٍ التحقق من جلسة الإدارة…": "Verifying the admin session…",
  "عدّلي الطلب السابق: ": "Edit the previous request: ",
};
const marker = "// ── core translation ──";
let added = 0;
for (const [k, v] of Object.entries(additions)) {
  const needle = JSON.stringify(k) + ":";
  if (!src.includes(needle)) {
    src = src.replace(marker, `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n\n${marker}`);
    added++;
  }
}
fs.writeFileSync(file, src);
console.log(`added ${added} keys`);
