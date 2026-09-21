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
  qty: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + qty } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),
      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
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
