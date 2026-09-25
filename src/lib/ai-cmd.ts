// U86-AI-CMD — local Arabic command interpreter for the ADMIN assistant (لُو).
// Parses her text into a REAL admin action and executes it with permission
// checks — no external model needed, works on every host (Vercel included).
// Supported: add product, price edit, stock add/set, product delete,
// maintenance close/open, and grounded catalog/order queries.

import { db } from '@/lib/db';
import { writeAudit } from '@/lib/admin-auth';
import { invalidateCatalog, invalidateSettings } from '@/lib/settings-cache';

export type CmdToolResult = { tool: string; ok: boolean; summary?: string };
export type CmdOut = { reply: string; executed: CmdToolResult[] };

const AR_DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

function latinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGIT_MAP[d] ?? d);
}

function firstNumber(s: string): number | null {
  const m = latinDigits(s).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const normAr = (s: string) =>
  (s || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();

async function findProductByFragment(fragment: string) {
  const q = normAr(fragment);
  if (!q) return null;
  const products = await db.product.findMany({
    select: { id: true, slug: true, nameAr: true, nameEn: true, price: true, stock: true, compareAt: true },
  });
  const norm = (s: string) => normAr(s || '');
  return (
    products.find((p) => norm(p.nameAr) === q) ||
    products.find((p) => norm(p.nameEn) === q) ||
    products.find((p) => norm(p.nameAr).includes(q)) ||
    products.find((p) => q.includes(norm(p.nameAr))) ||
    products.find((p) => norm(p.nameEn).includes(q)) ||
    null
  );
}

export async function tryLocalAdminCommand(opts: {
  message: string;
  admin?: { id: number | string; username: string };
  permissions?: string[];
}): Promise<CmdOut | null> {
  const raw = latinDigits(opts.message.trim());
  if (!raw) return null;
  const perms = opts.permissions || [];
  const has = (p: string) => !perms.length || perms.includes(p);
  const executed: CmdToolResult[] = [];
  const deny = (p: string): CmdOut => ({
    reply: `مفيش عندك صلاحية «${p}» — اطلبيها من مديرة المتجر من صفحة الفريق.`,
    executed,
  });

  // ── 1) maintenance: close / open the site ──
  if (/(اقفلي|قفلي|سكري|اغلقي|أقفلي|أغلقي)\s*(الموقع|المتجر)/.test(raw)) {
    if (!has('settings.write')) return deny('settings.write');
    const row = await db.storeSettings.findUnique({ where: { key: 'maintenance' } });
    const val = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    const stamp = new Date().toISOString();
    await db.storeSettings.upsert({
      where: { key: 'maintenance' },
      create: { key: 'maintenance', value: JSON.stringify({ ...val, enabled: true, updatedAt: stamp }) },
      update: { value: JSON.stringify({ ...val, enabled: true, updatedAt: stamp }) },
    });
    invalidateSettings();
    executed.push({ tool: 'maintenance.close', ok: true, summary: 'الموقع مقفول' });
    return { reply: 'تم قفل الموقع 🔒 أي زائرة هتشوف صفحة الصيانة، ولوحة التحكم فضلت شغالة عادي.', executed };
  }
  if (/(افتحي|افتح|شغّلي|شغلي)\s*(الموقع|المتجر)/.test(raw)) {
    if (!has('settings.write')) return deny('settings.write');
    const row = await db.storeSettings.findUnique({ where: { key: 'maintenance' } });
    const val = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    const stamp = new Date().toISOString();
    await db.storeSettings.upsert({
      where: { key: 'maintenance' },
      create: { key: 'maintenance', value: JSON.stringify({ ...val, enabled: false, updatedAt: stamp }) },
      update: { value: JSON.stringify({ ...val, enabled: false, updatedAt: stamp }) },
    });
    invalidateSettings();
    executed.push({ tool: 'maintenance.open', ok: true, summary: 'الموقع مفتوح' });
    return { reply: 'تم فتح الموقع ✓ المتجر رجع يشتغل عادي للزوار.', executed };
  }

  // ── 2) add product (text command) ──
  if (/(أضيفي|اضيفي|اعملي|عملي|ضيفي|سجلي|انشئي|أنشئي|حطي|إضافة|اضافة|زوديلي)/.test(raw) && /(بسعر|سعر|جنيه)/.test(raw)) {
    if (!has('products.write')) return deny('products.write');
    const quoted = raw.match(/«([^«»]+)»/);
    let name = quoted?.[1]?.trim() || '';
    if (!name) {
      const m = raw.match(/(?:باسم|اسمه|اسمها|منتج)\s+(.+)/);
      if (m) name = m[1].split(/\s+(?:بسعر|سعر|بـ|في|بقسم|ومن)\s+/)[0].replace(/[؟?.!]+$/, '').trim();
    }
    const priceM = latinDigits(raw).match(/(?:بسعر|سعر)\s*(\d+(?:\.\d+)?)|(?:بـ)\s*(\d+(?:\.\d+)?)\s*جنيه/);
    const price = priceM ? Number(priceM[1] || priceM[2]) : null;
    if (!name) {
      return { reply: 'جاهزة أضيف المنتج ✨ بس اكتبي اسمه بين «» وبعدين السعر — مثال: أضيفي منتج «سيروم فيتامين سي» بسعر 320', executed };
    }
    if (!price) {
      return { reply: `جاهزة أضيف «${name}» ✨ بس قوليلي السعر — مثال: بسعر 320`, executed: [{ tool: 'product.prepare', ok: false, summary: 'السعر ناقص' }] };
    }
    const compareAtM = latinDigits(raw).match(/(?:مخفض من|كان|بدل)\s*(\d+(?:\.\d+)?)/);
    const compareAt = compareAtM ? Number(compareAtM[1]) : null;
    const catM = raw.match(/(?:في قسم|بقسم|ضمن قسم)\s*(?:«([^«»]+)»|(\S+))/);
    const givenCat = (catM?.[1] || catM?.[2] || '').trim();

    const categories = await db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, nameAr: true, nameEn: true } });
    const nGiven = givenCat ? normAr(givenCat) : '';
    let category =
      (givenCat &&
        (categories.find((c) => normAr(c.nameAr) === nGiven) ||
          categories.find((c) => normAr(c.nameAr).includes(nGiven) || nGiven.includes(normAr(c.nameAr))))) ||
      null;
    let catNote = '';
    if (!category && givenCat) {
      const catSlug = await uniqueSlugFor(givenCat);
      const created = await db.category.create({
        data: { slug: catSlug, nameAr: givenCat, nameEn: givenCat, description: 'قسم أُنشئ تلقائيًا بواسطة المساعد الذكي' },
      });
      category = { id: created.id, nameAr: created.nameAr, nameEn: created.nameEn };
      executed.push({ tool: 'category.create', ok: true, summary: created.nameAr });
    }
    if (!category && categories.length) {
      category = categories[0];
      catNote = ` (ضفته في «${category.nameAr}» — تقدري تنقليه)`;
    }
    if (!category) {
      return { reply: 'مفيش أقسام في المتجر لسه — اعملي قسم أول من صفحة الأقسام وأنا أضيف المنتج بعدها.', executed };
    }

    const slug = await uniqueSlugFor(slugifyLocal(name));
    const product = await db.product.create({
      data: {
        slug,
        nameAr: name,
        nameEn: name,
        description: name,
        price,
        compareAt: compareAt && compareAt > price ? compareAt : null,
        image: '/products/placeholder.svg',
        categoryId: category.id,
        stock: 20,
        published: true,
      },
    });
    executed.push({ tool: 'product.create', ok: true, summary: `${name} — ${price} ج.م — ${category.nameAr}` });
    await writeAudit({ actor: opts.admin?.username ?? null, action: 'product.created', entity: 'product', entityId: product.id, meta: { userAgent: 'ai-assistant' } });
    invalidateCatalog();
    return {
      reply: [
        `تم يا فندم، المنتج بقي على الأرض ✅`,
        `«${name}» — ${price} ج.م — قسم «${category.nameAr}»${catNote}`,
        compareAt && compareAt > price ? `مكتوب عليه إنه مخفّض من ${compareAt} ج.م 🏷️` : '',
        'تلاقيه في صفحة المنتجات — ورفعي له صورة وأضيفي أنواعه (الريحة/اللون) من التعديل 🌸',
      ].filter(Boolean).join('\n'),
      executed,
    };
  }

  // ── 3) price edit ──
  const priceEditM = raw.match(/(?:حددي|غيّري|غيري|غير|عدلي|ظبطي|خلي)\s*(?:سعر)\s*(.+?)\s*(?:إلى|إلي|الى|لـ|على|ب|بسعر|=)\s*(\d+(?:\.\d+)?)/);
  if (priceEditM) {
    if (!has('products.write')) return deny('products.write');
    const target = await findProductByFragment(priceEditM[1]);
    if (!target) return { reply: `ملقتش منتج باسم «${priceEditM[1].trim()}» — اكتبي اسمه زي ما هو في المنتجات وأنا أظبط السعر.`, executed };
    const newPrice = Number(priceEditM[2]);
    await db.product.update({ where: { id: target.id }, data: { price: newPrice } });
    executed.push({ tool: 'product.price', ok: true, summary: `${target.nameAr} → ${newPrice} ج.م` });
    invalidateCatalog();
    return { reply: `تم ✓ سعر «${target.nameAr}» بقى ${newPrice} ج.م (كان ${target.price} ج.م).`, executed };
  }

  // ── 4) stock ──
  const stockAddM = raw.match(/(?:زودي|اضيفي|ضيفي)\s*مخزون\s*(.+?)\s*(?:بـ|إلى|ل)?\s*(\d+)/);
  const stockSetM = raw.match(/(?:حددي|ظبطي)\s*(?:المخزون|مخزون)\s*(.+?)\s*(?:على|إلى|ب)?\s*(\d+)/);
  if (stockAddM || stockSetM) {
    if (!has('products.write')) return deny('products.write');
    const m = (stockAddM || stockSetM)!;
    const target = await findProductByFragment(m[1]);
    if (!target) return { reply: `ملقتش منتج باسم «${m[1].trim()}» — اكتبي اسمه زي ما هو في المنتجات.`, executed };
    const n = Number(m[2]);
    const newStock = stockAddM ? target.stock + n : Math.max(0, Math.floor(n));
    await db.product.update({ where: { id: target.id }, data: { stock: newStock } });
    executed.push({ tool: 'product.stock', ok: true, summary: `${target.nameAr} → ${newStock}` });
    invalidateCatalog();
    return { reply: `تم ✓ مخزون «${target.nameAr}» بقى ${newStock} وحدة.`, executed };
  }

  // ── 5) delete product ──
  const delM = raw.match(/(?:احذفي|حذفي|امسحي|إحذفي)\s*(?:المنتج)?\s*(«[^«»]+»|.+)?/);
  if (delM && /(منتج|المنتج)/.test(raw)) {
    if (!has('products.delete')) return deny('products.delete');
    const frag = (delM[1] || '').replace(/نهائيًا|نهائيا|من السجل/g, '').trim();
    if (!frag) return { reply: 'اكتبي اسم المنتج اللي عايزة تحذفيه وأنا أنفذ فورًا.', executed };
    const target = await findProductByFragment(frag);
    if (!target) return { reply: `ملقتش منتج باسم «${frag}» — اكتبي اسمه زي ما هو في المنتجات.`, executed };
    try {
      await db.product.delete({ where: { id: target.id } });
      executed.push({ tool: 'product.delete', ok: true, summary: target.nameAr });
      invalidateCatalog();
      return { reply: `تم الحذف ✓ «${target.nameAr}» اتشال من المتجر نهائيًا.`, executed };
    } catch {
      return { reply: `«${target.nameAr}» مرتبط بطلبات — احذفيه من صفحة المنتجات (هنا بنعمل تصفير آمن بدل الحذف).`, executed };
    }
  }

  // ── 6) queries ──
  const products = await db.product.findMany({
    select: { nameAr: true, price: true, compareAt: true, stock: true, published: true },
    orderBy: { price: 'desc' },
  });
  if (/(مخفوض|مخفض|خصم)/.test(raw)) {
    const n = firstNumber(raw) ?? 0;
    const discounted = products.filter((p) => p.compareAt && p.compareAt - p.price > n);
    return {
      reply: discounted.length
        ? `المنتجات اللي الخصم عليها أكتر من ${n} ج.م:\n${discounted
            .map((p) => `• ${p.nameAr} — ${p.price} بدل ${p.compareAt} ج.م (وفّرتي ${(p.compareAt! - p.price).toFixed(0)})`)
            .join('\n')}`
        : `مفيش منتج مخفّض بأكثر من ${n} ج.م حاليًا.`,
      executed,
    };
  }
  if (/(أغلى|اغلى|الأغلى|الاغلى|اعلى سعر)/.test(raw)) {
    return { reply: `أغلى 5 منتجات حاليًا:\n${products.slice(0, 5).map((p) => `• ${p.nameAr} — ${p.price} ج.م`).join('\n')}`, executed };
  }
  if (/(أرخص|ارخص|الارخص)/.test(raw)) {
    const asc = [...products].sort((a, b) => a.price - b.price).slice(0, 5);
    return { reply: `أرخص 5 منتجات حاليًا:\n${asc.map((p) => `• ${p.nameAr} — ${p.price} ج.م`).join('\n')}`, executed };
  }
  if (/(كام|عدد)\s*(منتج|منتجات|طلب|طلبات)/.test(raw)) {
    const orders = await db.order.count();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await db.order.count({ where: { createdAt: { gte: today } } });
    return { reply: `عندك ${products.length} منتج (${products.filter((p) => p.published).length} منشور فعليًا) و${orders} طلب إجمالي — منهم ${todayOrders} النهاردة.`, executed };
  }
  if (/(المخزون|مخزون|كمية|الكميات)/.test(raw) && !/(زودي|اضيفي|حددي)/.test(raw)) {
    const low = products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock);
    return {
      reply: low.length
        ? `المخزون الواطي (5 أو أقل):\n${low.map((p) => `• ${p.nameAr} — باقي ${p.stock}`).join('\n')}`
        : 'كل المنتجات مخزونها فوق 5 ✓',
      executed,
    };
  }
  if (/(الطلبات|طلباتي|آخر الطلبات|اخر الطلبات|طلبات النهاردة)/.test(raw)) {
    const recent = await db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { items: true } });
    if (!recent.length) return { reply: 'مفيش طلبات لسه.', executed };
    return {
      reply: `آخر ${recent.length} طلبات:\n${recent
        .map((o) => `• ${o.orderNumber} — ${o.customerName} — ${o.total} ج.م — ${o.status}`)
        .join('\n')}`,
      executed,
    };
  }

  return null;
}

