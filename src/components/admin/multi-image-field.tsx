'use client';

// U58-GALLERY — «ضيف اوبشن انه يقدر يضيف كذا صوره للمنتج او المجموعه» —
// the shared multi-image manager used by the product gallery AND the new
// category gallery. Four ways to add, one place to order:
//   1. رفع متعدد من الجهاز (multiple file input + drag&drop) — يرفع بالتتابع مع عدّاد تقدم
//   2. اختيار متعدد من مكتبة الوسائط (toggle ثم «إضافة (n)»)
//   3. رابط خارجي
//   4. ترتيب بالأسهم + «تعيين كصورة رئيسية» (اختياري — يسلّم الرابط للأب) + حذف فردي
// Ordering = array order = storefront order (الصورة الأولى هي الافتراضية).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Library,
  Link2,
  Loader2,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { apiJson } from './helpers';
import { uploadImageFile } from './image-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type MediaAsset = { id: string; url: string; fileName: string; altText: string };

export default function MultiImageField({
  images,
  onChange,
  max = 12,
  onMakePrimary,
  primaryUrl,
  addLabel = 'رفع صور من الجهاز (متعدد)',
}: {
  images: string[];
  onChange: (next: string[]) => void;
  max?: number;
  /** products: «تعيين كصورة رئيسية» — hands the URL to the parent (sets form.image) */
  onMakePrimary?: (url: string) => void;
  /** highlights the thumb that currently IS the primary */
  primaryUrl?: string;
  addLabel?: string;
}) {
  const [uploading, setUploading] = useState(0); // files left in the current batch
  const [dragOver, setDragOver] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // live mirror so an in-flight batch never resurrects a just-removed image
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  const { toast } = useToast();

  const room = Math.max(0, max - images.length);
  const atMax = room <= 0;

  const uploadFiles = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      const take = list.slice(0, Math.max(0, max - imagesRef.current.length));
      if (list.length > take.length) {
        toast({ title: `الحد الأقصى ${max} صورة — سيتم رفع أول ${take.length} صورة فقط`, variant: 'destructive' });
      }
      if (!take.length) return;
      setUploading(take.length);
      let added = 0;
      for (const f of take) {
        try {
          const uploaded = await uploadImageFile(f);
          if (imagesRef.current.length < max && !imagesRef.current.includes(uploaded.url)) {
            const next = [...imagesRef.current, uploaded.url];
            onChange(next); // imagesRef re-syncs on the re-render between awaits
            added += 1;
          }
        } catch (e) {
          toast({ title: e instanceof Error ? e.message : 'تعذر رفع الصورة', variant: 'destructive' });
        } finally {
          setUploading((n) => n - 1);
        }
      }
      if (added > 0) toast({ title: `تم رفع ${added} ${added === 1 ? 'صورة' : 'صور'} ✓` });
      if (fileRef.current) fileRef.current.value = '';
    },
    [max, onChange, toast]
  );

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function remove(img: string) {
    onChange(images.filter((x) => x !== img));
  }

  function addUrl() {
    const v = url.trim();
    if (!v || atMax || images.includes(v)) return;
    onChange([...images, v]);
    setUrl('');
  }

  async function openLibrary() {
    setLibraryOpen(true);
    if (assets === null) {
      const { ok, data } = await apiJson<{ ok: boolean; media: MediaAsset[] }>('/api/admin/media');
      setAssets(ok && data?.ok ? data.media : []);
    }
  }

  function addPicked() {
    const chosen = (assets ?? []).filter((a) => pickedIds.includes(a.id)).map((a) => a.url);
    const fresh = chosen.filter((u) => !images.includes(u)).slice(0, room);
    if (fresh.length) onChange([...images, ...fresh]);
    setPickedIds([]);
    setLibraryOpen(false);
  }

  return (
    <div className="grid gap-2">
      {/* thumbs manager */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => {
            const isPrimary = primaryUrl !== undefined && img === primaryUrl;
            return (
              <div
                key={img + i}
                className={`group relative h-20 w-20 overflow-hidden rounded-xl border-2 bg-secondary/30 ${
                  isPrimary ? 'border-primary shadow-md' : 'border-border/60'
                }`}
              >
                <img src={img} alt={`صورة ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {isPrimary && (
                  <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] font-black text-primary-foreground">
                    الرئيسية
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(img)}
                  disabled={uploading > 0}
                  className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-destructive shadow transition-opacity hover:bg-destructive hover:text-background"
                  aria-label={`إزالة الصورة ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
                <div className="absolute inset-x-0 top-1 flex justify-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={uploading > 0}
                      className="grid h-6 w-6 place-items-center rounded-full bg-background/90 text-foreground shadow hover:bg-primary hover:text-primary-foreground"
                      aria-label={`تقديم الصورة ${i + 1}`}
                      title="تقديم (يمين)"
                    >
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  {i < images.length - 1 && (
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={uploading > 0}
                      className="grid h-6 w-6 place-items-center rounded-full bg-background/90 text-foreground shadow hover:bg-primary hover:text-primary-foreground"
                      aria-label={`تأخير الصورة ${i + 1}`}
                      title="تأخير (يسار)"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  {onMakePrimary && !isPrimary && (
                    <button
                      type="button"
                      onClick={() => onMakePrimary(img)}
                      disabled={uploading > 0}
                      className="grid h-6 w-6 place-items-center rounded-full bg-background/90 text-amber-500 shadow hover:bg-amber-400 hover:text-amber-950"
                      aria-label={`تعيين الصورة ${i + 1} كصورة رئيسية`}
                      title="تعيين كصورة رئيسية"
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* add row — hidden at max */}
      {!atMax && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(e.dataTransfer.files);
          }}
          className={`flex flex-wrap items-center gap-2 rounded-2xl border border-dashed p-2.5 transition-colors ${
            dragOver ? 'border-primary bg-secondary/60' : 'border-border bg-secondary/30'
          }`}
        >
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.03]">
            {uploading > 0 ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                جاري الرفع… باقي {uploading}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {addLabel}
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
          </label>
          <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => void openLibrary()}>
            <Library className="h-3.5 w-3.5" aria-hidden /> من المكتبة
          </Button>
          <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
            <ImagePlus className="h-3 w-3" aria-hidden /> أو أفلي عدة صور هنا
          </span>
          <span className="ms-auto rounded-full bg-secondary px-2.5 py-1 text-[10px] font-black text-muted-foreground" aria-live="polite">
            {images.length}/{max}
          </span>
        </div>
      )}

      {/* external URL add */}
      {!atMax && (
        <div className="flex items-center gap-2">
          <Input
            dir="ltr"
            className="text-left text-xs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="أو الصقي رابط صورة واضغطي Enter"
            aria-label="رابط صورة إضافية"
          />
          <Button type="button" variant="outline" size="sm" onClick={addUrl} disabled={!url.trim()} className="shrink-0 gap-1 rounded-full text-xs">
            <Link2 className="h-3.5 w-3.5" aria-hidden /> إضافة
          </Button>
        </div>
      )}
      {atMax && (
        <p className="text-[11px] font-bold text-muted-foreground" aria-live="polite">
          وصلتي للحد الأقصى ({max} صورة) — احذفي صورة لإضافة غيرها.
        </p>
      )}

      {/* media library — MULTI select */}
      <Dialog open={libraryOpen} onOpenChange={(o) => { setLibraryOpen(o); if (!o) setPickedIds([]); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">اختيار صور من المكتبة — متعدد</DialogTitle>
          </DialogHeader>
          {assets === null && <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>}
          {assets !== null && assets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              المكتبة فارغة — ارفعي صورة أولًا من «الوسائط» أو بزر «رفع من الجهاز».
            </div>
          )}
          {assets !== null && assets.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {assets.map((a) => {
                  const on = pickedIds.includes(a.id);
                  const already = images.includes(a.url);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={already || (!on && pickedIds.length >= room)}
                      onClick={() => setPickedIds((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                      aria-pressed={on}
                      className={`relative overflow-hidden rounded-xl border-2 bg-secondary/30 transition-transform focus:outline-none focus:ring-2 focus:ring-primary ${
                        on ? 'border-primary scale-[1.02]' : 'border-border/60 hover:scale-[1.04]'
                      } ${already ? 'opacity-40' : ''}`}
                      aria-label={already ? `الصورة ${a.fileName} مضافة بالفعل` : `اختيار ${a.fileName}`}
                    >
                      <img src={a.url} alt={a.altText || a.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                      {on && (
                        <span className="absolute inset-0 grid place-items-center bg-primary/40 text-primary-foreground" aria-hidden>
                          ✓
                        </span>
                      )}
                      {already && (
                        <span className="absolute inset-x-0 bottom-0 bg-background/80 py-0.5 text-center text-[9px] font-bold text-muted-foreground">
                          مضافة
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={addPicked}
                  disabled={pickedIds.length === 0}
                  className="rounded-full bg-primary font-bold text-primary-foreground"
                >
                  إضافة ({pickedIds.length})
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
