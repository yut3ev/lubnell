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

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, SearchX, ShoppingBag, Check, History, X } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { useCart } from '@/lib/cart-store';
import { toast } from '@/hooks/use-toast';
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
  const currency = useStorePrefs((s) => s.currency);
  const addItem = useCart((s) => s.add);
  useEffect(() => { void useStorePrefs.getState().ensure(); }, []);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cats, setCats] = useState<{ id: string; slug: string; nameAr: string; nameEn?: string }[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lubnel_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 5));
      }
    } catch {}
  }, [open]);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5);
      try {
        localStorage.setItem('lubnel_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== term);
      try {
        localStorage.setItem('lubnel_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setSearched(false);
      setActiveFilter('all');
      return;
    }
    fetch('/api/store/bootstrap')
      .then((r) => r.json())
      .then((d) => {
        const list = d?.categories || d?.data?.categories || [];
        setCats(Array.isArray(list) ? list.slice(0, 8) : []);
      })
      .catch(() => {});
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
        setHits((data?.ok && Array.isArray(data.products) ? data.products : []).slice(0, 10));
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function submitFullSearch(termOverride?: string) {
    const term = (termOverride || q).trim();
    if (!term) return;
    saveRecentSearch(term);
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  // Quick filter items
  const displayHits = useMemo(() => {
    if (activeFilter === 'under150') return hits.filter((h) => h.price <= 150);
    if (activeFilter === 'offers') {
      return hits.filter(
        (h) => h.category?.nameAr?.includes('عرض') || h.nameAr.includes('بوكس') || h.nameAr.includes('عرض')
      );
    }
    if (activeFilter !== 'all') {
      return hits.filter(
        (h) => h.category?.nameAr === activeFilter || h.nameAr.includes(activeFilter)
      );
    }
    return hits;
  }, [hits, activeFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-3xl p-0 sm:max-w-xl flex flex-col gap-0 overflow-hidden"
        style={{
          width: 'calc(100vw - 2rem)',
          maxWidth: 'min(576px, calc(100vw - 2rem))',
        }}
      >
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2 min-w-0">
          <DialogTitle className="text-base sm:text-lg font-bold">{t.searchTitle}</DialogTitle>
          <DialogDescription className="sr-only">{t.searchHintAria}</DialogDescription>
        </DialogHeader>

        <div className="px-3 sm:px-5 w-full min-w-0 overflow-hidden">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitFullSearch();
            }}
            className="relative w-full min-w-0"
          >
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.search}
              className="h-11 sm:h-12 w-full rounded-full border border-border bg-background pr-10 pl-20 sm:pl-24 text-sm sm:text-[15px] font-semibold outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
            {loading ? (
              <Loader2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />
            ) : (
              <Button
                type="submit"
                size="sm"
                className="absolute left-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-primary px-3 sm:px-4 text-xs font-bold text-primary-foreground"
              >
                {t.search}
              </Button>
            )}
          </form>

          {/* Quick Filter Chips (Feature 7) */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs w-full min-w-0">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`rounded-full px-3 py-1 font-bold transition-all shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/70 text-foreground hover:bg-secondary'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('under150')}
              className={`rounded-full px-3 py-1 font-bold transition-all shrink-0 ${
                activeFilter === 'under150'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/70 text-foreground hover:bg-secondary'
              }`}
            >
              أقل من 150 ج.م
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('offers')}
              className={`rounded-full px-3 py-1 font-bold transition-all shrink-0 ${
                activeFilter === 'offers'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/70 text-foreground hover:bg-secondary'
              }`}
            >
              عروض وتخفيضات 🏷️
            </button>
            {cats.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveFilter(activeFilter === c.nameAr ? 'all' : c.nameAr)}
                className={`rounded-full px-3 py-1 font-bold transition-all shrink-0 ${
                  activeFilter === c.nameAr
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/70 text-foreground hover:bg-secondary'
                }`}
              >
                {c.nameAr}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[54vh] overflow-y-auto overflow-x-hidden px-2 sm:px-4 pb-4 pt-2 w-full min-w-0">
          {displayHits.length > 0 && (
            <ul className="space-y-1.5 w-full min-w-0">
              {displayHits.map((h) => (
                <li key={h.id} className="w-full min-w-0">
                  <div className="group flex items-center justify-between gap-2 sm:gap-3 rounded-2xl p-2 sm:p-2.5 transition-colors hover:bg-secondary w-full min-w-0">
                    <Link
                      href={`/p/${h.slug}`}
                      onClick={() => {
                        saveRecentSearch(h.nameAr);
                        onOpenChange(false);
                      }}
                      className="flex flex-1 items-center gap-2.5 sm:gap-3 min-w-0 overflow-hidden"
                    >
                      <img
                        src={h.image}
                        alt=""
                        aria-hidden
                        className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-cover border border-border/40 shrink-0"
                        loading="lazy"
                      />
                      <span className="flex-1 min-w-0 overflow-hidden">
                        <span className="block text-xs sm:text-sm font-bold leading-snug truncate">
                          {ar ? h.nameAr : h.nameEn}
                        </span>
                        {h.category?.nameAr && (
                          <span className="block text-[11px] sm:text-xs text-muted-foreground truncate">
                            {h.category.nameAr}
                          </span>
                        )}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-primary shrink-0 px-1 sm:px-1.5 whitespace-nowrap">
                        {h.price.toLocaleString('en-US')} <span className="text-[10px]">{currency || t.egp}</span>
                      </span>
                    </Link>

                    {/* Quick Add To Cart Button */}
                    <button
                      type="button"
                      aria-label={`إضافة ${h.nameAr} للحقيبة`}
                      onClick={(e) => {
                        e.stopPropagation();
                        addItem(
                          {
                            id: h.id,
                            slug: h.slug,
                            nameAr: h.nameAr,
                            price: h.price,
                            image: h.image,
                          },
                          1
                        );
                        toast({
                          title: 'أُضيف إلى الحقيبة 🌸',
                          description: h.nameAr,
                        });
                      }}
                      className="flex h-8 items-center justify-center gap-1 rounded-full bg-primary/10 px-2.5 sm:px-3 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white shrink-0 active:scale-95"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span className="text-[11px] sm:text-xs">+ السلة</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {searched && !loading && displayHits.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <SearchX className="h-6 w-6 text-muted-foreground/50" aria-hidden />
                {t.searchNoResults.split('{q}').join(q.trim())}
              </p>
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
            <div className="space-y-4 px-2 py-3">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <History className="h-3.5 w-3.5" />
                      عمليات البحث الأخيرة
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        try {
                          localStorage.removeItem('lubnel_recent_searches');
                        } catch {}
                      }}
                      className="text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      مسح الكل
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pe-2 ps-3 text-xs font-bold text-foreground/85 transition-colors hover:border-primary/40"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setQ(s);
                            submitFullSearch(s);
                          }}
                        >
                          {s}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecentSearch(s)}
                          aria-label={`حذف ${s}`}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending suggestions */}
              <div>
                <span className="mb-2 block text-xs font-bold text-muted-foreground">{t.searchTrending}</span>
                <div className="flex flex-wrap gap-2">
                  {t.searchTrends.split(/[,،]/).map((s) => s.trim()).filter(Boolean).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setQ(s);
                        saveRecentSearch(s);
                      }}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/75 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
