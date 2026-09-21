'use client';

// U22-CATEGORY-PAGE — rebuilt to the owner's screenshots (brave_wEq4QTgibM /
// brave_qDhM7iJYon): add + edit dialogs both carry the full field set —
// names, slug, order, short description (under the name on the homepage),
// category image, and the «صفحة القسم /c/…» block (سطر تعريفي أعلى العنوان +
// بانر صفحة القسم — تركيبه فارغًا لاستخدام صورة الفئة) with a mini live
// preview of the /c/ header.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiJson } from '../helpers';
import ImageField from '../image-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Category = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  image: string | null;
  sortOrder: number;
  _count: { products: number };
};

type CatForm = {
  nameAr: string;
  nameEn: string;
  slug: string;
  description: string;
  sortOrder: string;
  image: string;
  intro: string;
  banner: string;
};

const EMPTY_FORM: CatForm = {
  nameAr: '',
  nameEn: '',
  slug: '',
  description: '',
  sortOrder: '99',
  image: '',
  intro: '',
  banner: '',
};

/** «صفحة القسم /c/…» — intro line + page banner + mini preview (her block). */
function CategoryPageBlock({
  form,
  setForm,
  slug,
}: {
  form: CatForm;
  setForm: (next: CatForm) => void;
  slug: string;
}) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-secondary/30 p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-primary">
        صفحة القسم <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs" dir="ltr">/c/{slug || '…'}</span>
        <a
          href={slug ? `/c/${slug}` : '/c/all'}
          target="_blank"
          rel="noreferrer"
          className="ms-auto inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-primary"
          tabIndex={slug ? 0 : -1}
        >
          فتح الصفحة <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>

      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="cat-intro">سطر تعريفي أعلى العنوان (اختياري)</Label>
        <Input
          id="cat-intro"
          value={form.intro}
          onChange={(e) => setForm({ ...form, intro: e.target.value })}
          placeholder="مثال: عطور تُروى بالذكريات"
        />
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label>بانر صفحة القسم (اختياري — غير صورة البطاقة)</Label>
        <ImageField value={form.banner} onChange={(url) => setForm({ ...form, banner: url })} placeholder="/uploads/banner.jpg" />
        <p className="text-[11px] text-muted-foreground">
          لو تركتيه فارغًا ستستخدم صفحة القسم صورة الفئة تلقائيًا.
        </p>
      </div>

      {/* mini live preview of the /c/ header */}
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">معاينة رأس الصفحة</p>
        <div className="relative overflow-hidden rounded-xl border border-border/60">
          <div className="absolute inset-0">
            <img src={form.banner || form.image || '/products/placeholder-box.svg'} alt="" aria-hidden className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-primary/85 to-primary/55" aria-hidden />
          </div>
          <div className="relative px-4 py-5 text-primary-foreground">
            {form.intro.trim() && <p className="text-[11px] font-bold opacity-85">{form.intro}</p>}
            <p className="text-lg font-black">{form.nameAr || 'اسم القسم'}</p>
            <p className="text-[11px] opacity-80">{form.nameEn || 'Category'} / LUBNÉL</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CatForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; categories: Category[] }>('/api/admin/categories');
    if (ok && data?.ok) setCategories(data.categories);
    else setCategories([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) || 99 }),
    });
    setSaving(false);
    if (!ok || !data?.ok) {
      toast({ title: 'تعذر إنشاء القسم', description: data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تمت إضافة القسم ✓' });
    setOpen(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    const { ok } = await apiJson(`/api/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (ok) {
      toast({ title: msg });
      load();
    } else toast({ title: 'تعذر التحديث', variant: 'destructive' });
  }

  const [editing, setEditing] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<CatForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(c: Category) {
    setEditing(c);
    setEditForm({
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      slug: c.slug,
      description: (c as Category & { description?: string | null }).description || '',
      intro: (c as Category & { intro?: string | null }).intro || '',
      banner: (c as Category & { banner?: string | null }).banner || '',
      sortOrder: String(c.sortOrder),
      image: c.image || '',
    });
  }

  // U19-CATEGORIES + U22 — full edit: names + slug + description + order + image + صفحة القسم
  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/categories/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nameAr: editForm.nameAr,
        nameEn: editForm.nameEn,
        slug: editForm.slug,
        description: editForm.description,
        intro: editForm.intro,
        banner: editForm.banner,
        sortOrder: Number(editForm.sortOrder) || 0,
        image: editForm.image,
      }),
    });
    setSavingEdit(false);
    if (ok) {
      toast({ title: `تم تحديث ${editForm.nameAr || editing.nameAr} ✓` });
      setEditing(null);
      load();
    } else toast({ title: data?.error || 'تعذر التحديث', variant: 'destructive' });
  }

  async function remove(c: Category) {
    if (!window.confirm(`حذف قسم "${c.nameAr}"؟`)) return;
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
    if (ok) {
      toast({ title: 'تم حذف القسم' });
      load();
    } else toast({ title: data?.error || 'تعذر الحذف', variant: 'destructive' });
  }

  if (!categories)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button className="rounded-full gap-1.5 bg-primary font-bold text-primary-foreground" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> إضافة قسم
        </Button>
        <span className="text-xs font-bold text-muted-foreground">{categories.length} قسم</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary/50 text-right text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">الصورة</th>
                <th className="px-4 py-3 font-bold">القسم</th>
                <th className="px-4 py-3 font-bold">المعرّف</th>
                <th className="px-4 py-3 font-bold">المنتجات</th>
                <th className="px-4 py-3 font-bold">الترتيب</th>
                <th className="px-4 py-3 font-bold">حذف</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-border/50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(c)}
                      className="group relative block h-12 w-16 overflow-hidden rounded-xl border border-border/60 bg-secondary/40"
                      aria-label={`تعديل ${c.nameAr}`}
                      title="اضغطي لتعديل القسم وصورته"
                    >
                      {c.image ? (
                        <img src={c.image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" loading="lazy" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">بدون صورة</span>
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <Pencil className="h-4 w-4 text-primary-foreground" aria-hidden />
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <strong>{c.nameAr}</strong>
                    <span className="block text-xs text-muted-foreground" dir="ltr">{c.nameEn}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" dir="ltr">/c/{c.slug}</td>
                  <td className="px-4 py-3 font-bold">{c._count.products}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      defaultValue={c.sortOrder}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== c.sortOrder) patch(c.id, { sortOrder: v }, `تم تحديث ترتيب ${c.nameAr}`);
                      }}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm font-bold"
                      aria-label={`ترتيب ${c.nameAr}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(c)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-destructive" aria-label={`حذف ${c.nameAr}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">لا أقسام بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* تعديل القسم — الاسم + المعرّف + الوصف + الترتيب + الصورة + صفحة القسم */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">تعديل القسم — {editing?.nameAr}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ce-nameAr">الاسم (عربي) *</Label>
                <Input id="ce-nameAr" value={editForm.nameAr} onChange={(e) => setEditForm({ ...editForm, nameAr: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-nameEn">الاسم (إنجليزي)</Label>
                <Input id="ce-nameEn" dir="ltr" className="text-left" value={editForm.nameEn} onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ce-slug">المعرّف (slug) *</Label>
                <Input id="ce-slug" dir="ltr" className="text-left" value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-sort">الترتيب</Label>
                <Input id="ce-sort" type="number" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ce-desc">وصف قصير (يظهر تحت الاسم في الرئيسية)</Label>
              <Input id="ce-desc" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="روائح تُناسب مساؤك" />
            </div>
            <div className="grid gap-1.5">
              <Label>صورة الفئة (رفع من الجهاز / المكتبة / رابط)</Label>
              <ImageField value={editForm.image} onChange={(url) => setEditForm({ ...editForm, image: url })} placeholder="/products/example.jpg" />
            </div>
            <CategoryPageBlock form={editForm} setForm={setEditForm} slug={editForm.slug} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>إلغاء</Button>
              <Button onClick={saveEdit} disabled={savingEdit || !editForm.nameAr.trim() || !editForm.slug.trim()} className="rounded-full bg-primary font-bold text-primary-foreground">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">إضافة فئة جديدة</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="c-nameAr">الاسم (عربي) *</Label>
                <Input id="c-nameAr" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="مثال: عطور" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c-nameEn">الاسم (إنجليزي)</Label>
                <Input id="c-nameEn" dir="ltr" className="text-left" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Fragrance" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="c-slug">المعرّف (slug) *</Label>
                <Input id="c-slug" dir="ltr" className="text-left" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="fragrance" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c-sort">الترتيب</Label>
                <Input id="c-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-desc">وصف قصير (يظهر تحت الاسم في الرئيسية)</Label>
              <Input id="c-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="روائح تُناسب مساؤك" />
            </div>
            <div className="grid gap-1.5">
              <Label>صورة الفئة (رفع من الجهاز / المكتبة / رابط)</Label>
              <ImageField value={form.image} onChange={(url) => setForm({ ...form, image: url })} placeholder="/products/placeholder.svg" />
            </div>
            <CategoryPageBlock form={form} setForm={setForm} slug={form.slug} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
              <Button disabled={saving || !form.nameAr.trim() || !form.slug.trim()} onClick={save} className="rounded-full bg-primary font-bold text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
