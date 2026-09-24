'use client';

import { confirmDialog } from '@/components/ui/confirm-service';


// U22-PAGES — rebuilt to the owner's screenshot (brave_HaG5DxB5r3):
// «الصفحات المدمجة — كل صفحة تُعرض تلقائيًا في المتجر حتى بدون تعديل!» —
// the 7 built-in info slugs always render as cards (افتراضية → مخصصة once
// edited), «استيراد الصفحات الافتراضية» seeds editable starter copies,
// every card shows an EN badge + /route + open/edit/delete actions, and the
// editor dialog is bilingual (عربي + English) — the storefront /info/[slug]
// renderer picks the right language per visitor.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { apiJson, fmtDay } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_INFO_PAGES, INFO_SLUGS } from '@/lib/info-pages';

type AdminPage = {
  slug: string;
  titleAr: string;
  titleEn?: string;
  contentAr: string;
  contentEn?: string;
  custom?: boolean;
  updatedAt: string;
};

type PageForm = {
  slug: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
};

const EMPTY: PageForm = { slug: '', titleAr: '', titleEn: '', contentAr: '', contentEn: '' };

export default function PagesSection() {
  const [pages, setPages] = useState<AdminPage[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PageForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; pages: AdminPage[] }>('/api/admin/pages');
    if (ok && data?.ok) setPages(data.pages);
    else setPages([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  /** stored entries + built-in defaults that were never saved (افتراضية). */
  const merged: AdminPage[] = (() => {
    const stored = pages ?? [];
    const bySlug = new Map(stored.map((p) => [p.slug, p]));
    const list: AdminPage[] = [];
    for (const slug of INFO_SLUGS) {
      const base = DEFAULT_INFO_PAGES[slug];
      const s = bySlug.get(slug);
      list.push(
        s ?? {
          slug,
          titleAr: base.titleAr,
          titleEn: base.titleEn,
          contentAr: base.contentAr,
          contentEn: base.contentEn,
          custom: false,
          updatedAt: '',
        },
      );
      bySlug.delete(slug);
    }
    // custom (non-built-in) pages keep their own place, newest last
    for (const rest of bySlug.values()) list.push(rest);
    return list;
  })();

  function newPage() {
    setForm(EMPTY);
    setOpen(true);
  }

  function editPage(p: AdminPage) {
    setForm({
      slug: p.slug,
      titleAr: p.titleAr,
      titleEn: p.titleEn || '',
      contentAr: p.contentAr,
      contentEn: p.contentEn || '',
    });
    setOpen(true);
  }

  async function save() {
    if (!form.titleAr.trim()) {
      toast({ title: 'عنوان الصفحة مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/pages', {
      method: 'POST',
      body: JSON.stringify({ action: 'save', ...form }),
    });
    setSaving(false);
    if (ok && data?.ok) {
      setOpen(false);
      toast({ title: 'تم حفظ الصفحة — نسخة مخصصة الآن ✓' });
      await load();
    } else {
      toast({ title: data?.error || 'تعذر الحفظ', variant: 'destructive' });
    }
  }

  async function remove(p: AdminPage) {
    const builtIn = (INFO_SLUGS as readonly string[]).includes(p.slug);
    if (!(await confirmDialog({ title: 'حذف الصفحة', message: builtIn ? `حذف التعديلات على "${p.titleAr}"؟ ستعود الصفحة إلى النسخة الافتراضية تلقائيًا.` : `حذف صفحة "${p.titleAr}" نهائيًا؟`, confirmText: 'حذف', danger: true }))) return;
    const { ok } = await apiJson('/api/admin/pages', {
      method: 'POST',
      body: JSON.stringify({ action: 'remove', slug: p.slug }),
    });
    if (ok) {
      toast({ title: builtIn ? 'حُذفت التعديلات — الصفحة عادت افتراضية' : 'تم حذف الصفحة' });
      await load();
    }
  }

  async function seedDefaults() {
    setSeeding(true);
    const { ok, data } = await apiJson<{ ok: boolean; seeded?: number; error?: string }>('/api/admin/pages', {
      method: 'POST',
      body: JSON.stringify({ action: 'seedDefaults' }),
    });
    setSeeding(false);
    if (ok && data?.ok) {
      toast({ title: `تم استيراد الصفحات الافتراضية ✓ (${data.seeded ?? 0} صفحة)` });
      await load();
    } else toast({ title: data?.error || 'تعذر الاستيراد', variant: 'destructive' });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden />
          صفحات المتجر الثابتة — تظهر على <span dir="ltr" className="font-bold">/info/…</span> مع نسخة عربية وإنجليزية.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={seedDefaults}
            disabled={seeding}
            variant="outline"
            className="h-11 rounded-full border-primary/30 px-5 font-bold text-primary"
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="ml-1 h-4 w-4 rotate-45" aria-hidden />}
            استيراد الصفحات الافتراضية
          </Button>
          <Button onClick={newPage} className="h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-lg shadow-primary/25">
            <Plus className="ml-1 h-4 w-4" aria-hidden /> صفحة جديدة
          </Button>
        </div>
      </div>

      <p className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        الصفحات المدمجة — كل صفحة تُعرض تلقائيًا في المتجر حتى بدون تعديل! اضغطي أي صفحة لتحريرها:
      </p>

      {pages === null && <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {merged.map((p) => (
          <article key={p.slug} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 font-black">
                  {p.titleAr}
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black tracking-wide text-primary" dir="ltr">EN</span>
                  {p.custom ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">مخصصة</span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">افتراضية</span>
                  )}
                </h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">/info/{p.slug}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={`/info/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary transition-transform hover:scale-110"
                  aria-label="فتح الصفحة"
                  title="فتح الصفحة"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
                <button
                  onClick={() => editPage(p)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary transition-transform hover:scale-110"
                  aria-label="تعديل"
                  title="تعديل"
                >
                  <PencilSmall />
                </button>
                <button
                  onClick={() => remove(p)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive transition-transform hover:scale-110"
                  aria-label={p.custom ? 'حذف' : 'حذف التعديلات'}
                  title={p.custom ? 'حذف' : 'حذف التعديلات'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{p.contentAr || '—'}</p>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              {p.updatedAt ? `آخر تحديث: ${fmtDay(p.updatedAt)}` : 'لم تُعدّليها بعد — النسخة الافتراضية'}
            </p>
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.slug ? `تعديل الصفحة — /info/${form.slug}` : 'صفحة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>عنوان الصفحة (عربي) *</Label>
                <Input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} placeholder="عن لوبنيل" />
              </div>
              <div className="grid gap-1.5">
                <Label>Page title in English</Label>
                <Input dir="ltr" className="text-left" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} placeholder="About LUBNÉL" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>المحتوى (عربي)</Label>
              <textarea
                value={form.contentAr}
                onChange={(e) => setForm({ ...form, contentAr: e.target.value })}
                rows={10}
                className="w-full rounded-xl border border-border bg-card p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="اكتبي محتوى الصفحة هنا…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Content in English</Label>
              <textarea
                dir="ltr"
                className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                value={form.contentEn}
                onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                rows={10}
                placeholder="Write the English version here…"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              الزائر بالعربية يرى النسخة العربية، وبالإنجليزية يرى النسخة الإنجليزية — لو تركتي الإنجليزية فاضية سيظهر النص العربي.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={save} disabled={saving} className="min-w-28 bg-primary font-bold text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'حفظ الصفحة'}
              </Button>
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
