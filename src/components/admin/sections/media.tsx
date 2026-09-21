'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { apiJson, fmtDay, loadAdminToken } from '../helpers';
import { useToast } from '@/hooks/use-toast';

type MediaAsset = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  altText: string;
  createdAt: string;
};

export default function MediaSection() {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; media: MediaAsset[] }>('/api/admin/media');
    // U15 — the route returns {media:[...]} (legacy shape); accept both so
    // the library never shows a false «فارغة» after successful uploads.
    if (ok && (data?.ok || Array.isArray(data?.media))) setAssets(data.media);
    else setAssets([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('altText', file.name.replace(/\.[^/.]+$/, ''));
      // U15 — send the token fallback header (cookie may be blocked in the
      // embedded preview) + accept both ok and success response shapes.
      const token = loadAdminToken();
      const res = await fetch('/api/admin/media', { method: 'POST', body: form, headers: token ? { 'x-admin-token': token } : undefined });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok || data?.success)) {
        toast({ title: 'تم رفع الصورة بنجاح' });
        await load();
      } else {
        toast({ title: data?.error || 'تعذر رفع الصورة', variant: 'destructive' });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: string) {
    const { ok } = await apiJson(`/api/admin/media?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (ok) {
      setAssets((a) => (a ? a.filter((x) => x.id !== id) : a));
      toast({ title: 'تم حذف الصورة' });
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: 'انسخي الرابط يدويًا: ' + url, description: undefined });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02]">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {uploading ? 'جاري الرفع…' : 'رفع صورة جديدة'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        <span className="text-xs text-muted-foreground">PNG / JPG / WEBP — حتى 8MB</span>
      </div>

      {assets === null && <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>}
      {assets !== null && assets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">مكتبة الوسائط فارغة — ارفعي أول صورة لاستخدامها في السلايدر والمنتجات.</p>
        </div>
      )}

      {assets !== null && assets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <figure key={a.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="relative aspect-square overflow-hidden bg-secondary/40">
                <img src={a.url} alt={a.altText || a.fileName} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={() => remove(a.id)}
                  className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/85 text-destructive opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label={`حذف ${a.fileName}`}
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <figcaption className="flex items-center justify-between gap-2 p-2.5">
                <span className="min-w-0 truncate text-xs text-muted-foreground" title={a.fileName}>{a.fileName}</span>
                <button
                  onClick={() => copyUrl(a.url)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-transform hover:scale-110"
                  aria-label="نسخ الرابط"
                  title="نسخ الرابط"
                >
                  {copied === a.url ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </figcaption>
              <p className="px-2.5 pb-2 text-[10px] text-muted-foreground/70">{fmtDay(a.createdAt)}</p>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
