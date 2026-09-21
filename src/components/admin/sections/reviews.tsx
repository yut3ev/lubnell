'use client';

// Studio → «التقييمات» — moderate customer reviews: approve / unpublish /
// feature / delete. Backed by /api/admin/reviews (reviews.read/write).
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, EyeOff, Star, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { apiJson } from '../helpers';

type AdminReview = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  name: string;
  text: string;
  rating: number;
  image: string | null;
  approved: boolean;
  featured: boolean;
  helpfulCount: number;
  createdAt: string;
};

export default function ReviewsAdmin() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminReview | null>(null);
  const [tab, setTab] = useState<'pending' | 'published'>('pending');

  const load = useCallback(async () => {
    try {
      const { data } = await apiJson<{ ok: boolean; reviews: AdminReview[] }>('/api/admin/reviews');
      setReviews(data?.reviews || []);
    } catch {
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(review: AdminReview, action: string) {
    if (busy) return;
    setBusy(review.id + action);
    try {
      const { ok, data } = await apiJson<{ ok?: boolean; success?: boolean; error?: string }>(
        '/api/admin/reviews',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: review.id, action }),
        }
      );
      if (ok && (data?.success || data?.ok)) {
        toast({ title: 'تم التنفيذ ✅' });
        await load();
      } else {
        toast({ title: data?.error || 'تعذر تنفيذ الإجراء', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  const list = (reviews || []).filter((r) => (tab === 'pending' ? !r.approved : r.approved));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">التقييمات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            راجعي تقييمات العميلات قبل ظهورها في صفحات المنتجات.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { k: 'pending', label: 'بانتظار المراجعة' },
              { k: 'published', label: 'منشورة' },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              aria-pressed={tab === t.k}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                tab === t.k ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-primary'
              }`}
            >
              {t.label} ({(reviews || []).filter((r) => (t.k === 'pending' ? !r.approved : r.approved)).length})
            </button>
          ))}
        </div>
      </div>

      {reviews === null ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {tab === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة 🌸' : 'لا توجد تقييمات منشورة بعد.'}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="rounded-3xl border border-border/70 bg-card p-4">
              <div className="flex gap-3">
                {r.productImage && (
                  <img src={r.productImage} alt="" aria-hidden className="h-14 w-14 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{r.productTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.name} · <span dir="ltr">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span>
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold" aria-label={`${r.rating}/5`}>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden /> {r.rating}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">{r.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!r.approved && (
                  <Button size="sm" onClick={() => act(r, 'approve')} disabled={busy !== null}
                    className="h-8 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">
                    <Check className="h-3.5 w-3.5" aria-hidden /> نشر
                  </Button>
                )}
                {r.approved && (
                  <>
                    {!r.featured ? (
                      <Button size="sm" variant="outline" onClick={() => act(r, 'feature')} disabled={busy !== null}
                        className="h-8 rounded-full border-primary/30 px-3 text-xs font-bold text-primary">
                        <Star className="h-3.5 w-3.5" aria-hidden /> تثبيت
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => act(r, 'unfeature')} disabled={busy !== null}
                        className="h-8 rounded-full px-3 text-xs font-bold">
                        <Star className="h-3.5 w-3.5" aria-hidden /> إلغاء التثبيت
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => act(r, 'unpublish')} disabled={busy !== null}
                      className="h-8 rounded-full px-3 text-xs font-bold text-muted-foreground">
                      <EyeOff className="h-3.5 w-3.5" aria-hidden /> إخفاء
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => setConfirmDel(r)} disabled={busy !== null}
                  className="h-8 gap-1.5 rounded-full px-3 text-xs font-bold text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> حذف
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* delete confirmation */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التقييم؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف تقييم «{confirmDel?.name}» لمنتج «{confirmDel?.productTitle}» نهائيًا. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirmDel) act(confirmDel, 'delete');
                setConfirmDel(null);
              }}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
