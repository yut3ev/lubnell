'use client';

// U61-BLOG — Studio → «المدونة»: the owner writes SEO journal articles
// (مقالات) that render at /blog + /blog/[slug]. Editor covers: bilingual
// title/excerpt/content, cover image (shared ImageField: upload / URL /
// media library), up to 4 featured products (shoppable cards under the
// article), slug (auto-suggested from the EN title), publish toggle.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Newspaper, Plus, Trash2 } from 'lucide-react';
import { apiJson, fmtDay } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ImageField from '../image-field';

type AdminPost = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
  contentAr: string;
  contentEn: string;
  coverImage: string | null;
  productSlugs: string; // JSON string array
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

type PickerProduct = { id: string; slug: string; nameAr: string; image: string; published: boolean };

type PostForm = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
  contentAr: string;
  contentEn: string;
  coverImage: string;
  productSlugs: string[];
  published: boolean;
};

const EMPTY: PostForm = {
  id: '',
  slug: '',
  titleAr: '',
  titleEn: '',
  excerptAr: '',
  excerptEn: '',
  contentAr: '',
  contentEn: '',
  coverImage: '',
  productSlugs: [],
  published: true,
};

const MAX_FEATURED = 4;

export default function BlogSection() {
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PostForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<PickerProduct[] | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; posts: AdminPost[] }>('/api/admin/posts');
    if (ok && data?.ok) setPosts(data.posts);
    else setPosts([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  /** fresh fetch on EVERY dialog open (no stale-closure guard: a cached
      closure value would early-return on the second open and leave the
      picker stuck on «جاري التحميل…» forever — caught in E2E). */
  async function loadProducts() {
    const { ok, data } = await apiJson<{ ok: boolean; products: PickerProduct[] }>('/api/admin/products');
    if (ok && data?.ok) setProducts(data.products);
    else setProducts([]);
  }

  function newPost() {
    setForm(EMPTY);
    setProducts(null);
    setOpen(true);
    void loadProducts();
  }

  function editPost(p: AdminPost) {
    let picks: string[] = [];
    try {
      const parsed = JSON.parse(p.productSlugs || '[]');
      picks = Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
    } catch {
      picks = [];
    }
    setForm({
      id: p.id,
      slug: p.slug,
      titleAr: p.titleAr,
      titleEn: p.titleEn || '',
      excerptAr: p.excerptAr || '',
      excerptEn: p.excerptEn || '',
      contentAr: p.contentAr,
      contentEn: p.contentEn || '',
      coverImage: p.coverImage || '',
      productSlugs: picks,
      published: p.published,
    });
    setProducts(null);
    setOpen(true);
    void loadProducts();
  }

  function togglePick(slug: string) {
    setForm((f) => {
      const has = f.productSlugs.includes(slug);
      if (!has && f.productSlugs.length >= MAX_FEATURED) return f;
      return { ...f, productSlugs: has ? f.productSlugs.filter((s) => s !== slug) : [...f.productSlugs, slug] };
    });
  }

  async function save() {
    if (!form.titleAr.trim() || !form.contentAr.trim()) {
      toast({ title: 'العنوان والمحتوى العربي مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'save', ...form }),
    });
    setSaving(false);
    if (ok && data?.ok) {
      setOpen(false);
      toast({ title: form.published ? 'تم نشر المقال — ظهر في المدونة فورًا ✓' : 'تم حفظ المقال كمسودة ✓' });
      await load();
    } else {
      toast({ title: data?.error || 'تعذر الحفظ', variant: 'destructive' });
    }
  }

  async function toggle(p: AdminPost) {
    const { ok, data } = await apiJson<{ ok: boolean; published?: boolean }>('/api/admin/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle', id: p.id }),
    });
    if (ok && data?.ok) {
      toast({ title: data.published ? 'المقال منشور الآن ✓' : 'تم تحويل المقال لمسودة' });
      await load();
    } else toast({ title: 'تعذر تغيير حالة النشر', variant: 'destructive' });
  }

  async function remove(p: AdminPost) {
    if (!window.confirm(`حذف مقال "${p.titleAr}"؟ لا يمكن الرجوع.`)) return;
    const { ok } = await apiJson('/api/admin/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'remove', id: p.id }),
    });
    if (ok) {
      toast({ title: 'تم حذف المقال' });
      await load();
    }
  }

  const publishedCount = (posts ?? []).filter((p) => p.published).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Newspaper className="h-4 w-4" aria-hidden />
          مقالات المتجر تظهر على <span dir="ltr" className="font-bold">/blog</span> — بتجيب زيارات مجانية من جوجل.
          {posts && (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-foreground/70">
              {publishedCount} منشور من {posts.length}
            </span>
          )}
        </p>
        <Button onClick={newPost} className="h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-lg shadow-primary/25">
          <Plus className="ml-1 h-4 w-4" aria-hidden /> مقال جديد
        </Button>
      </div>

      {posts === null && <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>}

      {posts !== null && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 text-sm font-bold">لا مقالات بعد</p>
          <p className="mt-1 text-xs text-muted-foreground">اكتبي أول مقال — مثلاً «إزاي تختاري العطر المناسب» — وانشريه بضغطة.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(posts ?? []).map((p) => (
          <article key={p.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 font-black">
                  {p.titleAr}
                  {p.published ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">منشور</span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">مسودة</span>
                  )}
                </h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">/blog/{p.slug}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={`/blog/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary transition-transform hover:scale-110"
                  aria-label="فتح المقال"
                  title="فتح المقال"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
                <button
                  onClick={() => toggle(p)}
                  className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-[10px] font-black transition-transform hover:scale-110 ${
                    p.published ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                  aria-label={p.published ? 'تحويل لمسودة' : 'نشر'}
                  title={p.published ? 'تحويل لمسودة' : 'نشر'}
                >
                  {p.published ? 'مسودة' : 'نشر'}
                </button>
                <button
                  onClick={() => editPost(p)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary transition-transform hover:scale-110"
                  aria-label="تعديل"
                  title="تعديل"
                >
                  <PencilSmall />
                </button>
                <button
                  onClick={() => remove(p)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive transition-transform hover:scale-110"
                  aria-label="حذف"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            {p.coverImage && (
              <img src={p.coverImage} alt={p.titleAr} className="mt-2.5 h-28 w-full rounded-xl object-cover" loading="lazy" />
            )}
            <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{p.excerptAr || p.contentAr}</p>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              آخر تحديث: {fmtDay(p.updatedAt)}
              {p.publishedAt ? ` · نُشر: ${fmtDay(p.publishedAt)}` : ''}
            </p>
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? `تعديل المقال — /blog/${form.slug}` : 'مقال جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>عنوان المقال (عربي) *</Label>
                <Input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} placeholder="إزاي تختاري العطر المناسب" />
              </div>
              <div className="grid gap-1.5">
                <Label>Title in English</Label>
                <Input dir="ltr" className="text-left" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} placeholder="How to choose your perfume" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>الرابط (اتركيه فاضي ويتولد تلقائيًا)</Label>
              <Input dir="ltr" className="text-left" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="perfume-guide" />
            </div>

            <ImageField
              label="صورة الغلاف (اختياري)"
              value={form.coverImage}
              onChange={(url) => setForm({ ...form, coverImage: url })}
              variant="tall"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>مقدمة قصيرة (عربي)</Label>
                <textarea
                  value={form.excerptAr}
                  onChange={(e) => setForm({ ...form, excerptAr: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="سطرين بيلخصوا المقال — بيتولد تلقائيًا من أول سطر لو سبتيه فاضي"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Short excerpt (English)</Label>
                <textarea
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.excerptEn}
                  onChange={(e) => setForm({ ...form, excerptEn: e.target.value })}
                  rows={3}
                  placeholder="Two-line summary shown on the blog cards…"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>محتوى المقال (عربي) *</Label>
              <textarea
                value={form.contentAr}
                onChange={(e) => setForm({ ...form, contentAr: e.target.value })}
                rows={12}
                className="w-full rounded-xl border border-border bg-card p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={'اكتبي المقال هنا…\n\n• سطر يبدأ بـ • يتحول لقائمة نقطية\n1. سطر يبدأ برقم يتحول لخطوات مرقمة\n\nسيبي سطر فاضي بين الفقرات.'}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Content in English (اختياري — الفاضي يعرض العربي)</Label>
              <textarea
                dir="ltr"
                className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                value={form.contentEn}
                onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                rows={8}
                placeholder="Write the English version here…"
              />
            </div>

            {/* featured products picker */}
            <div className="grid gap-1.5">
              <Label>
                منتجات من المقال ({form.productSlugs.length}/{MAX_FEATURED}) — تظهر ككروت قابلة للشراء تحت المقال
              </Label>
              {products === null ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> جاري تحميل المنتجات…</p>
              ) : products.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا منتجات — ضيفي منتجات أولًا من قسم «المنتجات».</p>
              ) : (
                <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border/60 bg-secondary/20 p-2 sm:grid-cols-3">
                  {products.map((prod) => {
                    const picked = form.productSlugs.includes(prod.slug);
                    const full = !picked && form.productSlugs.length >= MAX_FEATURED;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => togglePick(prod.slug)}
                        disabled={full}
                        className={`flex items-center gap-2 rounded-xl border p-1.5 text-right transition-colors ${
                          picked
                            ? 'border-primary bg-primary/10'
                            : full
                              ? 'cursor-not-allowed border-border/40 opacity-40'
                              : 'border-border/60 bg-card hover:border-primary/40'
                        }`}
                        aria-pressed={picked}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary/50">
                          {prod.image ? <img src={prod.image} alt={prod.nameAr} className="h-full w-full object-cover" loading="lazy" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{prod.nameAr}</span>
                        {picked && <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-black text-primary-foreground">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                نشر المقال (بدون علامة = مسودة)
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={save} disabled={saving} className="min-w-28 bg-primary font-bold text-primary-foreground">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : form.id ? 'حفظ التعديلات' : 'نشر المقال'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PencilSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
