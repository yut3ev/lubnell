'use client';

import { confirmDialog } from '@/components/ui/confirm-service';
import { parseVariants, serializeGroups, type VariantGroup } from '@/lib/lubnel-types';


import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Droplet, Eye, EyeOff, Flower2, Loader2, Palette, Pencil, Plus, Search, Star, Trash2, Upload, X } from 'lucide-react';
import { compressImage } from '@/lib/lubnel-helpers';
import { apiJson, EGP } from '../helpers';
import ImageField, { uploadImageFile } from '../image-field';
import MultiImageField from '../multi-image-field'; // U58-GALLERY
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Category = { id: string; slug: string; nameAr: string };
type Product = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
  gallery: string | null;
  categoryId: string;
  category: Category;
  badgeAr: string | null;
  stock: number;
  featured: boolean;
  published: boolean;
  variants: string | null;
};

const EMPTY = {
  nameAr: '', nameEn: '', slug: '', price: '', compareAt: '', stock: '20',
  description: '', image: '', badgeAr: '', categoryId: '', featured: false, published: true,
};

// RESTOCK-ALERTS — one row per «أعلمني لما يتوفر» request from the storefront
type RestockAlertRow = { slug: string; productName: string; phone: string; at: string; done: boolean };

export default function ProductsSection() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'new' | Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [gallery, setGallery] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // U85-V3 — MULTIPLE option groups (اللون + الحجم + الريحة…): the customer
  // picks ONE value from EACH group and the cart line carries them all
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
  const [variantUploading, setVariantUploading] = useState<string | null>(null);
  const { toast } = useToast();
  // RESTOCK-ALERTS — the «أعلمني لما يتوفر» queue from the storefront
  const [restockAlerts, setRestockAlerts] = useState<RestockAlertRow[]>([]);
  const [showRestock, setShowRestock] = useState(false);

  async function saveRestockAlerts(next: RestockAlertRow[], msg: string) {
    const r = await apiJson('/api/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'restock_alerts', alerts: next }) });
    if (r.ok) {
      setRestockAlerts(next);
      toast({ title: msg });
    } else toast({ title: 'تعذر الحفظ', variant: 'destructive' });
  }

  function waLink(phone: string, productName: string) {
    const digits = phone.replace(/[^0-9]/g, '');
    const intl = digits.startsWith('0') ? '2' + digits : digits;
    return `https://wa.me/${intl}?text=${encodeURIComponent(`مرحبًا 🌸 من LUBNÉL — المنتج اللي طلبتي إشعار عنه بقى متوفر: ${productName} 🎉 تقدري تطلبيه من: https://lubnel.vercel.app`)}`;
  }

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      apiJson<{ ok: boolean; products: Product[] }>('/api/admin/products'),
      apiJson<{ ok: boolean; categories: Category[] }>('/api/admin/categories'),
    ]);
    if (p.ok && p.data?.ok) setProducts(p.data.products);
    else setProducts([]);
    if (c.ok && c.data?.ok) setCategories(c.data.categories);
    // RESTOCK-ALERTS — pending notify-me queue for the sold-out products
    const ra = await apiJson<{ ok: boolean; settings?: { alerts?: RestockAlertRow[] } } | null>('/api/admin/settings?key=restock_alerts').catch(() => null);
    const list = ra?.ok && Array.isArray(ra.settings?.alerts) ? ra.settings!.alerts : [];
    setRestockAlerts(list.filter((a) => a && typeof a === 'object'));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = useMemo(
    () =>
      products?.filter((p) =>
        query.trim() ? (p.nameAr + ' ' + p.nameEn + ' ' + p.category.nameAr).includes(query.trim()) : true
      ),
    [products, query]
  );

  function openNew() {
    setForm(EMPTY);
    setGallery([]);
    setVariantGroups([]);
    setModal('new');
  }

  function openEdit(p: Product) {
    setForm({
      nameAr: p.nameAr, nameEn: p.nameEn, slug: p.slug,
      price: String(p.price), compareAt: p.compareAt ? String(p.compareAt) : '',
      stock: String(p.stock), description: p.description, image: p.image,
      badgeAr: p.badgeAr || '', categoryId: p.categoryId, featured: p.featured,
      published: p.published,
    });
    try {
      setGallery(p.gallery ? (JSON.parse(p.gallery) as string[]) : []);
    } catch {
      setGallery([]);
    }
    // U85-V3 — restore the option groups (handles every stored format)
    setVariantGroups(parseVariants(p.variants));
    setModal(p);
  }

  async function save() {
    if (!modal) return;
    setSaving(true);
    const editing = modal !== 'new';
    const body = {
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      price: Number(form.price),
      compareAt: form.compareAt ? Number(form.compareAt) : null,
      stock: Number(form.stock),
      description: form.description,
      image: form.image || undefined,
      badgeAr: form.badgeAr,
      categoryId: form.categoryId || categories[0]?.id,
      featured: form.featured,
      published: form.published,
      gallery,
      variants: serializeGroups(
        variantGroups
          .map((g) => ({ name: g.name, options: g.options.filter((o) => o.value.trim()) }))
          .filter((g) => g.name.trim() && g.options.length)
      ),
    };
    const { ok, data } = editing
      ? await apiJson(`/api/admin/products/${(modal as Product).id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await apiJson('/api/admin/products', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (!ok || !data?.ok) {
      toast({ title: editing ? 'تعذر تحديث المنتج' : 'تعذر إنشاء المنتج', description: data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'تم تحديث المنتج ✓' : 'تمت إضافة المنتج ✓' });
    setModal(null);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    const { ok } = await apiJson(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (ok) {
      toast({ title: msg });
      load();
    } else toast({ title: 'تعذر التحديث', variant: 'destructive' });
  }

  async function remove(p: Product) {
    if (!(await confirmDialog({ title: 'حذف المنتج', message: `حذف "${p.nameAr}" نهائيًا؟`, confirmText: 'حذف نهائي', danger: true }))) return;
    const { ok, data } = await apiJson<{ ok: boolean; softCleared?: boolean }>(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    if (ok) {
      toast({ title: data?.softCleared ? 'المنتج مرتبط بطلبات — تم تصفير مخزونه وتمييزه' : 'تم حذف المنتج' });
      load();
    } else toast({ title: 'تعذر الحذف', variant: 'destructive' });
  }

  // U85-V3 — upload a photo for an option inside a group
  async function uploadGroupOptionImage(gi: number, oi: number, file: File) {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'اختاري صورة صالحة', variant: 'destructive' });
      return;
    }
    const uploadKey = `${gi}-${oi}`;
    setVariantUploading(uploadKey);
    try {
      const compressed = await compressImage(file, 1200, 0.82);
      const uploaded = await uploadImageFile(compressed);
      setVariantGroups((current) =>
        current.map((item, index) =>
          index === gi ? { ...item, options: item.options.map((op, opi) => (opi === oi ? { ...op, image: uploaded.url } : op)) } : item
        )
      );
      toast({ title: 'تم رفع صورة الخيار ✓' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'فشل رفع صورة الخيار', variant: 'destructive' });
    } finally {
      setVariantUploading(null);
    }
  }

  // U58-GALLERY — «تعيين كصورة رئيسية» ينتقل من الـ MultiImageField إلى حقل الصورة الرئيسية

  if (!products)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* RESTOCK-ALERTS — pending «أعلمني لما يتوفر» queue */}
      {restockAlerts.filter((a) => !a.done).length > 0 && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4">
          <button
            onClick={() => setShowRestock((s) => !s)}
            className="flex w-full items-center justify-between text-sm font-black text-amber-900"
            aria-expanded={showRestock}
          >
            <span>🔔 تنبيهات «أعلمني لما يتوفر» — {restockAlerts.filter((a) => !a.done).length} طلب</span>
            <span className="text-xs font-bold">{showRestock ? 'إخفاء' : 'عرض'}</span>
          </button>
          {showRestock && (
            <ul className="mt-3 space-y-2">
              {restockAlerts.filter((a) => !a.done).map((a, i) => (
                <li key={`${a.slug}-${a.phone}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-card px-3 py-2 text-sm">
                  <span>
                    <strong>{a.productName}</strong>
                    <span className="mx-2 text-muted-foreground" dir="ltr">{a.phone}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(a.at).toLocaleDateString('ar-EG')}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <a
                      href={waLink(a.phone, a.productName)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white"
                    >
                      واتساب العميل
                    </a>
                    <button
                      onClick={() => saveRestockAlerts(restockAlerts.map((x) => (x === a ? { ...x, done: true } : x)), 'تم التعليم كمُشعَر')}
                      className="rounded-full border border-border px-3 py-1 text-[11px] font-bold"
                    >
                      تم الإشعار ✓
                    </button>
                    <button
                      onClick={() => saveRestockAlerts(restockAlerts.filter((x) => x !== a), 'تم الحذف')}
                      className="rounded-full px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-destructive"
                      aria-label="حذف التنبيه"
                    >
                      حذف
                    </button>
                  </span>
                </li>
              ))}
              <li className="text-[11px] text-muted-foreground">
                رفعي المخزون من نموذج المنتج الأول، وبعدين اضغطي «واتساب العميل» لكل طلب — الرسالة جاهزة تلقائيًا.
              </li>
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحثي باسم المنتج أو القسم…" className="rounded-full bg-card pr-9" />
        </div>
        <Button className="rounded-full gap-1.5 bg-primary font-bold text-primary-foreground" onClick={openNew}>
          <Plus className="h-4 w-4" /> إضافة منتج
        </Button>
        <a href="/api/admin/export?type=products" download>
          <Button variant="outline" size="sm" className="rounded-full gap-1.5">
            <Download className="h-3.5 w-3.5" /> تصدير CSV
          </Button>
        </a>
        <span className="mr-auto text-xs font-bold text-muted-foreground">{products.length} منتج</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary/50 text-right text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">المنتج</th>
                <th className="px-4 py-3 font-bold">القسم</th>
                <th className="px-4 py-3 font-bold">السعر</th>
                <th className="px-4 py-3 font-bold">المخزون</th>
                <th className="px-4 py-3 font-bold">مميز</th>
                <th className="px-4 py-3 font-bold">منشور</th>
                <th className="px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visible?.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا نتائج مطابقة.</td></tr>
              )}
              {visible?.map((p) => (
                <tr key={p.id} className={`border-t border-border/50 ${p.published ? '' : 'opacity-55'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.nameAr} className="h-11 w-11 rounded-xl border border-border/60 object-cover" />
                      <div className="min-w-0">
                        <strong className="block truncate">{p.nameAr}</strong>
                        <span className="block truncate text-xs text-muted-foreground" dir="ltr">{p.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.category.nameAr}</td>
                  <td className="px-4 py-3 font-bold">
                    {EGP(p.price)}
                    {p.compareAt ? <del className="mr-1.5 text-xs text-muted-foreground">{EGP(p.compareAt)}</del> : null}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.stock}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        if (v !== p.stock) patch(p.id, { stock: v }, `تم تحديث مخزون ${p.nameAr} → ${v}`);
                      }}
                      className={`w-20 rounded-lg border px-2 py-1 text-sm font-bold ${p.stock < 10 ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-border bg-background'}`}
                      aria-label={`مخزون ${p.nameAr}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(p.id, { featured: !p.featured }, p.featured ? 'أُزيل التمييز' : 'تم تمييز المنتج ★')}
                      className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-secondary"
                      aria-label={p.featured ? `إزالة تمييز ${p.nameAr}` : `تمييز ${p.nameAr}`}
                    >
                      <Star className={`h-4 w-4 ${p.featured ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(p.id, { published: !p.published }, p.published ? 'تم إلغاء نشر المنتج — اختفى من المتجر' : 'تم نشر المنتج — ظهر في المتجر')}
                      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${p.published ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}
                      aria-label={p.published ? `إلغاء نشر ${p.nameAr}` : `نشر ${p.nameAr}`}
                      title={p.published ? 'منشور — ظاهر في المتجر' : 'غير منشور — مخفي من المتجر'}
                    >
                      {p.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label={`تعديل ${p.nameAr}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(p)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-destructive" aria-label={`حذف ${p.nameAr}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* add / edit modal */}
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {modal === 'new' ? 'إضافة منتج جديد' : modal ? `تعديل: ${modal.nameAr}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="p-nameAr">اسم المنتج (عربي) *</Label>
              <Input id="p-nameAr" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="مثال: بوكس الجامعة" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-nameEn">الاسم (إنجليزي)</Label>
              <Input id="p-nameEn" dir="ltr" className="text-left" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="University Box" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-price">السعر (ج.م) *</Label>
                <Input id="p-price" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="200" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-compareAt">السعر قبل الخصم</Label>
                <Input id="p-compareAt" type="number" min={0} value={form.compareAt} onChange={(e) => setForm({ ...form, compareAt: e.target.value })} placeholder="250" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-stock">المخزون</Label>
                <Input id="p-stock" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-category">القسم *</Label>
                <select
                  id="p-category"
                  value={form.categoryId || categories[0]?.id || ''}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>صورة المنتج الرئيسية</Label>
              <ImageField value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="" />
            </div>
            <div className="grid gap-2">
              <Label>صور إضافية (Gallery — حتى 12 صورة)</Label>
              {/* U58-GALLERY — رفع متعدد + ترتيب بالأسهم + مكتبة متعددة + رابط */}
              <MultiImageField
                images={gallery}
                onChange={setGallery}
                max={12}
                primaryUrl={form.image}
                onMakePrimary={(url) => {
                  setGallery((list) => list.filter((x) => x !== url));
                  setForm((f) => ({ ...f, image: url }));
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                اضغطي النجمة على أي صورة لتجعليها صورة المنتج الرئيسية — الترتيب هنا هو ترتيب الظهور في صفحة المنتج.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-badge">شريط البادج (عربي)</Label>
              <Input id="p-badge" value={form.badgeAr} onChange={(e) => setForm({ ...form, badgeAr: e.target.value })} placeholder="الأكثر طلبًا" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-desc">الوصف</Label>
              <textarea id="p-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            {/* U85-V3 — مجموعات الأنواع: اللون + الحجم + الريحة… لكل خيار صورته */}
            <div className="grid gap-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-3">
              <Label className="font-black">مجموعات الأنواع — أضيفي مجموعة لون أو حجم أو ريحة، ولكل خيار اسم وصورة</Label>
              {variantGroups.map((g, gi) => (
                <div key={gi} className="grid gap-2 rounded-xl border border-border/50 bg-background/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={g.name}
                      onChange={(e) => setVariantGroups((cur) => cur.map((it, idx) => (idx === gi ? { ...it, name: e.target.value } : it)))}
                      placeholder="اسم المجموعة — مثال: اللون / الحجم / الريحة"
                      className="flex-1 font-bold"
                    />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`حذف مجموعة ${g.name || gi + 1}`}
                      onClick={() => setVariantGroups((cur) => cur.filter((_, idx) => idx !== gi))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {g.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/80 p-1.5">
                      <label
                        className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground"
                        title="صورة الخيار"
                      >
                        {variantUploading === `${gi}-${oi}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : o.image ? (
                          <img src={o.image} alt={o.value} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <input type="file" accept="image/*" hidden
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadGroupOptionImage(gi, oi, f); e.target.value = ''; }} />
                      </label>
                      <Input
                        value={o.value}
                        onChange={(e) => setVariantGroups((cur) => cur.map((it, idx) => (idx === gi ? { ...it, options: it.options.map((op, opi) => (opi === oi ? { ...op, value: e.target.value } : op)) } : it)))}
                        placeholder={`الخيار ${oi + 1} — مثال: أحمر / 250 مل / تفاح`}
                      />
                      <label
                        className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border/60"
                        title="لون الخيار (اختياري)"
                        style={{ background: o.color || '#ffffff' }}
                      >
                        <input type="color" value={o.color || '#ffffff'}
                          onChange={(e) => setVariantGroups((cur) => cur.map((it, idx) => (idx === gi ? { ...it, options: it.options.map((op, opi) => (opi === oi ? { ...op, color: e.target.value } : op)) } : it)))}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label={`لون الخيار ${oi + 1}`} />
                      </label>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`حذف الخيار ${oi + 1}`}
                        onClick={() => setVariantGroups((cur) => cur.map((it, idx) => (idx === gi ? { ...it, options: it.options.filter((_, opi) => opi !== oi) } : it)))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5"
                    onClick={() => setVariantGroups((cur) => cur.map((it, idx) => (idx === gi ? { ...it, options: [...it.options, { value: '' }] } : it)))}
                  >
                    <Plus className="h-3.5 w-3.5" /> إضافة خيار للمجموعة
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5"
                  onClick={() => setVariantGroups((cur) => [...cur, { name: 'اللون', options: [{ value: '' }] }])}
                >
                  <Plus className="h-3.5 w-3.5" /> مجموعة ألوان
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5"
                  onClick={() => setVariantGroups((cur) => [...cur, { name: 'الحجم', options: [{ value: '' }] }])}
                >
                  <Plus className="h-3.5 w-3.5" /> مجموعة أحجام
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5"
                  onClick={() => setVariantGroups((cur) => [...cur, { name: 'الريحة', options: [{ value: '' }] }])}
                >
                  <Plus className="h-3.5 w-3.5" /> مجموعة روائح
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5"
                  onClick={() => setVariantGroups((cur) => [...cur, { name: '', options: [{ value: '' }] }])}
                >
                  <Plus className="h-3.5 w-3.5" /> مجموعة مخصصة
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                مثال: مجموعة «اللون» بخيارات أحمر/أخضر/أصفر بصورها + مجموعة «الحجم» 100 مل/250 مل. الزبونة تختار من كل مجموعة في صفحة المنتج وكل اختياراتها تُسجل مع الطلب.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
              منتج مميز (يظهر في الواجهة)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
              منشور في المتجر (إلغاء التأشيرة يُخفيه من الواجهة دون حذفه)
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-full" onClick={() => setModal(null)}><X className="h-4 w-4" /> إلغاء</Button>
              <Button disabled={saving || !form.nameAr.trim() || !form.price} onClick={save} className="rounded-full bg-primary font-bold text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
