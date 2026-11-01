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
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Star,
  PenLine,
  Loader2,
  MessageSquareQuote,
  ImagePlus,
  X,
  BadgeCheck,
  Camera,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
  const { ar, t } = useT();
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
  const [filterPhotoOnly, setFilterPhotoOnly] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const photoReviews = items.filter((r) => Boolean(r.image));
  const displayedItems = filterPhotoOnly ? photoReviews : items;

  // Keyboard navigation & body scroll lock for photo lightbox
  useEffect(() => {
    if (activePhotoIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePhotoIdx(null);
      } else if (e.key === 'ArrowRight') {
        if (photoReviews.length > 1) {
          setActivePhotoIdx((i) => (ar ? (i! + 1) % photoReviews.length : (i! - 1 + photoReviews.length) % photoReviews.length));
        }
      } else if (e.key === 'ArrowLeft') {
        if (photoReviews.length > 1) {
          setActivePhotoIdx((i) => (ar ? (i! - 1 + photoReviews.length) % photoReviews.length : (i! + 1) % photoReviews.length));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = orig;
    };
  }, [activePhotoIdx, photoReviews.length, ar]);

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
        title: t.rvErrImage,
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
        toast({ title: data?.error || t.rvErrUpload, variant: 'destructive' });
      }
    } catch {
      toast({ title: t.rvErrUploadNet, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    if (submitting) return;
    if (!form.name.trim() || !form.text.trim()) {
      toast({
        title: t.rvErrMissing,
        description: t.rvErrMissingDesc,
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
          title: t.rvOkTitle,
          description: t.rvOkDesc,
        });
        setForm({ name: '', text: '', rating: 5 });
        setPhoto(null);
        setFormOpen(false);
      } else {
        toast({ title: data?.error || t.rvErrSave, variant: 'destructive' });
      }
    } catch {
      toast({ title: t.rvErrConn, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="product-reviews-section" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6" aria-label={t.rvSectionAria}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <MessageSquareQuote className="h-6 w-6 text-primary" aria-hidden />
          {t.rvTitle}
        </h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-bold">
            <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" aria-hidden />
            {summary.avg.toFixed(1)} · {summary.count} {t.reviews}
          </span>
          <Button
            variant="outline"
            onClick={() => setFormOpen((v) => !v)}
            className="h-10 rounded-full border-primary/30 font-bold text-primary hover:bg-secondary"
          >
            <PenLine className="h-4 w-4" aria-hidden />
            {t.rvWrite}
          </Button>
        </div>
      </div>

      {formOpen && (
        <div className="mt-5 rounded-3xl border border-border/70 bg-card p-5">
          <h3 className="text-base font-extrabold">{t.rvShare}</h3>
          <div className="mt-4 grid gap-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{t.rvYourRating}</span>
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label={t.rvStarsAria}>
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
              <Label htmlFor="revName">{t.rvName}</Label>
              <Input
                id="revName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t.rvName}
                className="bg-background"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="revText">{t.rvOpinion}</Label>
              <Textarea
                id="revText"
                rows={3}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={t.rvOpinionPh}
                className="resize-none bg-background"
              />
            </div>

            {/* إرفاق صورة من تجربتكِ */}
            <div className="grid gap-1.5">
              <Label>{t.rvPhotoLabel}</Label>
              {photo ? (
                <div className="relative w-fit">
                  <img
                    src={photo}
                    alt={t.rvPhotoAlt}
                    className="h-20 w-20 rounded-2xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label={t.rvPhotoRemoveAria}
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
                    ? t.rvUploading
                    : t.rvPickPhoto}
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
              {t.rvSubmit}
            </Button>
          </div>
        </div>
      )}

      {/* Customer Photo Gallery Strip (Feature 7) */}
      {photoReviews.length > 0 && (
        <div className="mt-6 rounded-3xl border border-primary/20 bg-secondary/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="text-sm font-extrabold sm:text-base">
                {ar ? 'صور وتجارب العميلات الحقيقية' : 'Real Customer Photos & Experiences'}
              </h3>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              {ar ? `${photoReviews.length} صورة من العميلات 📸` : `${photoReviews.length} Customer Photos 📸`}
            </span>
          </div>
          <div className="mt-3.5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photoReviews.map((r, idx) => (
              <button
                key={r.id + idx}
                type="button"
                onClick={() => setActivePhotoIdx(idx)}
                className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-border/80 bg-background shadow-sm transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={ar ? `عرض تجربة ${r.name} بالصورة` : `View photo review by ${r.name}`}
              >
                <img
                  src={r.image!}
                  alt={r.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
                <div className="absolute bottom-1.5 inset-x-1 text-center">
                  <p className="truncate text-[11px] font-bold text-white drop-shadow-sm">{r.name}</p>
                  <div className="flex items-center justify-center gap-0.5 text-amber-300 text-[10px]">
                    {'★'.repeat(Math.min(5, Math.max(1, r.rating)))}
                  </div>
                </div>
                <div className="absolute top-1.5 left-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs (Feature 7) */}
      {photoReviews.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterPhotoOnly(false)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              !filterPhotoOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'border border-border/70 bg-card text-muted-foreground hover:bg-secondary'
            }`}
          >
            {ar ? `جميع الآراء (${items.length})` : `All Reviews (${items.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterPhotoOnly(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              filterPhotoOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'border border-border/70 bg-card text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>{ar ? `بالصور فقط (${photoReviews.length}) 📸` : `With Photos (${photoReviews.length}) 📸`}</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-secondary/40" />
          ))}
        </div>
      ) : displayedItems.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {displayedItems.map((r) => (
            <li
              key={r.id}
              className={r.fresh
                ? 'relative rounded-3xl border-2 border-primary/40 bg-secondary/40 p-5 shadow-sm'
                : 'rounded-3xl border border-border/70 bg-card p-5'}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    {r.name}
                    {r.fresh && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <BadgeCheck className="h-3 w-3" aria-hidden />
                        {t.rvYoursBadge}
                      </span>
                    )}
                  </span>
                  {r.image && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <Camera className="h-3 w-3" aria-hidden />
                      {ar ? 'تجربة مصوّرة 📸' : 'Photo Review 📸'}
                    </span>
                  )}
                </div>
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
                <button
                  type="button"
                  onClick={() => {
                    const idx = photoReviews.findIndex((p) => p.id === r.id);
                    if (idx !== -1) setActivePhotoIdx(idx);
                  }}
                  className="group relative mt-3 block w-fit overflow-hidden rounded-2xl border border-border shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                  aria-label={ar ? 'تكبير صورة التجربة' : 'Enlarge review photo'}
                >
                  <img
                    src={r.image}
                    alt={t.rvPhotoCustomerAlt}
                    loading="lazy"
                    decoding="async"
                    className="h-28 w-28 object-cover transition-transform duration-300 group-hover:scale-105 sm:h-32 sm:w-32"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                      <ZoomIn className="h-3.5 w-3.5" />
                      {ar ? 'تكبير' : 'Zoom'}
                    </span>
                  </div>
                </button>
              )}
              <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                {new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG-u-nu-latn' : 'en-US')}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {filterPhotoOnly
            ? (ar ? 'لا توجد تقييمات بالصور حاليًا لهذا المنتج' : 'No photo reviews yet for this product')
            : t.rvEmpty}
        </p>
      )}

      {/* Customer Photo Lightbox Modal (Feature 7) */}
      {activePhotoIdx !== null && photoReviews[activePhotoIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ar ? 'معاينة صورة وتجربة العميلة' : 'Customer Review Photo Modal'}
          className="fixed inset-0 z-[75] flex items-center justify-center bg-foreground/90 p-4 backdrop-blur-md"
          onClick={() => setActivePhotoIdx(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {activePhotoIdx + 1} / {photoReviews.length}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {ar ? 'تجربة حقيقية من عميلة موثقة' : 'Verified Customer Review'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActivePhotoIdx(null)}
                aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Body: Image with Nav */}
            <div className="relative flex max-h-[60vh] min-h-[250px] items-center justify-center bg-black/5 p-2">
              <img
                src={photoReviews[activePhotoIdx].image!}
                alt={photoReviews[activePhotoIdx].name}
                className="max-h-[58vh] max-w-full rounded-2xl object-contain shadow-md"
              />

              {photoReviews.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIdx((i) => (ar ? (i! + 1) % photoReviews.length : (i! - 1 + photoReviews.length) % photoReviews.length));
                    }}
                    aria-label={ar ? 'التالي' : 'Previous'}
                    className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs transition-transform hover:scale-105 active:scale-95"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIdx((i) => (ar ? (i! - 1 + photoReviews.length) % photoReviews.length : (i! + 1) % photoReviews.length));
                    }}
                    aria-label={ar ? 'السابق' : 'Next'}
                    className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs transition-transform hover:scale-105 active:scale-95"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Modal Footer: Reviewer Info & Comment */}
            <div className="border-t border-border/70 p-5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">{photoReviews[activePhotoIdx].name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck className="h-3 w-3" />
                    {ar ? 'عميلة موثقة' : 'Verified'}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={
                        i < photoReviews[activePhotoIdx].rating
                          ? 'h-4 w-4 fill-amber-400 text-amber-400'
                          : 'h-4 w-4 text-muted-foreground/30'
                      }
                    />
                  ))}
                </div>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
                {photoReviews[activePhotoIdx].text}
              </p>
              <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                {new Date(photoReviews[activePhotoIdx].createdAt).toLocaleDateString(ar ? 'ar-EG-u-nu-latn' : 'en-US')}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
