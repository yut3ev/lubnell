'use client';

// U51-GLOBAL-TEXTS — «كل النصوص» — the owner asked: «وسعلي بقا الصلاحيات ف
// النصوص يكون ليا صلاحيه اعدل اي نص وجود ف الموقع بالكامل وغيره».
// One editor over the storefront dictionary (src/lib/i18n.ts DICT): every
// useT() string on the site, grouped by area, AR + EN side by side, with a
// search box and the U49 sticky save bar. Overrides live in StoreSettings
// key "uitexts" and reach the storefront through <TextsProvider> (SSR-safe).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Save, CheckCircle2, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiJson } from '../helpers';
import { DICT } from '@/lib/i18n';
import { TEXT_GROUPS, TEXT_META } from '@/lib/text-keys';

type Pair = { ar: string; en: string };

const DEF_AR = DICT.ar as unknown as Record<string, string>;
const DEF_EN = DICT.en as unknown as Record<string, string>;
const KEYS = Object.keys(TEXT_META);

/** Fields whose defaults read like sentences → give them a textarea. */
const LONG_KEYS = new Set(
  KEYS.filter((k) => (DEF_AR[k] || '').length > 55 || (DEF_EN[k] || '').length > 70)
);

function effective(overrides: Record<string, { ar?: string; en?: string }>): Record<string, Pair> {
  const out: Record<string, Pair> = {};
  for (const k of KEYS) {
    out[k] = {
      ar: overrides[k]?.ar?.trim() || DEF_AR[k] || '',
      en: overrides[k]?.en?.trim() || DEF_EN[k] || '',
    };
  }
  return out;
}

