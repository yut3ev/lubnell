'use client';

import { confirmDialog } from '@/components/ui/confirm-service';


// U17-HOME-EDITOR — «محرر السلايدر» rebuilt to the owner's target shape:
// أقسام الصفحة (hide/show + template per homepage section, published live),
// الشرائح panel with drag-to-reorder, an inline تفاصيل الشريحة editor and a
// معاينة مباشرة strip — one «نشر التغييرات» button publishes everything.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Film, GripVertical, Home, Loader2, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { apiJson, loadAdminToken } from '../helpers';
import ImageField from '../image-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  HOME_SECTION_META,
  HOME_SECTION_ORDER,
  resolveHomeSections,
  type HeroHeight,
  type HomeSectionsConfig,
  type SectionKey,
} from '@/lib/home-sections-config';

type Slide = {
  id: string;
  eyebrow: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  ctaAr: string;
  ctaEn: string;
  image: string;
  imageMobile: string; // U21-MOBILE-HERO — portrait crop for phones ('' = none)
  video: string; // '' = no video
  href: string;
  active: boolean;
  sortOrder: number;
};

const EMPTY_SLIDE = (id: string): Slide => ({
  id,
  eyebrow: 'LUBNÉL / NEW COLLECTION',
  titleAr: '',
  titleEn: '',
  bodyAr: '',
  bodyEn: '',
  ctaAr: 'تسوّقي الآن',
  ctaEn: 'Shop now',
  image: '',
  imageMobile: '',
  video: '',
  href: '/c/all',
  active: true,
  sortOrder: 99,
});

// U19-VIDEO — upload an MP4 from the device straight into the media library
async function uploadVideoFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const token = loadAdminToken();
  const res = await fetch('/api/admin/media', {
    method: 'POST',
    body: form,
    headers: token ? { 'x-admin-token': token } : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !(data?.ok || data?.success) || !data.url) {
    throw new Error(data?.error || 'تعذر رفع الفيديو');
  }
  return data.url as string;
}

