'use client';

// U15/U22 — «الإعدادات» rebuilt to the owner's 10-screenshot reference:
// tabs بيانات المتجر / الشحن والدفع / النصوص والفوتر / الثيم والألوان /
// الهوية البصرية / SEO / الفريق والصلاحيات / Backup / Export — every field
// from her reference (currency picker, footer & links group, EN SEO pair,
// brand name/tagline/favicon/Instagram + the brand font gallery, and the
// 3-card Backup/Export row).

import { useEffect, useRef, useState } from 'react';
import { Check, Database, Download, FileJson, FileSpreadsheet, Loader2, Lock, LockOpen, Save, Trash2, Upload, Wrench } from 'lucide-react';
import { apiJson, loadAdminToken } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import ContentSection from './content';
import ThemeSection from './theme';
import UsersSection from './users';
import ImageField from '../image-field';
import { BRAND_FONTS, BRAND_FONT_TAGS, brandFontById, googleFontsHref } from '@/lib/brand-fonts';
import type { SiteTexts } from '@/lib/site-texts';
import { resolveVideoSource } from '@/lib/video-embed';

type StoreSettings = {
  storeName?: string;
  email?: string;
  whatsappNumber?: string;
  currency?: string;
  shippingFee?: number;
  freeShippingThreshold?: number;
  minOrderTotal?: number;
  deliveryTime?: string;
  codEnabled?: boolean;
  whatsappMessage?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  storeDescriptionAr?: string;
  announcementAr?: string;
  announcementEn?: string;
};

type BrandSettings = {
  logoLight?: string;
  logoDark?: string;
  logoSquare?: string;
  brandName?: string;
  brandTagline?: string;
  favicon?: string;
  instagramHandle?: string;
  brandFont?: string;
};

type SeoSettings = {
  metaTitleAr?: string;
  metaTitleEn?: string;
  metaDescriptionAr?: string;
  metaDescriptionEn?: string;
  metaKeywords?: string;
  ogImage?: string;
};

// U77-MAINTENANCE-MODE — site open/close switch + custom maintenance message
// U78 — + emblem video (her own animation above the text)
type SiteStatusSettings = {
  enabled?: boolean;
  message?: string;
  video?: string;
  updatedAt?: string;
};

// U78 — upload an animation (webm/mp4) from the device into the media library
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

// U81 — remove an old maintenance video by its /api/uploads URL (row + disk
// file) so repeated uploads never pile up copies. Best-effort: the media
// DELETE endpoint reference-checks first, so an asset still used elsewhere
// is refused and nothing can break.
async function cleanupMediaAsset(url: string): Promise<void> {
  try {
    const { data } = await apiJson<{ ok: boolean; media?: Array<{ id: string; url: string }> }>('/api/admin/media');
    const asset = data?.media?.find((m) => m.url === url);
    if (!asset) return;
    await apiJson(`/api/admin/media?id=${asset.id}`, { method: 'DELETE' });
  } catch {
    // best-effort — never block the upload flow
  }
}

const TABS = [
  { id: 'store', label: 'بيانات المتجر' },
  { id: 'shipping', label: 'الشحن والدفع' },
  { id: 'texts', label: 'النصوص والفوتر' },
  { id: 'theme', label: 'الثيم والألوان' },
  { id: 'brand', label: 'الهوية البصرية' },
  { id: 'seo', label: 'SEO' },
  { id: 'perms', label: 'الفريق والصلاحيات' },
  { id: 'backup', label: 'Backup / Export' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsSection({ currentId }: { currentId?: string }) {
  const [tab, setTab] = useState<TabId>('store');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-full border px-4 py-2 text-xs font-black transition-all ${
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border/60 bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'store' && <StoreTab />}
      {tab === 'shipping' && <ShippingTab />}
      {tab === 'texts' && <ContentSection />}
      {tab === 'theme' && <ThemeSection />}
      {tab === 'brand' && <BrandTab />}
      {tab === 'seo' && <SeoTab />}
      {tab === 'perms' && <UsersSection currentId={currentId} />}
      {tab === 'backup' && <BackupTab />}
    </div>
  );
}

/* ---------- shared bits ---------- */

const card = 'grid gap-4 rounded-2xl border border-border/60 bg-card p-5';
const field = 'grid gap-1.5';

function SaveBar({ saving, onClick, label }: { saving: boolean; onClick: () => void; label: string }) {
  return (
    <Button onClick={onClick} disabled={saving} className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25">
      {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <><Save className="ml-1 h-4 w-4" aria-hidden /> {label}</>}
    </Button>
  );
}

function useSettingsBag<T extends object>(key: string) {
  const [form, setForm] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { ok, data } = await apiJson<{ ok: boolean; settings: T | null }>(`/api/admin/settings?key=${key}`);
    if (ok && (data?.ok || data?.settings !== undefined)) setForm(data.settings || ({} as T));
    else setForm({} as T);
  };

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [key]);


  async function persist(patch?: Partial<T>) {
    if (!form) return false;
    setSaving(true);
    const body = { key, ...form, ...patch };
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (ok && (data?.ok || data?.success)) return true;
    toast({ title: data?.error || 'تعذر الحفظ', variant: 'destructive' });
    return false;
  }

  return { form, setForm, saving, persist, setSaving };
}

