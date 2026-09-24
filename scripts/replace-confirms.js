// U84 — one-shot: replace every native window.confirm with the branded
// confirmDialog service + wire the import. Safe to re-run (skips if absent).
const fs = require('fs');

const IMP = "import { confirmDialog } from '@/components/ui/confirm-service';\n";
const DIR = 'src/';

const edits = [
  {
    file: DIR + 'components/admin/sections/orders.tsx',
    old: 'if (!window.confirm(`حذف الطلب ${orderNo(id)} نهائيًا؟`)) return;',
    neu: "if (!(await confirmDialog({ title: 'حذف الطلب', message: `سيتم حذف الطلب ${orderNo(id)} نهائيًا من السجل — لا يمكن الرجوع بعد التأكيد.`, confirmText: 'حذف نهائي', danger: true }))) return;",
  },
  {
    file: DIR + 'components/admin/sections/blog.tsx',
    old: 'if (!window.confirm(`حذف مقال "${p.titleAr}"؟ لا يمكن الرجوع.`)) return;',
    neu: "if (!(await confirmDialog({ title: 'حذف المقال', message: `حذف مقال \"${p.titleAr}\" نهائيًا — لا يمكن الرجوع.`, confirmText: 'حذف نهائي', danger: true }))) return;",
  },
  {
    file: DIR + 'components/admin/sections/categories.tsx',
    old: 'if (!window.confirm(`حذف قسم "${c.nameAr}"؟`)) return;',
    neu: "if (!(await confirmDialog({ title: 'حذف القسم', message: `حذف قسم \"${c.nameAr}\"؟`, confirmText: 'حذف القسم', danger: true }))) return;",
  },
  {
    file: DIR + 'components/admin/sections/coupons.tsx',
    old: 'if (!window.confirm(`حذف العرض ${c.code} نهائيًا؟`)) return;',
    neu: "if (!(await confirmDialog({ title: 'حذف العرض', message: `حذف العرض ${c.code} نهائيًا؟`, confirmText: 'حذف نهائي', danger: true }))) return;",
  },
  {
    file: DIR + 'components/admin/sections/homepage.tsx',
    old: "if (!window.confirm('حذف هذه الشريحة نهائيًا؟')) return;",
    neu: "if (!(await confirmDialog({ title: 'حذف الشريحة', message: 'حذف هذه الشريحة نهائيًا من الصفحة الرئيسية؟', confirmText: 'حذف نهائي', danger: true }))) return;",
  },
  {
    file: DIR + 'components/admin/sections/products.tsx',
    old: 'if (!window.confirm(`حذف "${p.nameAr}"؟`)) return;',
    neu: "if (!(await confirmDialog({ title: 'حذف المنتج', message: `حذف \"${p.nameAr}\" نهائيًا؟`, confirmText: 'حذف نهائي', danger: true }))) return;",
  },
  {
    file: DIR + 'components/admin/sections/pages.tsx',
    old: 'if (!window.confirm(builtIn\n      ? `حذف التعديلات على "${p.titleAr}"؟ ستعود الصفحة إلى النسخة الافتراضية تلقائيًا.`\n      : `حذف صفحة "${p.titleAr}"؟`))\n      return;',
    neu: "if (!(await confirmDialog({ title: 'حذف الصفحة', message: builtIn ? `حذف التعديلات على \"${p.titleAr}\"؟ ستعود الصفحة إلى النسخة الافتراضية تلقائيًا.` : `حذف صفحة \"${p.titleAr}\" نهائيًا؟`, confirmText: 'حذف', danger: true }))) return;",
  },
  {
    file: DIR + 'components/lubnel/admin/studio.tsx',
    old: 'if (!window.confirm(ar ? `حذف المنتج "${p.nameAr}" نهائيًا؟` : `Delete the product "${p.name}" permanently?`)) return;',
    neu: "if (!(await confirmDialog({ title: ar ? 'حذف المنتج' : 'Delete product', message: ar ? `حذف المنتج \"${p.nameAr}\" نهائيًا؟ لا يمكن الرجوع.` : `Delete \"${p.name}\" permanently? This cannot be undone.`, confirmText: ar ? 'حذف نهائي' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', danger: true }))) return;",
  },
  {
    file: DIR + 'components/lubnel/admin/studio.tsx',
    old: 'if (!window.confirm(ar ? `حذف فئة "${c.nameAr}"؟` : `Delete the "${c.name}" category?`)) return;',
    neu: "if (!(await confirmDialog({ title: ar ? 'حذف الفئة' : 'Delete category', message: ar ? `حذف فئة \"${c.nameAr}\"؟` : `Delete the \"${c.name}\" category?`, confirmText: ar ? 'حذف الفئة' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', danger: true }))) return;",
  },
  {
    file: DIR + 'components/lubnel/admin/studio.tsx',
    old: 'if (!window.confirm(ar ? `تعطيل ${u.displayName} نهائيًا؟` : `Disable ${u.displayName} permanently?`)) return;',
    neu: "if (!(await confirmDialog({ title: ar ? 'تعطيل العضو' : 'Disable member', message: ar ? `تعطيل ${u.displayName} نهائيًا؟ سيفقد الوصول إلى لوحة الإدارة.` : `Disable ${u.displayName} permanently? Panel access will be removed.`, confirmText: ar ? 'تعطيل' : 'Disable', cancelText: ar ? 'إلغاء' : 'Cancel', danger: true }))) return;",
  },
  {
    file: DIR + 'components/lubnel/storefront/views.tsx',
    old: 'if (!window.confirm(ar ? `هل تريدين إرسال طلب إلغاء للطلب ${order.orderNumber}؟ سيراجعه الفريق ويتواصل معكِ.` : `Request cancellation of ${order.orderNumber}? Our team will review and contact you.`)) return;',
    neu: "if (!(await confirmDialog({ title: ar ? 'طلب إلغاء الطلب' : 'Cancellation request', message: ar ? `إرسال طلب إلغاء للطلب ${order.orderNumber}؟ سيراجعه الفريق ويتواصل معكِ.` : `Request cancellation of ${order.orderNumber}? Our team will review and contact you.`, confirmText: ar ? 'إرسال الطلب' : 'Send request', cancelText: ar ? 'رجوع' : 'Back' }))) return;",
  },
];

let applied = 0;
let missed = 0;
for (const e of edits) {
  let src = fs.readFileSync(e.file, 'utf8');
  if (!src.includes(e.old)) {
    console.log('MISS:', e.file, '→', e.old.slice(0, 70));
    missed++;
    continue;
  }
  src = src.replace(e.old, e.neu);
  if (!src.includes('confirm-service')) {
    if (src.startsWith("'use client';")) src = src.replace("'use client';", "'use client';\n\n" + IMP);
    else src = IMP + src;
  }
  fs.writeFileSync(e.file, src);
  applied++;
  console.log('OK:', e.file);
}
console.log(`done — applied ${applied}, missed ${missed}`);