/** U86-AI-CMD — grounded admin summary when no command matched (replaces the
 * storefront customer-service canned replies inside the ADMIN assistant). */
export async function adminGroundedReply(message: string): Promise<string> {
  const products = await db.product.count();
  const published = await db.product.count({ where: { published: true } });
  const orders = await db.order.count();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayOrders = await db.order.count({ where: { createdAt: { gte: today } } });
  const lowStock = await db.product.count({ where: { stock: { lte: 5 } } });
  return [
    'أنا لُو مساعدتك الإدارية — بفهم أوامر تنفيذية زي:',
    '• «أضيفي منتج باسم «سيروم فيتامين سي» بسعر 320»',
    '• «حددي سعر بوكس الجامعة على 350»',
    '• «زودي مخزون زيت الشعر بـ 10» / «احذفي منتج كذا»',
    '• «اقفلي الموقع» / «افتحي الموقع»',
    '• «أي المنتجات مخفضة أكتر من 50؟» / «كام طلب النهاردة؟»',
    `— والحالة الآن: ${products} منتج (${published} منشور)، ${orders} طلب إجمالي (${todayOrders} النهاردة)، ${lowStock} منتج مخزونه واطي.`,
  ].join('\n');
}

async function uniqueSlugFor(base: string): Promise<string> {
  let slug = slugifyLocal(base);
  let n = 1;
  while (await db.product.findFirst({ where: { slug } }) || await db.category.findFirst({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function slugifyLocal(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || `item-${Date.now()}`;
}
