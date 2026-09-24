'use client';

// U23-HYDRA-BOOT — post-mount rehydration for the persisted client stores.
//
// Both `useLang` and `useCart` are zustand `persist` stores. Plain persist
// reads localStorage synchronously BEFORE React's first client render, so
// the first render could disagree with the server HTML:
//   • useCart  → a shopper with saved items hydrated an extra count badge
//     in the header + bottom-nav (and a non-empty cart page) that SSR never
//     rendered → hydration mismatch on EVERY reload with a full cart.
//   • useLang  → a visitor whose last pick was EN hydrated an all-English,
//     LTR tree against the Arabic SSR HTML → the "hundreds of diff lines"
//     hydration error class.
// With `skipHydration: true` on both stores, the first client render is
// byte-identical to SSR; this component then rehydrates them right after
// mount, so the saved cart/language appear a beat later with zero console
// noise. Rendered once from the root layout, covers every route.
import { useEffect } from 'react';
import { useCart } from '@/lib/cart-store';
import { useLang } from '@/lib/i18n';

export function StoreBoot() {
  useEffect(() => {
    try {
      useLang.persist.rehydrate();
    } catch {
      /* corrupted storage → keep defaults */
    }
    try {
      useCart.persist.rehydrate();
    } catch {
      /* corrupted storage → keep empty cart */
    }
  }, []);

  return null;
}
