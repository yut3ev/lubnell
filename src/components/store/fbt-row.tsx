'use client';

// U14 — Frequently Bought Together: «اشتريهم مع بعض».
// A compact bundle row on the PDP: pick any combination of companion
// products, see the combined total update live, add them all to the bag
// in one tap. Real products only (same category, picked server-side).
import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, ShoppingBag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { useStorePrefs } from '@/lib/store-prefs';
import { Button } from '@/components/ui/button';
import type { ProductCardData } from '@/components/store/product-card';

export function FbtRow({ products }: { products: ProductCardData[] }) {
  const { ar, t } = useT();
  // U19-SETTINGS — currency label from Studio
  const currency = useStorePrefs((s) => s.currency);
  useEffect(() => { void useStorePrefs.getState().ensure(); }, []);
  const add = useCart((s) => s.add);
  const [selected, setSelected] = useState<string[]>(() => products.map((p) => p.id));

  const chosen = useMemo(() => products.filter((p) => selected.includes(p.id)), [products, selected]);
  const total = chosen.reduce((s, p) => s + p.price, 0);
  const maxStandalone = Math.max(...chosen.map((p) => p.price), 0);
  const bundleSaving = chosen.length > 1 ? maxStandalone : 0; // visual anchor: bundle ≥ priciest single

  if (products.length < 2) return null;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function addAll() {
    if (chosen.length === 0) return;
    for (const p of chosen) {
      add(
        {
          id: p.id,
          slug: p.slug,
          nameAr: ar ? p.nameAr : p.nameEn,
          price: p.price,
          image: p.image,
        },
        1
      );
    }
    toast({
      title: t.fbtToast,
      description: t.fbtToastSub.split('{n}').join(String(chosen.length)),
    });
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-2 sm:px-6" aria-label={t.fbtTitle}>
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4.5 w-4.5 text-primary" aria-hidden />
          <h2 className="text-base font-extrabold">{t.fbtTitle}</h2>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {products.map((p, i) => {
            const on = selected.includes(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3">
                {i > 0 && <Plus className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />}
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={`w-36 shrink-0 rounded-2xl border p-2.5 text-right transition-all ${
                    on ? 'border-primary bg-secondary/50 shadow-sm' : 'border-border/50 bg-background opacity-70 hover:opacity-100'
                  }`}
                >
                  <span className="relative block">
                    <img src={p.image} alt={p.nameAr} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
                    <span
                      className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'
                      }`}
                      aria-hidden
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </span>
                  <span className="mt-1.5 block truncate text-xs font-bold">{ar ? p.nameAr : p.nameEn}</span>
                  <span className="block text-xs font-bold text-primary">
                    {p.price.toLocaleString('en-US')} {currency || t.egp}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground">
            {t.fbtTotal.split('{n}').join(String(chosen.length))}
          </span>
          <strong className="text-lg font-bold text-primary">
            {total.toLocaleString('en-US')} {currency || t.egp}
          </strong>
          {bundleSaving > 0 && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
              {t.fbtSaving}
            </span>
          )}
          <Button
            onClick={addAll}
            disabled={chosen.length === 0}
            className="mr-auto h-10 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {t.fbtAdd}
          </Button>
        </div>
      </div>
    </section>
  );
}
