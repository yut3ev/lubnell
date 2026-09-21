'use client';

// Studio → «أقسام الموقع» — edit any section text on the storefront
// (home trust strip, section headings, CTA banner, PDP related heading).
// Permission-gated: sections.read / sections.write (owner has all).
import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiJson } from '../helpers';

type Sections = Record<string, string>;

const GROUPS: { title: string; fields: { key: string; label: string; ph?: string }[] }[] = [
  {
    title: 'شريط الثقة (أعلى الرئيسية)',
    fields: [
      { key: 'trust1TitleAr', label: 'العنصر 1 — العنوان' },
      { key: 'trust1SubAr', label: 'العنصر 1 — الوصف' },
      { key: 'trust2TitleAr', label: 'العنصر 2 — العنوان' },
      { key: 'trust2SubAr', label: 'العنصر 2 — الوصف' },
      { key: 'trust3TitleAr', label: 'العنصر 3 — العنوان' },
      { key: 'trust3SubAr', label: 'العنصر 3 — الوصف' },
    ],
  },
  {
    title: 'قسم الفئات',
    fields: [
      { key: 'categoriesTitleAr', label: 'العنوان الرئيسي' },
      { key: 'categoriesSubAr', label: 'الوصف' },
    ],
  },
  {
    title: 'قسم الأكثر رواجًا',
    fields: [
      { key: 'featuredTitleAr', label: 'العنوان الرئيسي' },
      { key: 'featuredSubAr', label: 'الوصف' },
    ],
  },
  {
    title: 'بانر الدعوة (CTA)',
    fields: [
      { key: 'ctaTitleAr', label: 'العنوان' },
      { key: 'ctaSubAr', label: 'النص' },
    ],
  },
  {
    title: 'صفحة المنتج',
    fields: [
      { key: 'relatedAr', label: 'عنوان «منتجات مشابهة»', ph: 'كمّلي طقسكِ' },
    ],
  },
];

export function SectionsEditor() {
  const [sections, setSections] = useState<Sections | null>(null);
  const [initial, setInitial] = useState<Sections | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    apiJson<{ ok: boolean; sections: Sections }>('/api/admin/sections')
      .then(({ data }) => {
        const s = (data as { sections?: Sections })?.sections || {};
        setSections(s);
        setInitial(s);
      })
      .catch(() => {
        setSections({});
        setInitial({});
      });
  }, []);

  /* U49-STUDIO-SAVE — تتبع التعديلات غير المحفوظة لشريط الحفظ الثابت */
  const dirty =
    sections !== null && initial !== null && JSON.stringify(sections) !== JSON.stringify(initial);

  function set(key: string, value: string) {
    setSections((s) => ({ ...(s || {}), [key]: value }));
  }

  async function save() {
    if (!sections || saving) return;
    setSaving(true);
    try {
      const payload: Sections = {};
      for (const g of GROUPS) for (const f of g.fields) payload[f.key] = sections[f.key] || '';
      const { data: d } = await apiJson<{ ok?: boolean; success?: boolean; error?: string }>('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (d?.ok || d?.success) {
        toast({ title: 'تم حفظ نصوص الأقسام ✅' });
        setInitial(sections); // U49-STUDIO-SAVE — بعد الحفظ الحالة نظيفة
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        toast({ title: d?.error || 'تعذر الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (sections === null) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">أقسام الموقع — نصوص وصور</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            عدّل أي نص يظهر في أقسام المتجر. التغييرات تظهر فورًا في الواجهة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSections({})}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            title="مسح كل التخصيصات (تُستبدل بالنصوص الافتراضية)"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            استرجاع الافتراضي
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="h-10 rounded-full bg-primary px-5 font-bold text-primary-foreground"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : savedFlash ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {GROUPS.map((g) => (
        <fieldset key={g.title} className="rounded-3xl border border-border/70 bg-card p-5">
          <legend className="px-2 text-sm font-black text-primary">{g.title}</legend>
          <div className="mt-2 grid gap-3.5 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={f.key} className="grid gap-1.5">
                <Label htmlFor={`sec-${f.key}`}>{f.label}</Label>
                <Input
                  id={`sec-${f.key}`}
                  value={sections[f.key] || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.ph}
                  className="bg-background"
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <p className="text-xs leading-relaxed text-muted-foreground">
        ملاحظة: ترك أي حقل فارغًا يعيد النص الافتراضي. امتياز «sections.write» يحدد من يمكنه التعديل —
        يُدار من «الفريق».
      </p>

      {/* U49-STUDIO-SAVE — نفس معالجة محرر الشريحة: زر الحفظ يفضل ظاهرًا وأنتِ بتعدّلي النصوص
          بدل ما يضيع أعلى الصفحة مع طول الفورم. */}
      <div className="sticky bottom-4 z-20">
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl shadow-black/10 backdrop-blur-md">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
              dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}
            aria-live="polite"
          >
            {dirty ? 'تغييرات غير محفوظة — احفظي لتظهر للزوار' : 'كل التغييرات محفوظة ✓'}
          </span>
          <Button
            onClick={save}
            disabled={saving}
            className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : savedFlash ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            حفظ التغييرات
          </Button>
        </div>
      </div>
    </div>
  );
}
