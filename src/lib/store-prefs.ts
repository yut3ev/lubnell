'use client';

// U19-SETTINGS — shared client prefs pulled from /api/store/bootstrap once
// per browser session: the currency label she sets in Studio, and the minimum
// order total. Any storefront money surface can read these with graceful
// fallbacks (t.egp / no minimum) while the fetch is in flight or on failure.
import { create } from 'zustand';

type StorePrefs = {
  currency: string | null; // e.g. "ج.م" / "EGP" — null = not resolved yet
  minOrderTotal: number;
  loaded: boolean;
  ensure: () => Promise<void>;
};

let inflight: Promise<void> | null = null;

export const useStorePrefs = create<StorePrefs>()((set, get) => ({
  currency: null,
  minOrderTotal: 0,
  loaded: false,
  ensure: () => {
    if (get().loaded) return Promise.resolve();
    inflight ??= fetch('/api/store/bootstrap', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const currency =
          typeof d?.currency === 'string' && d.currency.trim() ? d.currency.trim() : null;
        const min = Number(d?.minOrderTotal);
        set({
          currency,
          minOrderTotal: Number.isFinite(min) && min > 0 ? min : 0,
          loaded: true,
        });
      })
      .catch(() => {
        set({ loaded: true });
      });
    return inflight;
  },
}));
