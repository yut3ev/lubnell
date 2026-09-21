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
import { ImagePlus, Library, Link2, Loader2, Upload, X } from 'lucide-react';
import { apiJson, loadAdminToken } from './helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type MediaAsset = { id: string; url: string; fileName: string; altText: string };

export async function uploadImageFile(file: File): Promise<string> {
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
  return data.url as string;
}

export default function ImageField({
  value,
  onChange,
  onPick,
  label,
  placeholder = '/products/placeholder.svg',
}: {
  value?: string;
  onChange?: (url: string) => void;
  onPick?: (url: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const pickMode = typeof onPick === 'function' && !onChange;
  const [url, setUrl] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => setUrl(value || ''), [value]);

  const handleUpload = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setUploading(true);
      try {
        const uploaded = await uploadImageFile(file);
        if (pickMode) onPick?.(uploaded);
        else {
          setUrl(uploaded);
          onChange?.(uploaded);
        }
        toast({ title: 'تم رفع الصورة من الجهاز ✓' });
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
