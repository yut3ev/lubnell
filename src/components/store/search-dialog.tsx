'use client';

// Fast search with live suggestions while typing (typeahead).
// Debounced queries hit /api/products?q= — results show image, name,
// price and jump straight to the product page; Enter opens /search?q=.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Hit = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  price: number;
  image: string;
  category?: { nameAr?: string } | null;
};

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { ar, t } = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setSearched(false);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setHits((data?.ok && Array.isArray(data.products) ? data.products : []).slice(0, 8));
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function submitFullSearch() {
    const term = q.trim();
    if (!term) return;
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl p-0 sm:max-w-xl">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-lg font-black">{ar ? 'ابحثي في لوبنيل' : 'Search LUBNÉL'}</DialogTitle>
          <DialogDescription className="sr-only">
            {ar ? 'اقتراحات فورية أثناء الكتابة' : 'Live suggestions as you type'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitFullSearch();
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'مكياج، سيروم، هدية…' : 'lipstick, serum, gift…'}
              aria-label={ar ? 'بحث' : 'Search'}
              className="h-12 w-full rounded-full border border-border bg-background pr-11 pl-24 text-[15px] font-semibold outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
            {loading ? (
              <Loader2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />
            ) : (
              <Button
                type="submit"
                size="sm"
                className="absolute left-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
              >
                {ar ? 'بحث' : 'Search'}
              </Button>
            )}
          </form>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-3 pb-4 pt-3">
          {hits.length > 0 && (
            <ul className="space-y-1">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/p/${h.slug}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-secondary"
                  >
                    <img src={h.image} alt="" aria-hidden className="h-12 w-12 rounded-xl object-cover" />
                    <span className="flex-1">
                      <span className="block text-sm font-bold leading-snug">{ar ? h.nameAr : h.nameEn}</span>
                      {h.category?.nameAr && (
                        <span className="block text-xs text-muted-foreground">{h.category.nameAr}</span>
                      )}
                    </span>
                    <span className="text-sm font-black text-primary">
                      {h.price.toLocaleString(ar ? 'ar-EG' : 'en-US')} <span className="text-[10px]">{t.egp}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {searched && !loading && hits.length === 0 && (
            <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <SearchX className="h-6 w-6 text-muted-foreground/50" aria-hidden />
              {ar
                ? `لا نتائج لـ "${q.trim()}" — جرّبي كلمة أخرى مثل: مكياج، سيروم، هدية.`
                : `No results for "${q.trim()}" — try another term.`}
            </p>
          )}

          {!searched && (
            <div className="flex flex-wrap items-center gap-2 px-2 py-3">
              <span className="text-xs font-bold text-muted-foreground">{ar ? 'الأكثر بحثًا:' : 'Popular:'}</span>
              {['مكياج', 'سيروم', 'هدية', 'عطر'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQ(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/75 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