export function TextEverything() {
  const [values, setValues] = useState<Record<string, Pair> | null>(null);
  const [initial, setInitial] = useState<Record<string, Pair> | null>(null);
  const [overriddenKeys, setOverriddenKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    apiJson<{ ok: boolean; overrides: Record<string, { ar?: string; en?: string }> }>('/api/admin/texts')
      .then(({ data }) => {
        const eff = effective(data?.overrides || {});
        setValues(eff);
        setInitial(eff);
        setOverriddenKeys(new Set(Object.keys(data?.overrides || {}).filter((k) => KEYS.includes(k))));
      })
      .catch(() => {
        const eff = effective({});
        setValues(eff);
        setInitial(eff);
      });
  }, []);

  const dirty = useMemo(
    () =>
      values !== null &&
      initial !== null &&
      KEYS.some((k) => values[k].ar !== initial[k].ar || values[k].en !== initial[k].en),
    [values, initial]
  );

  function set(key: string, lang: 'ar' | 'en', value: string) {
    setValues((prev) => (prev ? { ...prev, [key]: { ...prev[key], [lang]: value } } : prev));
  }

  function resetField(key: string) {
    setValues((prev) =>
      prev ? { ...prev, [key]: { ar: DEF_AR[key] || '', en: DEF_EN[key] || '' } } : prev
    );
  }

  async function save() {
    if (!values || !initial || saving) return;
    setSaving(true);
    try {
      // Send only fields whose current value differs from the effective
      // snapshot. A field brought back to the shipped default is sent as ''
      // → the API clears the override so future default edits propagate.
      const payload: Record<string, { ar: string; en: string }> = {};
      for (const k of KEYS) {
        if (values[k].ar === initial[k].ar && values[k].en === initial[k].en) continue;
        payload[k] = {
          ar: values[k].ar.trim() === (DEF_AR[k] || '').trim() ? '' : values[k].ar,
          en: values[k].en.trim() === (DEF_EN[k] || '').trim() ? '' : values[k].en,
        };
      }
      const { ok, data } = await apiJson<{ ok?: boolean; success?: boolean; error?: string }>(
        '/api/admin/texts',
        { method: 'POST', body: JSON.stringify(payload) }
      );
      if (ok && (data?.ok || data?.success)) {
        const fresh = effective(data?.overrides as Record<string, { ar?: string; en?: string }> | undefined);
        toast({ title: 'تم حفظ النصوص ✓ — بتظهر للزوار فورًا' });
        setValues(fresh);
        setInitial(fresh);
        setOverriddenKeys(new Set(Object.keys((data?.overrides as Record<string, unknown>) || {})));
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        toast({ title: data?.error || 'تعذر الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (values === null || initial === null) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const match = (k: string) =>
    !q ||
    TEXT_META[k].label.toLowerCase().includes(q) ||
    k.toLowerCase().includes(q) ||
    values[k].ar.toLowerCase().includes(q) ||
    values[k].en.toLowerCase().includes(q);

  const changedCount = KEYS.filter(
    (k) => values[k].ar !== initial[k].ar || values[k].en !== initial[k].en
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">كل النصوص — تحكم كامل في لغة الموقع</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            عدّلي أي نص يظهر للزوار بالعربي أو الإنجليزي — التغيير يظهر فورًا بعد الحفظ.
            {overriddenKeys.size > 0 && (
              <span className="ms-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                {overriddenKeys.size} نص مُعدّل
              </span>
            )}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحثي في النصوص…"
            className="h-10 rounded-full pe-9"
            aria-label="البحث في النصوص"
          />
        </div>
      </div>

      {TEXT_GROUPS.map((g) => {
        const fields = KEYS.filter((k) => TEXT_META[k].group === g.id && match(k));
        if (fields.length === 0) return null;
        return (
          <fieldset key={g.id} className="rounded-3xl border border-border/70 bg-card p-5">
            <legend className="px-2 text-sm font-black text-primary">{g.title}</legend>
            <div className="mt-2 grid gap-4">
              {fields.map((k) => (
                <div key={k} className="grid gap-2 rounded-2xl border border-border/50 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={`tx-${k}`} className="text-xs">
                      {TEXT_META[k].label}
                      {overriddenKeys.has(k) && (
                        <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                          مُعدّل
                        </span>
                      )}
                    </Label>
                    {(values[k].ar !== initial[k].ar || values[k].en !== initial[k].en || overriddenKeys.has(k)) && (
                      <button
                        type="button"
                        onClick={() => resetField(k)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-destructive"
                        title="إرجاع النص الافتراضي"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden /> استرجاع الأصلي
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LONG_KEYS.has(k) ? (
                      <>
                        <textarea
                          id={`tx-${k}-ar`}
                          rows={2}
                          value={values[k].ar}
                          onChange={(e) => set(k, 'ar', e.target.value)}
                          placeholder={DEF_AR[k]}
                          className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <textarea
                          id={`tx-${k}-en`}
                          rows={2}
                          dir="ltr"
                          value={values[k].en}
                          onChange={(e) => set(k, 'en', e.target.value)}
                          placeholder={DEF_EN[k]}
                          className="rounded-xl border border-input bg-background px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </>
                    ) : (
                      <>
                        <Input
                          id={`tx-${k}-ar`}
                          value={values[k].ar}
                          onChange={(e) => set(k, 'ar', e.target.value)}
                          placeholder={DEF_AR[k]}
                          className="bg-background"
                        />
                        <Input
                          id={`tx-${k}-en`}
                          dir="ltr"
                          className="bg-background text-left"
                          value={values[k].en}
                          onChange={(e) => set(k, 'en', e.target.value)}
                          placeholder={DEF_EN[k]}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}

      {/* U49-style sticky save bar — the form is long, the save button must
          always be within reach while editing texts. */}
      <div className="sticky bottom-4 z-20">
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl shadow-black/10 backdrop-blur-md">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
              dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}
            aria-live="polite"
          >
            {dirty
              ? `${changedCount} تغيير غير محفوظ — احفظي لتظهر للزوار`
              : 'كل التغييرات محفوظة ✓'}
          </span>
          <Button
            onClick={save}
            disabled={saving}
            className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : savedFlash ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        ملاحظة: «استرجاع الأصلي» يرجع النص الافتراضي المرفق مع المتجر. امتياز
        «sections.write» يحدد من يمكنه التعديل — يُدار من «الفريق».
      </p>
    </div>
  );
}
