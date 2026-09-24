'use client';

// SUP-8 — shared image picker used by products / categories / homepage slides.
// Three ways to set an image, as the owner requested:
//   1. رفع من الجهاز  → multipart POST /api/admin/media → public/uploads
//   2. رابط خارجي     → plain URL input
//   3. من مكتبة الوسائط → pick from previously-uploaded MediaAssets
// Also supports drag & drop onto the preview, and an `onPick` mode where a
// selection is handed to the parent instead of replacing the value (used by
// the product gallery manager).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Library, Link2, Loader2, Smartphone, Upload, X } from 'lucide-react';
import { apiJson, loadAdminToken } from './helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type MediaAsset = { id: string; url: string; fileName: string; altText: string };

type UploadedImage = { url: string; width: number | null; height: number | null };

// U75-IMAGE-MOBILE-PREVIEW — how the storefront crops this image family:
// product/category cards are square (1:1), blog/editorial 4:5, hero slides full-bleed.
export type MobilePreviewVariant = 'product' | 'tall' | 'hero';

export async function uploadImageFile(file: File): Promise<UploadedImage> {
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
    throw new Error(data?.error || 'تعذر رفع الصورة');
  }
  return { url: data.url as string, width: (data.width as number) ?? null, height: (data.height as number) ?? null };
}

/** U75 — instant quality verdict for the owner (mobile-first). */
export function qualityVerdict(w: number | null, h: number | null): { tone: 'good' | 'ok' | 'bad'; text: string } | null {
  if (!w || !h) return null;
  const min = Math.min(w, h);
  if (min >= 1000) return { tone: 'good', text: `دقة ممتازة للموبايل ✓ — ${w}×${h}` };
  if (min >= 700) return { tone: 'ok', text: `الدقة مقبولة — ${w}×${h} (الأفضل 1000px وأعلى)` };
  return { tone: 'bad', text: `صغيرة — ممكن تبان ممطوطة — ${w}×${h}` };
}