export default function HomepageSection() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [cfg, setCfg] = useState<HomeSectionsConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [ctaVideoUploading, setCtaVideoUploading] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);
  const ctaVideoRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [slidesRes, cfgRes] = await Promise.all([
      apiJson<{ ok: boolean; slides: Slide[] }>('/api/admin/slides'),
      apiJson<{ ok: boolean; config: HomeSectionsConfig }>('/api/admin/home-sections'),
    ]);
    const loaded = slidesRes.ok && slidesRes.data?.ok ? slidesRes.data.slides : [];
    loaded.sort((a, b) => a.sortOrder - b.sortOrder);
    // normalize video/imageMobile (DB null → '') so the editor always has a string
    for (const s of loaded) {
      (s as Slide).video = typeof (s as Partial<Slide>).video === 'string' ? (s as Partial<Slide>).video! : '';
      (s as Slide).imageMobile =
        typeof (s as Partial<Slide>).imageMobile === 'string' ? (s as Partial<Slide>).imageMobile! : '';
    }
    setSlides(loaded);
    setSelectedId((prev) => prev ?? loaded[0]?.id ?? null);
    if (cfgRes.ok && cfgRes.data?.config) setCfg(cfgRes.data.config);
    else setCfg(resolveHomeSections({}));
    setDirty(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const selected = slides?.find((s) => s.id === selectedId) ?? null;

  function patchSelected(patch: Partial<Slide>) {
    if (!selectedId) return;
    setSlides((prev) => (prev ?? []).map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    setDirty(true);
  }

  /** U22 — patch one section's config (الأبعاد والمظهر / وسائط البانر). */
  function patchCfg(key: SectionKey, patch: Partial<HomeSectionsConfig[SectionKey]>) {
    setCfg((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: { ...prev[key], ...patch } };
    });
    setDirty(true);
  }

  /** U22 — upload an MP4 for the CTA banner media panel. */
  async function handleCtaVideoUpload(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: 'الملف لازم يكون فيديو (MP4)', variant: 'destructive' });
      return;
    }
    setCtaVideoUploading(true);
    try {
      const url = await uploadVideoFile(file);
      patchCfg('whatsapp', { bannerVideo: url });
      toast({ title: 'تم رفع فيديو البانر — انشري التغييرات للنشر ✓' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'تعذر رفع الفيديو', variant: 'destructive' });
    } finally {
      setCtaVideoUploading(false);
      if (ctaVideoRef.current) ctaVideoRef.current.value = '';
    }
  }

  // U19-VIDEO — upload MP4 from the device and attach it to the slide
  async function handleVideoUpload(file: File | undefined | null) {
    if (!file || !selectedId) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: 'الملف لازم يكون فيديو (MP4)', variant: 'destructive' });
      return;
    }
    setVideoUploading(true);
    try {
      const url = await uploadVideoFile(file);
      patchSelected({ video: url });
      toast({ title: 'تم رفع الفيديو — انشري التغييرات للنشر ✓' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'تعذر رفع الفيديو', variant: 'destructive' });
    } finally {
      setVideoUploading(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  function moveSlide(from: number, to: number) {
    setSlides((prev) => {
      if (!prev) return prev;
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDirty(true);
  }

  function addSlide() {
    const id = `slide-${Date.now()}`;
    setSlides((prev) => [...(prev ?? []), { ...EMPTY_SLIDE(id), sortOrder: (prev?.length ?? 0) + 1 }]);
    setSelectedId(id);
    setDirty(true);
    toast({ title: 'شريحة جديدة — املئي التفاصيل ثم انشري التغييرات' });
  }

  async function removeSlide(id: string) {
    if (!(await confirmDialog({ title: 'حذف الشريحة', message: 'حذف هذه الشريحة نهائيًا من الصفحة الرئيسية؟', confirmText: 'حذف نهائي', danger: true }))) return;
    const { ok } = await apiJson('/api/admin/slides', {
      method: 'POST',
      body: JSON.stringify({ action: 'remove', id }),
    });
    if (ok) {
      toast({ title: 'تم حذف الشريحة' });
      const rest = (slides ?? []).filter((s) => s.id !== id);
      setSlides(rest);
      if (selectedId === id) setSelectedId(rest[0]?.id ?? null);
    }
  }

  /** ONE publish button — sections config + slide order + edited slide fields. */
  async function publish() {
    if (!slides || !cfg) return;
    setPublishing(true);
    try {
      // 1) sections visibility/templates
      const cfgRes = await apiJson<{ ok: boolean; error?: string }>('/api/admin/home-sections', {
        method: 'POST',
        body: JSON.stringify({ config: cfg }),
      });
      if (!cfgRes.ok || !cfgRes.data?.ok) throw new Error(cfgRes.data?.error || 'تعذر حفظ الأقسام');

      // 2) every slide: current order + current fields (new slides included)
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const res = await apiJson<{ ok: boolean; error?: string }>('/api/admin/slides', {
          method: 'POST',
          body: JSON.stringify({ action: 'upsert', ...s, sortOrder: i + 1 }),
        });
        if (!res.ok || !res.data?.ok) throw new Error(res.data?.error || `تعذر حفظ الشريحة ${i + 1}`);
      }

      toast({ title: 'تم نشر التغييرات ✓ — الصفحة الرئيسية تحدثت للزوار' });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'تعذر النشر', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  }

  if (!slides || !cfg)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  return (
    <div className="space-y-5">
      {/* head — matches the owner's target: title + desc + شريحة جديدة + نشر التغييرات */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Home className="h-5 w-5 text-primary" aria-hidden /> محرر السلايدر
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">تحكّمي في شرائح الصفحة الرئيسية، النصوص، الصور، والترتيب.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700">
              تغييرات غير منشورة
            </span>
          )}
          <Button
            variant="outline"
            onClick={addSlide}
            className="h-11 rounded-full border-primary/30 font-bold text-primary"
          >
            <Plus className="h-4 w-4" aria-hidden /> شريحة جديدة
          </Button>
          <Button
            onClick={publish}
            disabled={publishing}
            className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            نشر التغييرات
          </Button>
        </div>
      </div>

      {/* أقسام الصفحة — visibility + template per homepage section */}
      <section className="rounded-2xl border border-border/60 bg-card shadow-sm" aria-label="أقسام الصفحة">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-black">أقسام الصفحة</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">إخفاء القسم أو تغيير الـTemplate ثم معاينة النتيجة</p>
        </div>
        <ul>
          {HOME_SECTION_ORDER.map((key, i) => {
            const meta = HOME_SECTION_META[key];
            const st = cfg[key];
            return (
              <li
                key={key}
                className={`flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-3 last:border-b-0 ${!st.visible ? 'opacity-55' : ''}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                <span className="w-7 shrink-0 text-center text-sm font-black text-muted-foreground">{meta.num}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black" dir="auto">{meta.labelAr}</span>
                  <span className="block text-[11px] text-muted-foreground" dir="ltr">{meta.labelEn}</span>
                </span>
                <button
                  onClick={() => {
                    setCfg({ ...cfg, [key]: { ...st, visible: !st.visible } });
                    setDirty(true);
                  }}
                  role="switch"
                  aria-checked={st.visible}
                  aria-label={`${st.visible ? 'إخفاء' : 'إظهار'} ${meta.labelAr}`}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                    st.visible ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  {st.visible ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
                </button>
                <div className="relative shrink-0">
                  <select
                    value={st.template}
                    onChange={(e) => {
                      setCfg({ ...cfg, [key]: { ...st, template: e.target.value as typeof st.template } });
                      setDirty(true);
                    }}
                    aria-label={`Template ${meta.labelAr}`}
                    className="h-10 appearance-none rounded-xl border border-border bg-background pl-9 pr-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {meta.templates.map((t) => (
                      <option key={t.value} value={t.value}>{t.labelAr}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                </div>
                {/* U19-SLIDER + U22 — حجم السلايدر (hero only): 4 presets */}
                {key === 'hero' && (
                  <div className="relative shrink-0">
                    <select
                      value={cfg.hero.height || 'default'}
                      onChange={(e) => {
                        setCfg({ ...cfg, hero: { ...cfg.hero, height: e.target.value as HeroHeight } });
                        setDirty(true);
                      }}
                      aria-label="حجم وابعاد الشرائح"
                      className="h-10 appearance-none rounded-xl border border-border bg-background pl-9 pr-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="short">مضغوط</option>
                      <option value="default">قياسي</option>
                      <option value="tall">طويل</option>
                      <option value="fill">ملئ تقريبًا</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  </div>
                )}
                {/* U22 — الأبعاد والمُظهر: per-device heights + text position + gradient strength */}
                {key === 'hero' && (
                  <div className="w-full basis-full rounded-2xl border border-primary/20 bg-secondary/30 p-4">
                    <p className="text-sm font-black">الأبعاد والمُظهر</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">حجم وارتفاع الشريحة على كل جهاز + قوة التدرج اللوني</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-h-desktop">الارتفاع — كمبيوتر (px)</Label>
                        <Input
                          id="hero-h-desktop"
                          type="number"
                          min={320}
                          max={1100}
                          value={cfg.hero.heightDesktop ?? 500}
                          onChange={(e) => patchCfg('hero', { heightDesktop: Number(e.target.value) || undefined })}
                        />
                        <span className="text-[10px] text-muted-foreground" dir="ltr">320px — 1100</span>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-h-tablet">الارتفاع — تابلت (px)</Label>
                        <Input
                          id="hero-h-tablet"
                          type="number"
                          min={280}
                          max={1100}
                          value={cfg.hero.heightTablet ?? 440}
                          onChange={(e) => patchCfg('hero', { heightTablet: Number(e.target.value) || undefined })}
                        />
                        <span className="text-[10px] text-muted-foreground" dir="ltr">280px — 1100</span>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-h-mobile">الارتفاع — موبايل (px)</Label>
                        <Input
                          id="hero-h-mobile"
                          type="number"
                          min={260}
                          max={900}
                          value={cfg.hero.heightMobile ?? 420}
                          onChange={(e) => patchCfg('hero', { heightMobile: Number(e.target.value) || undefined })}
                        />
                        <span className="text-[10px] text-muted-foreground" dir="ltr">260px — 900</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-textpos">موضع النص</Label>
                        <div className="relative">
                          <select
                            id="hero-textpos"
                            value={cfg.hero.textPos || 'center'}
                            onChange={(e) => patchCfg('hero', { textPos: e.target.value as 'center' | 'start' })}
                            className="h-10 w-full appearance-none rounded-xl border border-border bg-background pl-9 pr-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="center">في الوسط عموديًا (المتّزازي)</option>
                            <option value="start">أسفل الشريحة</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-overlay">
                          قوة التدرج اللوني — <span className="font-black text-primary">{cfg.hero.overlay ?? 60}%</span>
                        </Label>
                        <input
                          id="hero-overlay"
                          type="range"
                          min={0}
                          max={90}
                          step={5}
                          value={cfg.hero.overlay ?? 60}
                          onChange={(e) => patchCfg('hero', { overlay: Number(e.target.value) })}
                          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[var(--primary)]"
                        />
                        <span className="text-[10px] text-muted-foreground">0% بدون تعتيم — 90% أغمق وأوضح للنصوص</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* U22 — وسائط بانر الدعوة: image/video behind the CTA gradient */}
                {key === 'whatsapp' && (
                  <div className="w-full basis-full rounded-2xl border border-primary/20 bg-secondary/30 p-4">
                    <p className="text-sm font-black">وسائط بانر الدعوة (بانر اسألي لُو)</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">صورة أو فيديو خلفية للبانر — يظل التدرج اللوني كجزء من التصميم</p>
                    <div className="mt-3 grid gap-3">
                      <div className="grid gap-1.5">
                        <Label>صورة البانر (اختياري)</Label>
                        <ImageField
                          value={cfg.whatsapp.bannerImage || ''}
                          onChange={(url) => patchCfg('whatsapp', { bannerImage: url })}
                          placeholder="/images/hero-2.png"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>فيديو البانر (اختياري)</Label>
                        {cfg.whatsapp.bannerVideo ? (
                          <div className="grid gap-2">
                            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black">
                              <video
                                src={cfg.whatsapp.bannerVideo}
                                poster={cfg.whatsapp.bannerImage || undefined}
                                muted
                                loop
                                autoPlay
                                playsInline
                                className="max-h-44 w-full object-cover"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                dir="ltr"
                                className="text-left text-xs"
                                value={cfg.whatsapp.bannerVideo}
                                onChange={(e) => patchCfg('whatsapp', { bannerVideo: e.target.value })}
                                aria-label="رابط فيديو البانر"
                                placeholder="/uploads/banner.mp4 أو رابط خارجي"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => patchCfg('whatsapp', { bannerVideo: '' })}
                                className="shrink-0 gap-1 rounded-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden /> مسح الفيديو
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-background/60 p-3">
                            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.03]">
                              {ctaVideoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
                              ارفعي فيديو للبانر
                              <input
                                ref={ctaVideoRef}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime"
                                className="hidden"
                                onChange={(e) => void handleCtaVideoUpload(e.target.files?.[0])}
                              />
                            </label>
                            <Input
                              dir="ltr"
                              className="h-9 max-w-xs flex-1 text-left text-xs"
                              value={cfg.whatsapp.bannerVideo || ''}
                              onChange={(e) => patchCfg('whatsapp', { bannerVideo: e.target.value })}
                              aria-label="رابط فيديو البانر"
                              placeholder="أو الصقي رابط فيديو هنا"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <span className="hidden w-6 text-center text-[11px] font-bold text-muted-foreground/60 sm:block" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        {/* الشرائح — drag to reorder */}
        <section className="rounded-2xl border border-border/60 bg-card shadow-sm" aria-label="الشرائح">
          <div className="border-b border-border/50 px-5 py-4">
            <h3 className="text-sm font-black">الشرائح ({slides.length})</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">اسحبي لإعادة الترتيب — أو استخدمي الأسهم</p>
          </div>
          <ul className="p-2">
            {slides.map((s, i) => (
              <li
                key={s.id}
                draggable
                onDragStart={() => { dragFrom.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom.current !== null) moveSlide(dragFrom.current, i);
                  dragFrom.current = null;
                }}
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-right transition-colors ${
                    selectedId === s.id
                      ? 'border-primary/40 bg-secondary'
                      : 'border-transparent hover:bg-secondary/60'
                  }`}
                  aria-pressed={selectedId === s.id}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-stone-300'}`}
                    aria-hidden
                  />
                  <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary/60">
                    {s.image ? (
                      <img src={s.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">بدون صورة</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{s.titleAr.replace('\n', ' ') || 'شريحة بدون عنوان'}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {s.active ? 'منشور · ظاهر للزوار' : 'مخفية · غير ظاهرة'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col gap-0.5" aria-hidden>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); moveSlide(i, i - 1); }}
                      className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-background"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); moveSlide(i, i + 1); }}
                      className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-background"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {slides.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                لا توجد شرائح — أضيفي أول شريحة وستحل محل الشرائح الافتراضية.
              </li>
            )}
          </ul>
        </section>

        {/* تفاصيل الشريحة + معاينة مباشرة */}
        {selected && (
          <section className="space-y-4" aria-label="تفاصيل الشريحة">
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground" dir="ltr">SLIDE / {String(slides.indexOf(selected) + 1).padStart(2, '0')}</p>
                  <h3 className="mt-0.5 text-sm font-black">تفاصيل الشريحة</h3>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground">
                    إظهار الشريحة
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={(e) => patchSelected({ active: e.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                      aria-label="إظهار الشريحة على الموقع"
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSlide(selected.id)}
                    className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> حذف
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>عنوان عربي</Label>
                  <textarea
                    rows={2}
                    value={selected.titleAr}
                    onChange={(e) => patchSelected({ titleAr: e.target.value })}
                    placeholder="جمالكِ&#10;بطريقتكِ."
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>عنوان إنجليزي</Label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={selected.titleEn}
                    onChange={(e) => patchSelected({ titleEn: e.target.value })}
                    placeholder="Beauty&#10;your way."
                    className="rounded-xl border border-input bg-background px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>النص العربي</Label>
                  <textarea
                    rows={2}
                    value={selected.bodyAr}
                    onChange={(e) => patchSelected({ bodyAr: e.target.value })}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>النص الإنجليزي</Label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={selected.bodyEn}
                    onChange={(e) => patchSelected({ bodyEn: e.target.value })}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Eyebrow</Label>
                  <Input dir="ltr" className="text-left" value={selected.eyebrow} onChange={(e) => patchSelected({ eyebrow: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>نص الزر</Label>
                  <Input value={selected.ctaAr} onChange={(e) => patchSelected({ ctaAr: e.target.value })} />
                </div>
                {/* U22 — CTA EN pair (already stored per slide; editor field was missing) */}
                <div className="grid gap-1.5">
                  <Label>نص الزر (إنجليزي)</Label>
                  <Input dir="ltr" className="text-left" value={selected.ctaEn} onChange={(e) => patchSelected({ ctaEn: e.target.value })} placeholder="Shop now" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>صورة الشريحة</Label>
                  <ImageField value={selected.image} onChange={(url) => patchSelected({ image: url })} placeholder="/uploads/example.jpg" variant="hero" />
                </div>
                {/* U21-MOBILE-HERO — صورة الموبايل (طولية/مربعة) — اختياري */}
                <div className="grid gap-2 sm:col-span-2">
                  <Label>صورة الموبايل (طولية/مربعة — اختياري)</Label>
                  <p className="text-xs text-muted-foreground">
                    تظهر مكان الصورة الأساسية على شاشات الموبايل فقط. لو سيبتها فاضية، الموبايل يقصّ الصورة الأساسية تلقائيًا.
                  </p>
                  <ImageField
                    value={selected.imageMobile}
                    onChange={(url) => patchSelected({ imageMobile: url })}
                    placeholder="/uploads/example-mobile.jpg"
                    variant="hero"
                  />
                </div>
                {/* U19-VIDEO — فيديو الشريحة (اختياري) */}
                <div className="grid gap-2 sm:col-span-2">
                  <Label>فيديو الشريحة (اختياري — MP4 حتى 80MB)</Label>
                  {selected.video ? (
                    <div className="grid gap-2">
                      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black">
                        <video
                          src={selected.video}
                          poster={selected.image || undefined}
                          muted
                          loop
                          autoPlay
                          playsInline
                          className="max-h-52 w-full object-cover"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          dir="ltr"
                          className="text-left text-xs"
                          value={selected.video}
                          onChange={(e) => patchSelected({ video: e.target.value })}
                          aria-label="رابط الفيديو"
                          placeholder="/uploads/video.mp4 أو رابط خارجي"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => patchSelected({ video: '' })}
                          className="shrink-0 gap-1 rounded-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden /> مسح الفيديو
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/30 p-3">
                      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.03]">
                        {videoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
                        رفع فيديو من الجهاز
                        <input
                          ref={videoRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e) => void handleVideoUpload(e.target.files?.[0])}
                        />
                      </label>
                      <Input
                        dir="ltr"
                        className="h-9 max-w-xs flex-1 text-left text-xs"
                        value={selected.video}
                        onChange={(e) => patchSelected({ video: e.target.value })}
                        aria-label="رابط الفيديو"
                        placeholder="أو الصقي رابط فيديو هنا"
                      />
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Film className="h-3.5 w-3.5" aria-hidden />
                        الفيديو يشتغل تلقائيًا بدون صوت في الهيرو، والصورة تبقى خلفية قبل التحميل.
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>رابط الزر</Label>
                  <Input dir="ltr" className="text-left" value={selected.href} onChange={(e) => patchSelected({ href: e.target.value })} placeholder="/c/all" />
                </div>
              </div>

              {/* U49-STUDIO-SAVE — «مفيش زرار حف للتعديللات ف النصوص علشان تتحدث ف الموقع»:
                  زر النشر الوحيد كان أعلى اللوحة ويخرج من الشاشة مع طول فورم الشريحة —
                  الحل: شريط حفظ ثابت أسفل المحرر يبقى ظاهرًا طول وقت التعديل
                  وينشر من نفس publish() — مصدر واحد للحقيقة بلا ازدواج. */}
              <div className="sticky bottom-4 z-20 px-5 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl shadow-black/10 backdrop-blur-md">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                      dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                    aria-live="polite"
                  >
                    {dirty ? 'تغييرات غير منشورة — احفظي لتظهر للزوار' : 'كل التغييرات منشورة ✓'}
                  </span>
                  <Button
                    onClick={publish}
                    disabled={publishing}
                    className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25"
                  >
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                    حفظ ونشر التغييرات
                  </Button>
                </div>
              </div>
            </div>

            {/* معاينة مباشرة */}
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
                <h3 className="text-sm font-black">معاينة مباشرة</h3>
                <a href="/" target="_blank" rel="noreferrer" className="text-xs font-bold text-primary underline-offset-2 hover:underline">
                  فتح الصفحة للمعاينة ↗
                </a>
              </div>
              <div className="p-4">
                <div className="relative h-44 overflow-hidden rounded-2xl sm:h-52">
                  {selected.video ? (
                    <video
                      src={selected.video}
                      poster={selected.image || undefined}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : selected.image ? (
                    <img src={selected.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-secondary" />
                  )}
                  {/* U22 — the preview respects قوة التدرج + موضع النص from الأبعاد والمُظهر */}
                  <div
                    className="absolute inset-0 bg-gradient-to-l from-primary/85 via-primary/45 to-transparent"
                    aria-hidden
                    style={{ opacity: (cfg.hero.overlay ?? 60) / 85 }}
                  />
                  <div className={`absolute inset-0 flex ${cfg.hero.textPos === 'start' ? 'items-end pb-6' : 'items-center'} justify-end px-6`}>
                    <div className="max-w-xs text-primary-foreground">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-85" dir="ltr">{selected.eyebrow}</p>
                      <p className="mt-2 whitespace-pre-line text-2xl font-black leading-tight">{selected.titleAr || 'العنوان هنا'}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs opacity-90">{selected.bodyAr}</p>
                      <span className="mt-3 inline-block rounded-full bg-[rgb(253,246,242)] px-4 py-1.5 text-xs font-black text-[rgb(180,90,60)]">
                        {selected.ctaAr || 'تسوّقي الآن'} ←
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
