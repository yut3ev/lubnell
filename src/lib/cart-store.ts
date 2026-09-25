'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, WHATSAPP_NUMBER } from '@/lib/constants';

export { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, WHATSAPP_NUMBER };

export interface CartItem {
  id: string;
  slug: string;
  nameAr: string;
  price: number;
  image: string;
  variant?: string; // U85-VARIANTS — «الريحة: تفاح · اللون: أحمر»
  key?: string; // U85 — cart-line key: id + variant (variants of one product = separate lines)
  qty: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

const lineKey = (id: string, variant?: string) => (variant ? `${id}::${variant}` : id);

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((state) => {
          const key = lineKey(item.id, item.variant);
          const existing = state.items.find((i) => (i.key || i.id) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                (i.key || i.id) === key ? { ...i, qty: i.qty + qty } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, key, qty }] };
        }),
      remove: (key) =>
        set((state) => ({ items: state.items.filter((i) => (i.key || i.id) !== key) })),
      setQty: (key, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => (i.key || i.id) !== key)
              : state.items.map((i) => ((i.key || i.id) === key ? { ...i, qty } : i)),
        })),
      clear: () => set({ items: [] }),
    }),
    // U23-HYDRA-BOOT — skipHydration: with plain persist, localStorage is
    // read synchronously BEFORE React's first client render, so every
    // shopper with items in the cart hydrated a header/bottom-nav/count
    // badge (and the whole cart page) that the server never rendered —
    // "A tree hydrated but some attributes… didn't match" on EVERY reload.
    // <StoreBoot /> rehydrates right after mount instead: first paint always
    // matches SSR, the saved cart pops in a beat later.
    { name: 'lubnel-cart', skipHydration: true }
  )
);

export function cartTotals(
  items: CartItem[],
  // U19-SETTINGS — dynamic values from Studio (بيانات المتجر) win when passed;
  // defaults keep older callers working unchanged.
  opts?: { shippingFee?: number; freeShippingThreshold?: number }
) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = opts?.shippingFee;
  const threshold = opts?.freeShippingThreshold;
  const shipping =
    items.length === 0 || subtotal >= (threshold ?? FREE_SHIPPING_THRESHOLD)
      ? 0
      : fee ?? SHIPPING_FEE;
  return { subtotal, shipping, total: subtotal + shipping };
}
