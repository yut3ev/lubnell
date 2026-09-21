'use client';

// U10-MOBILE-NAV — fixed bottom tab bar for phones: الرئيسية · التصنيفات ·
// البحث · السلة · المزيد. The store is mobile-first; this saves the trip
// back to the top on every action. Hidden from md up (desktop has the
// full header nav), safe-area aware, active tab highlighted per route.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Flame,
  Home,
  Info,
  LayoutGrid,
  LayoutDashboard,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Menu,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-store';
import { useT } from '@/lib/i18n';


const MORE_LINKS = [
  { href: '/#offers', labelAr: '🔥 عروض اليوم', labelEn: '🔥 Today’s offers', icon: Flame },
  { href: '/c/all', labelAr: 'كل المنتجات', labelEn: 'All products', icon: Package },
  { href: '/info/about', labelAr: 'عن لوبنيل', labelEn: 'About LUBNÉL', icon: Info },
  { href: '/info/shipping', labelAr: 'الشحن والتسليم', labelEn: 'Shipping & delivery', icon: Package },
  { href: '/info/returns', labelAr: 'الاستبدال والإرجاع', labelEn: 'Returns & exchange', icon: Package },
  { href: '/info/faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ', icon: Info },
  { href: '/info/contact', labelAr: 'تواصلي معنا', labelEn: 'Contact us', icon: MessageCircle },
  { href: '/admin', labelAr: 'لوحة الإدارة', labelEn: 'Admin dashboard', icon: LayoutDashboard },
];

export function BottomNav() {
  const pathname = usePathname();
  const { ar, t } = useT(); // U51-GLOBAL-TEXTS — nav labels are owner-editable
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
        aria-label={ar ? 'التنقل السفلي' : 'Bottom navigation'}
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

          <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(false)} aria-haspopup="dialog" aria-expanded={moreOpen}>
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
            <span className={labelClass(false)}>{t.navMore}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
          <SheetTitle className="sr-only">{t.navMore}</SheetTitle>
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          <p className="px-2 pb-2 text-sm font-bold">{t.navMoreTitle}</p>
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto">
            {MORE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-secondary/40 px-3.5 py-3 text-[13px] font-bold text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <l.icon className="h-4.5 w-4.5 shrink-0 text-primary" aria-hidden />
                <span className="line-clamp-1">{ar ? l.labelAr : l.labelEn}</span>
              </Link>
            ))}
          </div>
          <p className="pt-3 text-center text-[11px] font-semibold text-muted-foreground">
            {t.navMoreTagline}
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
