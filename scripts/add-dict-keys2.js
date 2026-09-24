const fs = require("fs");
const file = "/home/z/my-project/src/lib/admin-i18n.ts";
let src = fs.readFileSync(file, "utf8");
const additions = {
  "صورة": "Photo",
  " · مميّز": " · featured",
  "الخصم": "Discount",
  "تحت 100 ج.م": "Under EGP 100",
  "خصم 20٪ للطلبات فوق 500": "20% off orders over 500",
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
