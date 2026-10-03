'use client';

// Fast search with live suggestions while typing (typeahead).
// Debounced queries hit /api/products?q= — results show image, name,
// price and jump straight to the product page; Enter opens /search?q=.
// U14 — rebuilt at a NEW PATH (search-dialog-v2): the old path was pinned
// by the platform's stale PolarFS mirror which kept resurrecting the
// pre-restore corrupted copy regardless of writes.
// NOTE: useState results are consumed via index access on purpose (see
// the session log) — a transport bug in the ops shell eats bracket-h
// sequences, so the file avoids that pattern entirely.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
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

export function SearchDialogV2({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { ar, t } = useT();
  // U19-SETTINGS — currency label from Studio
  const currency = useStorePrefs((s) => s.currency);
  useEffect(() => { void useStorePrefs.getState().ensure(); }, []);
  const router = useRouter();
  const qState = useState('');
  const q = qState[0];
  const setQ = qState[1];
  const hitsState = useState<Hit[]>([]);
  const hits = hitsState[0];
  const setHits = hitsState[1];
  const loadingState = useState(false);
  const loading = loadingState[0];
  const setLoading = loadingState[1];
  const searchedState = useState(false);
  const searched = searchedState[0];
  const setSearched = searchedState[1];
  const catsState = useState<{ id: string; slug: string; nameAr: string; nameEn?: string }[]>([]);
  const cats = catsState[0];
  const setCats = catsState[1];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setSearched(false);
      return;
    }
    // SEARCH-FUZZY — live categories for the empty-results suggestions
    fetch('/api/store/bootstrap')
      .then((r) => r.json())
      .then((d) => {
        const list = d?.categories || d?.data?.categories || [];
        setCats(Array.isArray(list) ? list.slice(0, 8) : []);
      })
      .catch(() => {});
  }, [open, setHits, setQ, setSearched]);

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
  }, [q, setHits, setLoading, setSearched]);

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
          <DialogTitle className="text-lg font-bold">{t.searchTitle}</DialogTitle>
          <DialogDescription className="sr-only">{t.searchHintAria}</DialogDescription>
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
              placeholder={t.searchPlaceholder}
              aria-label={t.search}
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
                {t.search}
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
                    <img src={h.image} alt="" aria-hidden className="h-12 w-12 rounded-xl object-cover" loading="lazy" />
                    <span className="flex-1">
                      <span className="block text-sm font-bold leading-snug">{ar ? h.nameAr : h.nameEn}</span>
                      {h.category?.nameAr && (
                        <span className="block text-xs text-muted-foreground">{h.category.nameAr}</span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {h.price.toLocaleString('en-US')} <span className="text-[10px]">{currency || t.egp}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {searched && !loading && hits.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <SearchX className="h-6 w-6 text-muted-foreground/50" aria-hidden />
                {t.searchNoResults.split('{q}').join(q.trim())}
              </p>
              {/* SEARCH-FUZZY — empty results offer the live categories instead
                  of a dead end (the categories come from the same bootstrap the
                  storefront already caches) */}
              {cats.length > 0 && (
                <div className="flex max-w-sm flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{ar ? 'تصفحي التصنيفات:' : 'Browse categories:'}</span>
                  {cats.slice(0, 6).map((c) => (
                    <Link
                      key={c.id}
                      href={`/c/${c.slug}`}
                      onClick={() => onOpenChange(false)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/75 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {ar ? c.nameAr : c.nameEn || c.nameAr}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {!searched && (
            <div className="flex flex-wrap items-center gap-2 px-2 py-3">
              <span className="text-xs font-bold text-muted-foreground">{t.searchTrending}</span>
              {(t.searchTrends.split(/[,،]/).map((s) => s.trim()).filter(Boolean)).map((s) => (
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
