'use client';

// U10-MOBILE-NAV — fixed bottom tab bar for phones: الرئيسية · التصنيفات ·
// البحث · السلة · المزيد. The store is mobile-first; this saves the trip
// back to the top on every action. Hidden from md up (desktop has the
// full header nav), safe-area aware, active tab highlighted per route.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  LayoutGrid,
  Search,
  ShoppingBag,
  Menu,
} from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { MoreSheet } from '@/components/store/more-sheet';

export function BottomNav({
  isAdmin = false,
  hasOffers = true,
}: {
  isAdmin?: boolean;
  hasOffers?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useT(); // U51-GLOBAL-TEXTS — nav labels are owner-editable
  const items = useCart((s) => s.items);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const [moreOpen, setMoreOpen] = useState(false);

  // never show the store chrome inside admin routes (defensive: the bar
  // lives in the (store) layout, so this is just belt & suspenders)
  if (pathname.startsWith('/admin')) return null;

  const isActive = (tab: 'home' | 'categories' | 'search' | 'cart') => {
    if (tab === 'home') return pathname === '/';
    if (tab === 'categories') return pathname.startsWith('/c/');
    if (tab === 'search') return pathname.startsWith('/search');
    return pathname.startsWith('/cart');
  };

  const tabClass = (active: boolean) =>
    `flex min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors ${
      active ? 'text-primary' : 'text-muted-foreground active:text-primary'
    }`;

  const labelClass = (active: boolean) =>
    `text-[10px] font-bold leading-none ${active ? 'text-primary' : ''}`;

  return (
    <>
      <nav
        aria-label={t.navBottomAria}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          <Link href="/" className={tabClass(isActive('home'))} aria-current={isActive('home') ? 'page' : undefined}>
            <Home className="h-[22px] w-[22px]" strokeWidth={isActive('home') ? 2.4 : 1.9} />
            <span className={labelClass(isActive('home'))}>{t.home}</span>
          </Link>

          <Link href="/#categories" className={tabClass(isActive('categories'))} aria-current={isActive('categories') ? 'page' : undefined}>
            <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={isActive('categories') ? 2.4 : 1.9} />
            <span className={labelClass(isActive('categories'))}>{t.navCategories}</span>
          </Link>

          <Link href="/search" className={tabClass(isActive('search'))} aria-current={isActive('search') ? 'page' : undefined}>
            <Search className="h-[22px] w-[22px]" strokeWidth={isActive('search') ? 2.4 : 1.9} />
            <span className={labelClass(isActive('search'))}>{t.search}</span>
          </Link>

          <Link href="/cart" className={tabClass(isActive('cart'))} aria-current={isActive('cart') ? 'page' : undefined}>
            <span className="relative">
              <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={isActive('cart') ? 2.4 : 1.9} />
              {count > 0 && (
                <span className="absolute -top-1.5 -left-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span className={labelClass(isActive('cart'))}>{t.cart}</span>
          </Link>

          <button
            type="button"
            id="more-nav-button"
            onClick={() => setMoreOpen(true)}
            className={tabClass(false)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls="lubnel-more-sheet"
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
            <span className={labelClass(false)}>{t.navMore}</span>
          </button>
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        isAdmin={isAdmin}
        hasOffers={hasOffers}
      />
    </>
  );
}
