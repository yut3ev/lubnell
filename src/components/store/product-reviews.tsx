'use client';

// PDP reviews — REAL reviews from the DB + the write-review form.
//
// U18-REVIEWS — switched to the working endpoint /api/products/[slug]/reviews
// (the old /api/store/reviews queried non-existent models) and reviews are now
// published INSTANTLY (auto-approved, moderatable from Studio → التقييمات),
// so the header shows the live average + count from the DB, not props.
//   شاركي تجربتكِ · اسمكِ · ★★★★★ · اكتبي رأيكِ في المنتج… ·
//   إرفاق صورة من تجربتكِ · نشر التقييم
// Photos are compressed client-side (shared compressImage helper) then stored
// via the public /api/store/reviews/upload endpoint; the review row keeps the
// URL in Review.image and cards render the attachment.
import { useEffect, useRef, useState } from 'react';
import { Star, PenLine, Loader2, MessageSquareQuote, ImagePlus, X, BadgeCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { compressImage } from '@/lib/lubnel-helpers';

type ReviewItem = {
  id: string;
  name: string;
  text: string;
  rating: number;
  image?: string | null;
  createdAt: string;
  fresh?: boolean; // just-published by this visitor — highlight it
};

export function ProductReviews({
  slug,
  rating,
  reviewsCount,
}: {
  slug: string;
  rating: number;
  reviewsCount: number;
}) {
  const { ar } = useT();
  const [items, setItems] = useState<ReviewItem[]>([]);
  // U18 — live aggregates from the DB win over the server-rendered props, so
  // the numbers on screen are always the real approved reviews.
  const [summary, setSummary] = useState({ avg: rating, count: reviewsCount });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', text: '', rating: 5 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!alive || !data?.ok || !Array.isArray(data.reviews)) return;
        setItems(
          data.reviews.map((r: { id: string; name: string; rating: number; comment: string; image?: string | null; createdAt: string }) => ({
            id: r.id,
            name: r.name,
            text: r.comment,
            rating: r.rating,
            image: r.image ?? null,
            createdAt: r.createdAt,
          }))
        );
        if (data.summary && typeof data.summary.avg === 'number') {
          setSummary({ avg: data.summary.avg, count: data.summary.count });
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  async function handlePhoto(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: ar ? 'الملف لازم يكون صورة' : 'Please pick an image',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const payload = await compressImage(file, 1400, 0.8);
      const fd = new FormData();
      fd.append('file', payload);
      const res = await fetch('/api/store/reviews/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        setPhoto(data.url);
      } else {
        toast({ title: data?.error || (ar ? 'تعذر رفع الصورة' : 'Upload failed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: ar ? 'تعذر رفع الصورة — تأكدي من الشبكة' : 'Upload failed — check your connection', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    if (submitting) return;
    if (!form.name.trim() || !form.text.trim()) {
      toast({
        title: ar ? 'بيانات ناقصة' : 'Missing details',
        description: ar ? 'اكتبي اسمكِ وتجربتكِ مع المنتج أولًا.' : 'Please add your name and review text.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          text: form.text,
          rating: form.rating,
          ...(photo ? { image: photo } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && (data?.ok || data?.success)) {
        // U18 — real reviews publish instantly: show it in the list right away
        const created = data?.review;
        setItems((prev) => [
          {
            id: created?.id || `local-${Date.now()}`,
            name: form.name.trim(),
            text: form.text.trim(),
            rating: form.rating,
            image: photo,
            createdAt: created?.createdAt || new Date().toISOString(),
            fresh: true,
          },
          ...prev,
        ]);
        if (data?.summary && typeof data.summary.avg === 'number') {
          setSummary({ avg: data.summary.avg, count: data.summary.count });
        }
        toast({
          title: ar ? 'تم نشر تقييمكِ 🌸' : 'Your review is live!',
          description: ar ? 'شكرًا لمشاركة تجربتكِ — تقييمكِ ظاهر الآن للجميع.' : 'Thanks for sharing — your review is now visible to everyone.',
        });
        setForm({ name: '', text: '', rating: 5 });
        setPhoto(null);
        setFormOpen(false);
      } else {
        toast({ title: data?.error || (ar ? 'تعذر حفظ التقييم' : 'Could not save review'), variant: 'destructive' });
      }
    } catch {
      toast({ title: ar ? 'خطأ في الاتصال' : 'Connection error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6" aria-label={ar ? 'التقييمات' : 'Reviews'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <MessageSquareQuote className="h-6 w-6 text-primary" aria-hidden />
          {ar ? 'تقييمات العميلات' : 'Customer reviews'}
        </h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-bold">
            <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" aria-hidden />
            {summary.avg.toFixed(1)} · {summary.count} {ar ? 'تقييم' : 'reviews'}
          </span>
          <Button
            variant="outline"
            onClick={() => setFormOpen((v) => !v)}
            className="h-10 rounded-full border-primary/30 font-bold text-primary hover:bg-secondary"
          >
            <PenLine className="h-4 w-4" aria-hidden />
            {ar ? 'اكتبي تقييمكِ' : 'Write a review'}
          </Button>
        </div>
      </div>

      {formOpen && (
        <div className="mt-5 rounded-3xl border border-border/70 bg-card p-5">
          <h3 className="text-base font-extrabold">{ar ? 'شاركي تجربتكِ' : 'Share your experience'}</h3>
          <div className="mt-4 grid gap-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{ar ? 'تقييمكِ:' : 'Your rating:'}</span>
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label={ar ? 'النجوم' : 'Stars'}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} / 5`}
                    onClick={() => setForm((f) => ({ ...f, rating: n }))}
                    className="p-0.5"
                  >
                    <Star
                      className={
                        n <= form.rating
                          ? 'h-6 w-6 fill-amber-400 text-amber-400'
                          : 'h-6 w-6 text-muted-foreground/40'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="revName">{ar ? 'اسمكِ' : 'Your name'}</Label>
              <Input
                id="revName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={ar ? 'اسمكِ' : 'Your name'}
                className="bg-background"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="revText">{ar ? 'رأيكِ' : 'Your review'}</Label>
              <Textarea
                id="revText"
                rows={3}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={ar ? 'اكتبي رأيكِ في المنتج...' : 'Write your review of the product...'}
                className="resize-none bg-background"
              />
            </div>

            {/* إرفاق صورة من تجربتكِ */}
            <div className="grid gap-1.5">
              <Label>{ar ? 'إرفاق صورة من تجربتكِ' : 'Attach a photo of your experience'}</Label>
              {photo ? (
                <div className="relative w-fit">
                  <img
                    src={photo}
                    alt={ar ? 'صورة التجربة' : 'Review photo'}
                    className="h-20 w-20 rounded-2xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label={ar ? 'إزالة الصورة' : 'Remove photo'}
                    className="absolute -top-2 -left-2 grid h-6 w-6 place-items-center rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-110"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="h-4.5 w-4.5" aria-hidden />
                  )}
                  {uploading
                    ? ar ? 'جاري رفع الصورة…' : 'Uploading…'
                    : ar ? 'اختاري صورة من جهازكِ' : 'Choose a photo'}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
            </div>

            <Button
              onClick={submit}
              disabled={submitting}
              className="h-11 w-fit rounded-full bg-primary px-6 font-bold text-primary-foreground"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {ar ? 'نشر التقييم' : 'Post review'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-secondary/40" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((r) => (
            <li
              key={r.id}
              className={r.fresh
                ? 'relative rounded-3xl border-2 border-primary/40 bg-secondary/40 p-5 shadow-sm'
                : 'rounded-3xl border border-border/70 bg-card p-5'}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  {r.name}
                  {r.fresh && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <BadgeCheck className="h-3 w-3" aria-hidden />
                      {ar ? 'تقييمكِ' : 'yours'}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-0.5" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={
                        i < r.rating
                          ? 'h-3.5 w-3.5 fill-amber-400 text-amber-400'
                          : 'h-3.5 w-3.5 text-muted-foreground/40'
                      }
                    />
                  ))}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">{r.text}</p>
              {r.image && (
                <a href={r.image} target="_blank" rel="noreferrer" className="mt-2.5 block w-fit">
                  <img
                    src={r.image}
                    alt={ar ? 'صورة من تجربة العيلة' : 'Customer photo'}
                    loading="lazy"
                    decoding="async"
                    className="h-24 w-24 rounded-2xl border border-border object-cover transition-transform hover:scale-105"
                  />
                </a>
              )}
              <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                {new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG-u-nu-latn' : 'en-US')}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {ar
            ? 'لا توجد تقييمات منشورة بعد لهذا المنتج — كوني أول من يشارك تجربتها 🌸'
            : 'No published reviews yet — be the first to share your experience 🌸'}
        </p>
      )}
    </section>
  );
}