/* ---------- 1. بيانات المتجر ---------- */

const CURRENCY_OPTIONS = [
  { value: '', label: 'افتراضي — ج.م' },
  { value: 'ج.م', label: 'ج.م — جنيه مصري' },
  { value: 'EGP', label: 'EGP — جنيه مصري' },
  { value: 'SAR', label: 'SAR — ريال سعودي' },
  { value: 'AED', label: 'AED — درهم إماراتي' },
  { value: 'USD', label: 'USD — دولار أمريكي' },
];

// U77-MAINTENANCE-MODE — the owner's site open/close switch. The toggle saves
// INSTANTLY (no save bar) so «اقفله ولا افتحه» is one tap; the custom message
// has its own save button; a live mini-preview shows exactly what visitors
// will see on every device.
const DEFAULT_MAINTENANCE_MSG = 'نقوم حاليًا بأعمال صيانة وتطوير للموقع — نرجع قريبًا جدًا 🌸';

function MiniGear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden fill="currentColor">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="45.5" y="2" width="9" height="20" rx="4" transform={`rotate(${i * 45} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="31" />
      <circle cx="50" cy="50" r="13" fill="#faf6f1" />
    </svg>
  );
}

function SiteStatusCard() {
  const status = useSettingsBag<SiteStatusSettings>('maintenance');
  const { toast } = useToast();
  const videoRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  // U82 — optional YouTube/Vimeo/direct-link field next to the device upload
  const [linkDraft, setLinkDraft] = useState('');
  useEffect(() => {
    // prefill the link box only when the saved value is a LINK (not an upload)
    const v = status.form?.video || '';
    setLinkDraft(v && /^https?:\/\//i.test(v) && !v.startsWith('/api/uploads/') ? v : '');
  }, [status.form?.video]);

  if (!status.form) return null;
  const closed = status.form.enabled === true;
  const msg = (status.form.message || '').trim();

  async function toggleEnabled(next: boolean) {
    if (!status.form) return;
    const prev = status.form!.enabled === true;
    if (next === prev) return;
    status.setForm({ ...status.form!, enabled: next });
    status.setSaving(true);
    const ok = await status.persist({ enabled: next, updatedAt: new Date().toISOString() });
    status.setSaving(false);
    if (ok) {
      toast(
        next
          ? { title: 'تم قفل الموقع 🔒', description: 'أي زائر هيشوف بس صفحة الصيانة — على الموبايل والتابلت والكمبيوتر. لوحة التحكم فضلت شغالة عادي.' }
          : { title: 'تم فتح الموقع ✓', description: 'الموقع رجع يشتغل عادي للزوار — كل الصفحات والمنتجات ظهرت تاني.' },
      );
    } else {
      status.setForm({ ...status.form!, enabled: prev }); // revert on failure
    }
  }

  async function saveMessage() {
    status.setSaving(true);
    const ok = await status.persist({ message: msg, updatedAt: new Date().toISOString() });
    status.setSaving(false);
    if (ok) toast({ title: 'تم حفظ رسالة الصيانة ✓' });
  }

  // U78 — pick the emblem video from the device; saved instantly on success
  async function handleVideoUpload(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: 'الملف لازم يكون فيديو (webm أو mp4)', variant: 'destructive' });
      return;
    }
    setVideoUploading(true);
    try {
      const url = await uploadVideoFile(file);
      const prevVideo = status.form!.video || '';
      const ok = await status.persist({ video: url, updatedAt: new Date().toISOString() });
      if (ok) {
        // U81 — persist() only saves server-side; updating the form here is
        // what makes the two live previews show the new video immediately
        status.setForm({ ...status.form!, video: url, updatedAt: new Date().toISOString() });
        // U81 — the previous maintenance video is now an orphan: remove it so
        // repeated uploads never stack copies on disk (reference-safe delete)
        if (prevVideo && prevVideo !== url) void cleanupMediaAsset(prevVideo);
        toast({ title: 'تم رفع الفيديو ✓', description: 'هيظهر فوق الكلام في صفحة الصيانة على طول.' });
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'تعذر رفع الفيديو', variant: 'destructive' });
    } finally {
      setVideoUploading(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  async function clearVideo() {
    status.setForm({ ...status.form!, video: '' });
    const ok = await status.persist({ video: '', updatedAt: new Date().toISOString() });
    if (ok) toast({ title: 'تم مسح الفيديو — رجعت الأيقونة الافتراضية' });
  }

  // U82 — normalize a pasted link (bare youtube.com/… gets https://)
  function normalizeVideoLink(raw: string): string {
    let v = raw.trim();
    if (v && !/^https?:\/\//i.test(v) && /^(www\.|youtube\.com|youtu\.be|vimeo\.com)/i.test(v)) {
      v = 'https://' + v;
    }
    return v;
  }

  async function saveVideoLink() {
    const v = normalizeVideoLink(linkDraft);
    if (!v) {
      toast({ title: 'اكتبي لينك الفيديو الأول (يوتيوب أو رابط مباشر)', variant: 'destructive' });
      return;
    }
    if (!/^https?:\/\//i.test(v)) {
      toast({ title: 'اللينك لازم يبدأ بـ https:// — زي لينك يوتيوب أو رابط mp4 مباشر', variant: 'destructive' });
      return;
    }
    if (v === (status.form!.video || '')) {
      toast({ title: 'اللينك ده محفوظ بالفعل ✓' });
      return;
    }
    const ok = await status.persist({ video: v, updatedAt: new Date().toISOString() });
    if (ok) {
      const prev = status.form!.video || '';
      status.setForm({ ...status.form!, video: v, updatedAt: new Date().toISOString() });
      // replacing an uploaded file with a link orphans the old file → clean it
      if (prev && prev !== v && prev.startsWith('/api/uploads/')) void cleanupMediaAsset(prev);
      toast({ title: 'تم حفظ لينك الفيديو ✓', description: 'هيظهر فوق الكلام في صفحة الصيانة على طول.' });
    }
  }

  return (
    <div className={`${card} border-[#7a2e3b]/25 bg-gradient-to-b from-[#7a2e3b]/[0.04] to-transparent`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <Wrench className="h-4 w-4 text-[#7a2e3b]" aria-hidden />
          حالة الموقع
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black ${
            closed ? 'bg-[#7a2e3b] text-[#fdf4f5]' : 'bg-emerald-600/10 text-emerald-700'
          }`}
        >
          {closed ? 'مغلق — وضع الصيانة' : 'مفتوح ✓'}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-card/60 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            {closed ? <Lock className="h-4 w-4 text-[#7a2e3b]" aria-hidden /> : <LockOpen className="h-4 w-4 text-emerald-600" aria-hidden />}
            قفل الموقع (وضع الصيانة)
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            لما تقفلي الموقع، أي حد يفتح أي صفحة هيشوف بس صفحة الصيانة الاحترافية — على الموبايل والتابلت والكمبيوتر.
            لوحة التحكم هتفضل شغالة عادي، وإنتِ كمان لسه بتقدري تتفرجي على المتجر وإنتي مسجّلة.
          </p>
        </div>
        <Switch
          checked={closed}
          onCheckedChange={toggleEnabled}
          disabled={status.saving}
          aria-label={closed ? 'فتح الموقع' : 'قفل الموقع'}
          className="mt-1 data-[state=checked]:bg-[#7a2e3b]"
        />
      </div>

      <div className={field}>
        <Label>رسالة مخصصة على صفحة الصيانة (اختياري)</Label>
        <Textarea
          rows={2}
          value={status.form.message || ''}
          onChange={(e) => status.setForm({ ...status.form!, message: e.target.value })}
          placeholder={DEFAULT_MAINTENANCE_MSG}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">لو سبتيها فاضية، هنستخدم الرسالة الافتراضية.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={saveMessage}
            disabled={status.saving}
            className="h-9 shrink-0 rounded-full px-4 text-xs font-bold"
          >
            {status.saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'حفظ الرسالة'}
          </Button>
        </div>
      </div>

      {/* U78 — emblem video picker */}
      <div className={field}>
        <Label>فيديو الأيقونة (يظهر فوق الكلام في صفحة الصيانة)</Label>
        <input
          ref={videoRef}
          type="file"
          accept="video/*,.webm,.mp4,.mov"
          className="hidden"
          onChange={(e) => handleVideoUpload(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => videoRef.current?.click()}
            disabled={videoUploading}
            className="h-11 rounded-full px-4 text-xs font-bold"
          >
            {videoUploading ? <Loader2 className="ml-1 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="ml-1 h-4 w-4" aria-hidden />}
            {videoUploading ? 'جاري الرفع…' : 'رفع فيديو من الجهاز'}
          </Button>
          {status.form.video ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearVideo}
              disabled={status.saving}
              className="h-11 rounded-full px-3 text-xs font-bold text-destructive hover:text-destructive"
            >
              <Trash2 className="ml-1 h-4 w-4" aria-hidden />
              مسح الفيديو
            </Button>
          ) : null}
        </div>
        {/* U82 — paste a video link (YouTube / Vimeo / direct file) instead of uploading */}
        <div className="flex gap-2">
          <Input
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="أو الصقي لينك فيديو — يوتيوب / فيميو / رابط mp4 مباشر"
            dir="ltr"
            className="h-11 flex-1 rounded-full text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={saveVideoLink}
            disabled={status.saving}
            className="h-11 shrink-0 rounded-full px-4 text-xs font-bold"
          >
            {status.saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'حفظ اللينك'}
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ارفعي الأنيميشن من جهازك (webm أو mp4 — أقصى حجم 80MB) أو الصقي لينك يوتيوب/فيميو أو رابط مباشر — الاتنين بيظهروا فوق الكلام في صفحة الصيانة بحجم كامل ومناسب لكل الشاشات، ولو مفيش فيديو هنستخدم الأيقونة المتحركة الافتراضية.
        </p>
        {(() => {
          const src = resolveVideoSource(status.form.video);
          return src.kind === 'youtube' || src.kind === 'vimeo' ? (
            <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-xl bg-black/5 shadow-md" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={src.src}
                title="أيقونة الصيانة"
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
              />
            </div>
          ) : src.kind === 'file' ? (
            <div className="flex justify-center rounded-2xl border border-border/50 bg-[#faf6f1] p-4">
              <video
                src={src.src}
                autoPlay
                loop
                muted
                playsInline
                disablePictureInPicture
                controls={false}
                className="max-h-56 w-full max-w-[240px] object-contain"
              />
            </div>
          ) : null;
        })()}
      </div>

      {/* live mini-preview of the maintenance screen */}
      <div>
        <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">معاينة سريعة — اللي هيشوفه الزوار:</p>
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-[#faf6f1] px-4 py-6 text-center">
          {(() => {
            const src = resolveVideoSource(status.form.video);
            return src.kind === 'youtube' || src.kind === 'vimeo' ? (
              <div className="relative w-full overflow-hidden rounded-lg bg-black/5" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                  src={src.src}
                  title="أيقونة الصيانة"
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              </div>
            ) : src.kind === 'file' ? (
              <video
                src={src.src}
                autoPlay
                loop
                muted
                playsInline
                disablePictureInPicture
                controls={false}
                className="max-h-28 w-auto max-w-[150px]"
              />
            ) : (
              <MiniGear className="h-9 w-9 text-[#7a2e3b]/85" />
            );
          })()}
          <p className="text-sm font-black text-[#43242b]">الخدمة غير متاحة حاليًا</p>
          <p className="max-w-xs text-[11px] leading-5 text-[#8a6f75]">{msg || DEFAULT_MAINTENANCE_MSG}</p>
        </div>
      </div>
    </div>
  );
}

function StoreTab() {
  const store = useSettingsBag<StoreSettings>('store');
  const texts = useSettingsBag<SiteTexts>('texts');
  const { toast } = useToast();

  if (!store.form || !texts.form)
    return <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>;

  const sForm = store.form;
  const tForm = texts.form;
  const setS = (patch: Partial<StoreSettings>) => store.setForm({ ...sForm, ...patch });
  const setT = (patch: Partial<SiteTexts>) => texts.setForm({ ...tForm, ...patch });

  async function saveAll() {
    store.setSaving(true);
    const a = await store.persist();
    store.setSaving(false);
    const b = await texts.persist();
    if (a && b) toast({ title: 'تم الحفظ — ظهر في المتجر فورًا ✓' });
  }

  return (
    <div className="space-y-4">
      {/* U77-MAINTENANCE-MODE — the open/close switch is the first thing she sees */}
      <SiteStatusCard />

      <p className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        بيانات المتجر والطلب — الاسم، التواصل، العملة، الشحن، ووصف المتجر. تُطبَّق على المتجر بعد الحفظ مباشرة.
      </p>

      {/* الهوية والتواصل */}
      <div className={card}>
        <h3 className="text-sm font-black">الهوية والتواصل</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>اسم المتجر</Label>
            <Input dir="ltr" className="text-left" value={sForm.storeName || ''} onChange={(e) => setS({ storeName: e.target.value })} placeholder="LUBNÉL" />
          </div>
          <div className={field}>
            <Label>البريد الإلكتروني</Label>
            <Input dir="ltr" className="text-left" value={sForm.email || ''} onChange={(e) => setS({ email: e.target.value })} placeholder="hello@lubnel.com" />
          </div>
          <div className={field}>
            <Label>رقم واتساب الطلبات</Label>
            <Input dir="ltr" className="text-left" value={sForm.whatsappNumber || ''} onChange={(e) => setS({ whatsappNumber: e.target.value })} placeholder="201000000000" />
          </div>
          <div className={field}>
            <Label>العملة</Label>
            <select
              value={CURRENCY_OPTIONS.some((o) => o.value === (sForm.currency || '')) ? sForm.currency || '' : 'OTHER'}
              onChange={(e) => setS({ currency: e.target.value === 'OTHER' ? (sForm.currency || 'ج.م') : e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="العملة"
            >
              {CURRENCY_OPTIONS.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
              {CURRENCY_OPTIONS.every((o) => o.value !== (sForm.currency || '')) && sForm.currency && (
                <option value="OTHER">{sForm.currency} — مخصصة</option>
              )}
            </select>
            <p className="text-[11px] leading-relaxed text-muted-foreground">تظهر بجانب كل الأسعار في المتجر فورًا.</p>
          </div>
          <div className={field}>
            <Label>رسوم الشحن (ج.م)</Label>
            <Input type="number" value={sForm.shippingFee ?? ''} onChange={(e) => setS({ shippingFee: Number(e.target.value) })} />
          </div>
          <div className={field}>
            <Label>رابط إنستجرام</Label>
            <Input dir="ltr" className="text-left" value={sForm.instagramUrl || ''} onChange={(e) => setS({ instagramUrl: e.target.value })} placeholder="https://instagram.com/lubnel.eg" />
          </div>
        </div>
        <div className={field}>
          <Label>وصف المتجر</Label>
          <Input value={sForm.storeDescriptionAr || ''} onChange={(e) => setS({ storeDescriptionAr: e.target.value })} placeholder="طقس جمالك، بصياغة مصرية معاصرة." />
        </div>
      </div>

      {/* الإرسائل والإعلان */}
      <div className={card}>
        <h3 className="text-sm font-black">الإرسائل والإعلان</h3>
        <div className={field}>
          <Label>رسالة واتساب الافتراضية</Label>
          <Input value={sForm.whatsappMessage || ''} onChange={(e) => setS({ whatsappMessage: e.target.value })} placeholder="مرحبًا، أريد تأكيد طلبي من LUBNÉL." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>شريط الإعلان بالعربية</Label>
            <Input value={sForm.announcementAr || ''} onChange={(e) => setS({ announcementAr: e.target.value })} placeholder="شحن مجاني للطلبات فوق ٩٠٠ ج.م · توصيل لكل مصر" />
          </div>
          <div className={field}>
            <Label>Announcement in English</Label>
            <Input dir="ltr" className="text-left" value={sForm.announcementEn || ''} onChange={(e) => setS({ announcementEn: e.target.value })} placeholder="Complimentary delivery over 900 EGP · Nationwide shipping" />
          </div>
        </div>
      </div>

      {/* الفوتر والروابط — يعدّل نفس إعدادات «النصوص والفوتر» */}
      <div className={card}>
        <h3 className="text-sm font-black">الفوتر والروابط</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>نص الفوتر بالعربية</Label>
            <Input value={tForm.footerBlurbAr || ''} onChange={(e) => setT({ footerBlurbAr: e.target.value })} placeholder="طقس جمالك، بصياغة مصرية معاصرة." />
          </div>
          <div className={field}>
            <Label>Footer note (English)</Label>
            <Input dir="ltr" className="text-left" value={tForm.footerBlurbEn || ''} onChange={(e) => setT({ footerBlurbEn: e.target.value })} placeholder="Your beauty ritual, reimagined in Cairo." />
          </div>
          <div className={field}>
            <Label>نص النشرة بالعربية</Label>
            <Input value={tForm.newsletterAr || ''} onChange={(e) => setT({ newsletterAr: e.target.value })} placeholder="إلهام، وصول مبكر، وطقوس جمال حصرية بعناية." />
          </div>
          <div className={field}>
            <Label>Newsletter text (English)</Label>
            <Input dir="ltr" className="text-left" value={tForm.newsletterEn || ''} onChange={(e) => setT({ newsletterEn: e.target.value })} placeholder="Early access, beauty notes, and considered rituals." />
          </div>
          <div className={field}>
            <Label>رابط Facebook</Label>
            <Input dir="ltr" className="text-left" value={tForm.facebookUrl || ''} onChange={(e) => setT({ facebookUrl: e.target.value })} placeholder="https://facebook.com" />
          </div>
          <div className={field}>
            <Label>رابط WhatsApp</Label>
            <Input dir="ltr" className="text-left" value={tForm.whatsappUrl || ''} onChange={(e) => setT({ whatsappUrl: e.target.value })} placeholder="https://wa.me/201000000000" />
          </div>
          <div className={field}>
            <Label>رابط Instagram</Label>
            <Input dir="ltr" className="text-left" value={tForm.instagramUrl || ''} onChange={(e) => setT({ instagramUrl: e.target.value })} placeholder="https://instagram.com/lubnel.eg" />
          </div>
          {/* U52-CONTACT-SOCIAL — قناة واتساب + تيك توك (نفس حزمة «texts») */}
          <div className={field}>
            <Label>رابط قناة الواتساب</Label>
            <Input dir="ltr" className="text-left" value={tForm.whatsappChannelUrl || ''} onChange={(e) => setT({ whatsappChannelUrl: e.target.value })} placeholder="https://whatsapp.com/channel/…" />
          </div>
          <div className={field}>
            <Label>رابط TikTok</Label>
            <Input dir="ltr" className="text-left" value={tForm.tiktokUrl || ''} onChange={(e) => setT({ tiktokUrl: e.target.value })} placeholder="https://tiktok.com/@…" />
          </div>
          {/* U67-YOUTUBE-SOCIAL — قناة يوتيوب (نفس حزمة «texts») */}
          <div className={field}>
            <Label>رابط قناة يوتيوب</Label>
            <Input dir="ltr" className="text-left" value={tForm.youtubeUrl || ''} onChange={(e) => setT({ youtubeUrl: e.target.value })} placeholder="https://youtube.com/@…" />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          تُستخدم في تغيير كل صفحات المتجر وقسم النشرة البريدية مباشرة بعد الحفظ.
        </p>
      </div>

      <SmtpCard />

      <SaveBar saving={store.saving || texts.saving} onClick={saveAll} label="حفظ بيانات المتجر" />
    </div>
  );
}

/* ---------- 1.ب إعدادات البريد الصادر (SMTP) — U71-NEWSLETTER-ADMIN ----------
 * Credentials the newsletter sender uses to deliver mail (nodemailer SMTP).
 * Owner-only (settings tab). Free providers work — e.g. Brevo/Gmail app
 * password: host smtp-relay.brevo.com / smtp.gmail.com, port 587 or 465.
 * Stored under its own settings key so the password never mixes with site copy.
 * U72-SMTP-BREVO — User (SMTP Login) authenticates with the relay, while
 * «From Email» is the visible sender address the subscribers see (must be a
 * sender verified at the provider). The stored key is never echoed back —
 * the API masks it behind `passSet`. */

type SmtpSettings = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  passSet?: boolean; // GET-only flag: a key is stored server-side (never sent back)
  fromName?: string;
  fromEmail?: string;
};

function SmtpCard() {
  const smtp = useSettingsBag<SmtpSettings>('smtp');
  const { toast } = useToast();
  if (!smtp.form) return null;
  const f = smtp.form;
  const set = (patch: Partial<SmtpSettings>) => smtp.setForm({ ...f, ...patch });

  async function save() {
    if (await smtp.persist()) toast({ title: 'تم حفظ إعدادات البريد ✓' });
  }

  const ready = Boolean(f.host?.trim() && f.user?.trim() && (f.pass?.trim() || f.passSet));

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black">إعدادات البريد الصادر (SMTP)</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ready ? 'bg-emerald-600/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}
        >
          {ready ? 'جاهز للإرسال ✓' : 'غير مكتمل'}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        دي بيانات سيرفر الإيميل اللي بيبعت منها رسائل «النشرة البريدية» للمشتركين.
        الـ <span className="font-semibold">User (SMTP Login)</span> بيتملى بيه توثيق الدخول للسيرفر،
        أما <span className="font-semibold">From Email</span> فهو العنوان اللي المشتركين هيشوفوه مرسلًا (لازم يكون مسجّل ومتأكد عند مزوّد البريد).
        <br />
        لو الإيميلات بتروح «Spam» — فعّلي «مش سبام» من جيميل، وللحل الجذري سطّعي الدومين بتاعك عند مزوّد البريد (Domains → أضيفي سجلات DKIM/DMARC).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}>
          <Label>SMTP Host</Label>
          <Input dir="ltr" className="text-left" value={f.host || ''} onChange={(e) => set({ host: e.target.value })} placeholder="smtp-relay.brevo.com" />
        </div>
        <div className={field}>
          <Label>SMTP Port (587 أو 465)</Label>
          <Input dir="ltr" className="text-left" type="number" value={f.port ?? 587} onChange={(e) => set({ port: Number(e.target.value) || 587 })} />
        </div>
        <div className={field}>
          <Label>SMTP Username (للمصادقة)</Label>
          <Input dir="ltr" className="text-left" value={f.user || ''} onChange={(e) => set({ user: e.target.value })} placeholder="baabc9001@smtp-brevo.com" />
        </div>
        <div className={field}>
          <Label>SMTP Password / SMTP Key</Label>
          <Input
            dir="ltr"
            className="text-left"
            type="password"
            value={f.pass || ''}
            onChange={(e) => set({ pass: e.target.value })}
            placeholder={f.passSet ? 'متخزنة ✓ — اكتبي مفتاح جديد فقط لو عايزة تبدليها' : '••••••••'}
            autoComplete="new-password"
          />
        </div>
        <div className={field}>
          <Label>From Email (بريد المرسل الظاهر)</Label>
          <Input dir="ltr" className="text-left" type="email" value={f.fromEmail || ''} onChange={(e) => set({ fromEmail: e.target.value })} placeholder="lubnel.cosmetics@gmail.com" />
        </div>
        <div className={field}>
          <Label>From Name (الاسم الظاهر)</Label>
          <Input value={f.fromName || ''} onChange={(e) => set({ fromName: e.target.value })} placeholder="🌸 LUBNÉL" />
        </div>
      </div>
      <Button onClick={save} disabled={smtp.saving} className="h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {smtp.saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <><Save className="ml-1 h-4 w-4" aria-hidden /> حفظ إعدادات البريد</>}
      </Button>
    </div>
  );
}

/* ---------- 2. الشحن والدفع ---------- */

function ShippingTab() {
  const { form, setForm, saving, persist } = useSettingsBag<StoreSettings>('store');
  const { toast } = useToast();
  if (!form) return <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>;
  const set = (patch: Partial<StoreSettings>) => setForm({ ...form, ...patch });

  async function save() {
    if (await persist()) toast({ title: 'تم الحفظ — ظهر في المتجر فورًا ✓' });
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="text-sm font-black">الشحن والدفع</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>رسوم الشحن (ج.م)</Label>
            <Input type="number" value={form.shippingFee ?? ''} onChange={(e) => set({ shippingFee: Number(e.target.value) })} />
          </div>
          <div className={field}>
            <Label>حد الشحن المجاني (ج.م)</Label>
            <Input type="number" value={form.freeShippingThreshold ?? ''} onChange={(e) => set({ freeShippingThreshold: Number(e.target.value) })} />
          </div>
          <div className={field}>
            <Label>الحد الأدنى للطلب (ج.م — 0 = بدون حد)</Label>
            <Input type="number" value={form.minOrderTotal ?? 0} onChange={(e) => set({ minOrderTotal: Number(e.target.value) })} />
            <p className="text-[11px] text-muted-foreground">لو الطلب أقل من القيمة دي السلة هتمنع إتمام الطلب وتوضح الناقص.</p>
          </div>
          <div className={field}>
            <Label>مدة التوصيل المتوقعة</Label>
            <Input value={form.deliveryTime || ''} onChange={(e) => set({ deliveryTime: e.target.value })} placeholder="2–5 أيام" />
            <p className="text-[11px] text-muted-foreground">تظهر في صفحة المنتج وفي السلة — مثال: «2–5 أيام».</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 px-3.5 py-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.codEnabled !== false}
            onChange={(e) => set({ codEnabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          الدفع عند الاستلام (COD) — يظهر في السلة ورسالة واتساب
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          هذه القيم تُستخدم في حساب إجمالي السلة تلقائيًا وفي رسالة واتساب النهائية.
        </p>
      </div>
      <SaveBar saving={saving} onClick={save} label="حفظ الشحن والدفع" />
    </div>
  );
}

/* ---------- 5. الهوية البصرية ---------- */

function BrandTab() {
  const { form, setForm, saving, persist } = useSettingsBag<BrandSettings>('brand');
  const { toast } = useToast();
  const [fontTag, setFontTag] = useState<'' | 'ar' | 'both' | 'lat'>('');
  const linkAdded = useRef(false);

  // load the combined preview stylesheet once so font cards render their real faces
  useEffect(() => {
    if (linkAdded.current) return;
    linkAdded.current = true;
    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = googleFontsHref(BRAND_FONTS.map((f) => f.id));
    document.head.appendChild(el);
  }, []);

  if (!form) return <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>;
  const set = (patch: Partial<BrandSettings>) => setForm({ ...form, ...patch });

  async function save() {
    if (await persist()) toast({ title: 'تم حفظ الهوية البصرية — ظهر في المتجر فورًا ✓' });
  }

  const fonts = fontTag ? BRAND_FONTS.filter((f) => f.tag === fontTag) : BRAND_FONTS;

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        شعارك وخط متجرك وأيقونة الموقع — كل شيء يُدار من هنا بدون لمس الكود.
      </p>

      <div className={card}>
        <h3 className="text-sm font-black">الهوية والشعار</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>اسم الشعار</Label>
            <Input dir="ltr" className="text-left" value={form.brandName || ''} onChange={(e) => set({ brandName: e.target.value })} placeholder="LUBNÉL" />
          </div>
          <div className={field}>
            <Label>النص أسفل الشعار</Label>
            <Input dir="ltr" className="text-left" value={form.brandTagline || ''} onChange={(e) => set({ brandTagline: e.target.value })} placeholder="BEAUTY RITUALS" />
          </div>
          <div className={field}>
            <Label>حساب Instagram</Label>
            <Input dir="ltr" className="text-left" value={form.instagramHandle || ''} onChange={(e) => set({ instagramHandle: e.target.value })} placeholder="@lubnel.eg" />
          </div>
        </div>
        <ImageField label="أيقونة الموقع (Favicon) — مربعة 192×192" value={form.favicon || ''} onChange={(url) => set({ favicon: url })} />
      </div>

      <div className={card}>
        <h3 className="text-sm font-black">الشعارات</h3>
        <ImageField label="الشعار الفاتح — أبيض (للخلفيات الغامقة مثل صفحة الدخول)" value={form.logoLight || ''} onChange={(url) => set({ logoLight: url })} />
        <ImageField label="الشعار الغامق — كحلي (للهيدر والفوتر والخلفيات الفاتحة)" value={form.logoDark || ''} onChange={(url) => set({ logoDark: url })} />
        <ImageField label="أيقونة مربعة (بديل Favicon / الأفاتار)" value={form.logoSquare || ''} onChange={(url) => set({ logoSquare: url })} />
      </div>

      {/* الخط الأساسي — gallery */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black">الخط الأساسي — موحّد لكل الموقع</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية الخطوط">
            {BRAND_FONT_TAGS.map((t) => (
              <button
                key={t.key || 'all'}
                type="button"
                onClick={() => setFontTag(t.key)}
                aria-pressed={fontTag === t.key}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-colors ${
                  fontTag === t.key ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          اختاري الخط الافتراضي لكل صفحات المتجر — يُطبَّق فورًا بعد الحفظ، و«القاهرة» هو الخط الحالي.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fonts.map((f) => {
            const active = (form.brandFont || 'Cairo') === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => set({ brandFont: f.id })}
                aria-pressed={active}
                className={`relative rounded-2xl border p-4 text-center transition-all hover:-translate-y-0.5 ${
                  active ? 'border-primary bg-secondary/60 shadow-md' : 'border-border/60 bg-background'
                }`}
              >
                {active && (
                  <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
                <span dir="ltr" className="block text-lg font-bold text-foreground" style={{ fontFamily: `'${f.id}', Cairo, sans-serif` }}>
                  LUBNÉL
                </span>
                <span dir="rtl" className="mt-1 block text-sm font-bold" style={{ fontFamily: `'${f.id}', Cairo, sans-serif` }}>
                  طقس جمالك يبدأ من هنا
                </span>
                <span className="mt-2 block text-[11px] font-black">{f.labelAr}</span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{f.note}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SaveBar saving={saving} onClick={save} label="حفظ الهوية البصرية" />
    </div>
  );
}

/* ---------- 6. SEO ---------- */

function SeoTab() {
  const { form, setForm, saving, persist } = useSettingsBag<SeoSettings>('seo');
  const { toast } = useToast();
  if (!form) return <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>;
  const set = (patch: Partial<SeoSettings>) => setForm({ ...form, ...patch });

  async function save() {
    if (await persist()) toast({ title: 'تم حفظ SEO — ظهر في المتجر فورًا ✓' });
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        عناوين ووصف المتجر لمحركات البحث وبيانات المشاركة. تُحفظ هذه الإعدادات لتجهيز عناوين المتجر ووصفه لمحركات البحث والمشاركة.
      </p>
      <div className={card}>
        <h3 className="text-sm font-black">عنوان الصفحة</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>عنوان الصفحة بالعربية</Label>
            <Input value={form.metaTitleAr || ''} onChange={(e) => set({ metaTitleAr: e.target.value })} placeholder="LUBNÉL | طقس جمالك" />
          </div>
          <div className={field}>
            <Label>Page title in English</Label>
            <Input dir="ltr" className="text-left" value={form.metaTitleEn || ''} onChange={(e) => set({ metaTitleEn: e.target.value })} placeholder="LUBNÉL | Beauty your way" />
          </div>
        </div>
      </div>
      <div className={card}>
        <h3 className="text-sm font-black">الوصف والكلمات المفتاحية</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>وصف SEO بالعربية</Label>
            <textarea
              rows={3}
              value={form.metaDescriptionAr || ''}
              onChange={(e) => set({ metaDescriptionAr: e.target.value })}
              className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="متجر مكياج وعناية وعطور حديث في مصر."
            />
          </div>
          <div className={field}>
            <Label>SEO description in English</Label>
            <textarea
              rows={3}
              dir="ltr"
              className="resize-none rounded-md border border-input bg-background px-3 py-2 text-left text-sm"
              value={form.metaDescriptionEn || ''}
              onChange={(e) => set({ metaDescriptionEn: e.target.value })}
              placeholder="Considered makeup, skincare, and fragrance in Egypt."
            />
          </div>
        </div>
        <div className={field}>
          <Label>الكلمات المفتاحية (فواصل)</Label>
          <Input dir="ltr" className="text-left" value={form.metaKeywords || ''} onChange={(e) => set({ metaKeywords: e.target.value })} placeholder="LUBNÉL, makeup, skincare, beauty Egypt" />
        </div>
      </div>
      <div className={card}>
        <h3 className="text-sm font-black">صورة المشاركة</h3>
        <p className="text-xs text-muted-foreground">تظهر عند مشاركة روابط المتجر على واتساب وفيسبوك (مقاس مقترح 1200×629 بكسل).</p>
        <ImageField label="صورة المشاركة (OG image)" value={form.ogImage || ''} onChange={(url) => set({ ogImage: url })} />
      </div>
      <SaveBar saving={saving} onClick={save} label="حفظ SEO" />
    </div>
  );
}

/* ---------- 8. Backup / Export ---------- */

function BackupTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        نزّلي نسخة كاملة من كل بيانات المتجر.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid content-start gap-2 rounded-2xl border border-border/60 bg-card p-5 text-center shadow-sm">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileJson className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-sm font-black">نسخة JSON كاملة</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">كل الإعدادات: الإعدادات + الكاتالوج + الطلبات</p>
          <Button asChild variant="ghost" className="mt-auto rounded-full text-xs font-black text-primary hover:text-primary">
            <a href="/api/admin/export?type=full" download>
              <Download className="ml-1 h-3.5 w-3.5" aria-hidden /> تنزيل
            </a>
          </Button>
        </div>
        <div className="grid content-start gap-2 rounded-2xl border border-border/60 bg-card p-5 text-center shadow-sm">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-sm font-black">الطلبات CSV</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">جدول الطلبات ببرنامج الإكسل</p>
          <Button asChild variant="ghost" className="mt-auto rounded-full text-xs font-black text-primary hover:text-primary">
            <a href="/api/admin/export?type=orders" download>
              <Download className="ml-1 h-3.5 w-3.5" aria-hidden /> تنزيل
            </a>
          </Button>
        </div>
        <div className="grid content-start gap-2 rounded-2xl border border-border/60 bg-card p-5 text-center shadow-sm">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-sm font-black">المنتجات CSV</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">جدول المنتجات والسعار والمخزون</p>
          <Button asChild variant="ghost" className="mt-auto rounded-full text-xs font-black text-primary hover:text-primary">
            <a href="/api/admin/export?type=products" download>
              <Download className="ml-1 h-3.5 w-3.5" aria-hidden /> تنزيل
            </a>
          </Button>
        </div>
      </div>
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        <strong>نصيحة:</strong> نزّلي نسخة JSON أسبوعيًا واحتفظي بها في مكان آمن — فيها كل بيانات المتجر كاملة.
      </p>
      <div className={card}>
        <h3 className="text-sm font-black">حفظ التغييرات</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          كل تبويب له زر حفظ خاص — التغييرات تُطبَّق على المتجر فورًا بعد الحفظ بدون الحاجة لأي خطوة إضافية، والصور المرفوعة تُضغط تلقائيًا إلى WebP لتسريع التحميل.
        </p>
      </div>
    </div>
  );
}