export default function ImageField({
  value,
  onChange,
  onPick,
  label,
  placeholder = '/products/placeholder.svg',
  variant = 'product',
}: {
  value?: string;
  onChange?: (url: string) => void;
  onPick?: (url: string) => void;
  label?: string;
  placeholder?: string;
  /** U75 — which storefront shape should the mobile preview mimic? */
  variant?: MobilePreviewVariant;
}) {
  const pickMode = typeof onPick === 'function' && !onChange;
  const [url, setUrl] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [dims, setDims] = useState<{ w: number | null; h: number | null } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => setUrl(value || ''), [value]);

  const handleUpload = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setUploading(true);
      try {
        const uploaded = await uploadImageFile(file);
        setDims({ w: uploaded.width, h: uploaded.height });
        if (pickMode) onPick?.(uploaded.url);
        else {
          setUrl(uploaded.url);
          onChange?.(uploaded.url);
        }
        const v = qualityVerdict(uploaded.width, uploaded.height);
        toast({ title: v ? `تم رفع الصورة ✓ — ${v.text}` : 'تم رفع الصورة من الجهاز ✓' });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : 'تعذر رفع الصورة', variant: 'destructive' });
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [pickMode, onPick, onChange, toast]
  );

  const commitUrl = (next: string) => {
    setUrl(next);
    setDims(null); // URL/library entries have unknown dims until re-uploaded
    if (!pickMode) onChange?.(next);
  };

  async function openLibrary() {
    setLibraryOpen(true);
    if (assets === null) {
      const { ok, data } = await apiJson<{ ok: boolean; media: MediaAsset[] }>('/api/admin/media');
      setAssets(ok && data?.ok ? data.media : []);
    }
  }

  function chooseFromLibrary(asset: MediaAsset) {
    if (pickMode) onPick?.(asset.url);
    else {
      setUrl(asset.url);
      onChange?.(asset.url);
    }
    setDims(null);
    setLibraryOpen(false);
  }

  const preview = !pickMode ? url : '';

  return (
    <div className="grid gap-2">
      {label && <span className="text-sm font-bold">{label}</span>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleUpload(e.dataTransfer.files?.[0]);
        }}
        className={`flex items-center gap-3 rounded-2xl border border-dashed p-2.5 transition-colors ${
          dragOver ? 'border-primary bg-secondary/60' : 'border-border bg-secondary/30'
        }`}
      >
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-card">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="جاري الرفع" />
          ) : preview ? (
            <img src={preview} alt="معاينة الصورة" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground/60" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.03]">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
            رفع من الجهاز
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
          </label>
          <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5 text-xs" onClick={openLibrary}>
            <Library className="h-3.5 w-3.5" aria-hidden /> من المكتبة
          </Button>
          {!pickMode && (
            <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
              <Link2 className="h-3 w-3" aria-hidden /> أو الصقي رابطًا بالأسفل — ويمكنكِ إفلات الصورة هنا
            </span>
          )}
        </div>
      </div>

      {!pickMode && (
        <div className="flex items-center gap-2">
          <Input
            dir="ltr"
            className="text-left text-xs"
            value={url}
            onChange={(e) => commitUrl(e.target.value)}
            placeholder={placeholder}
            aria-label="رابط الصورة"
          />
          {/* U19 — explicit clear: removes the image entirely (falls back to defaults) */}
          {url && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commitUrl('')}
              className="shrink-0 gap-1 rounded-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="مسح الصورة"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> مسح
            </Button>
          )}
        </div>
      )}

      {/* U75-IMAGE-MOBILE-PREVIEW — quality badge + phone-frame preview */}
      {!pickMode && url && (
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const v = qualityVerdict(dims?.w ?? null, dims?.h ?? null);
            if (!v) return null;
            return (
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  v.tone === 'good'
                    ? 'bg-emerald-600/10 text-emerald-700'
                    : v.tone === 'ok'
                      ? 'bg-amber-500/10 text-amber-700'
                      : 'bg-destructive/10 text-destructive'
                }`}
              >
                {v.text}
              </span>
            );
          })()}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileOpen(true)}
            className="gap-1.5 rounded-full text-xs"
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden /> معاينة على الموبايل
          </Button>
        </div>
      )}

      {/* U75 — mobile-frame preview: the EXACT storefront crop */}
      <MobileImagePreviewDialog open={mobileOpen} onOpenChange={setMobileOpen} src={url} variant={variant} />

      {/* media library picker */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">اختيار من مكتبة الوسائط</DialogTitle>
          </DialogHeader>
          {assets === null && <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>}
          {assets !== null && assets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              المكتبة فارغة — ارفعي صورة أولًا من «الوسائط» أو بزر «رفع من الجهاز».
            </div>
          )}
          {assets !== null && assets.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => chooseFromLibrary(a)}
                  className="group overflow-hidden rounded-xl border border-border/60 bg-secondary/30 transition-transform hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`اختيار ${a.fileName}`}
                >
                  <img src={a.url} alt={a.altText || a.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* U75-IMAGE-MOBILE-PREVIEW — a phone bezel rendering the image exactly like
 * the storefront does (same aspect + object-cover crop) with a skeleton card,
 * plus the full uncropped photo underneath so the owner sees what gets cut. */
export function MobileImagePreviewDialog({
  open,
  onOpenChange,
  src,
  variant = 'product',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  src: string;
  variant?: MobilePreviewVariant;
}) {
  const aspectClass = variant === 'tall' ? 'aspect-[4/5]' : 'aspect-square';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">كده هتبان على الموبايل 📱</DialogTitle>
        </DialogHeader>
        {src ? (
          <div className="mx-auto w-[270px] overflow-hidden rounded-[2.2rem] border-[9px] border-neutral-900 bg-white shadow-2xl">
            {/* mini storefront header */}
            <div className="flex items-center justify-between bg-primary px-3 py-2">
              <span className="h-3.5 w-3.5 rounded-full bg-primary-foreground/25" aria-hidden />
              <span className="font-serif text-[11px] font-bold tracking-[0.3em] text-primary-foreground">LUBNÉL</span>
              <span className="h-3.5 w-3.5 rounded-full bg-primary-foreground/25" aria-hidden />
            </div>
            {variant === 'hero' ? (
              <div className="relative h-[300px] w-full overflow-hidden">
                <img src={src} alt="معاينة الهيرو على الموبايل" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" aria-hidden />
                <div className="absolute inset-x-4 bottom-4 space-y-2 text-white">
                  <p className="font-serif text-[10px] tracking-[0.35em] text-white/85">LUBNÉL</p>
                  <div className="h-3 w-4/5 rounded-full bg-white/85" aria-hidden />
                  <span className="inline-block rounded-full bg-primary px-4 py-1.5 text-[10px] font-bold text-primary-foreground">تسوّقي الآن</span>
                </div>
              </div>
            ) : (
              <div className="p-2.5">
                <div className={`relative ${aspectClass} w-full overflow-hidden rounded-xl bg-secondary/40`}>
                  <img src={src} alt="معاينة الصورة على الموبايل" className="h-full w-full object-cover" />
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="h-2.5 w-3/4 rounded-full bg-foreground/15" aria-hidden />
                  <div className="h-2.5 w-1/3 rounded-full bg-primary/70" aria-hidden />
                </div>
              </div>
            )}
            <div className="border-t border-border/60 px-2.5 py-2">
              <p className="text-center text-[9px] text-muted-foreground">نفس القص اللي بيحصل تلقائيًا من منتصف الصورة</p>
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">مفيش صورة لسه.</p>
        )}
        <div className="grid gap-2">
          {src && (
            <div className="rounded-2xl border border-border/60 bg-secondary/30 p-3">
              <p className="mb-2 text-[11px] font-bold text-muted-foreground">الصورة كاملة (اللي بيقصها الموبايل هو الجزء الأوسط بس):</p>
              <img src={src} alt="الصورة كاملة" className="max-h-48 w-full rounded-xl object-contain" />
            </div>
          )}
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            نصيحة: صورة مربعة أو طولية بدقة 1000px وأعلى = أظبط شكل على الموبايل.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
