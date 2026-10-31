'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Menu,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchDialogV2 } from '@/components/store/search-dialog-v2';
import { MenuGarden } from '@/components/store/menu-garden'; // MG-MENU-2026-10
import { AnnouncementBar } from '@/components/store/announcement-bar';
import { WHATSAPP_NUMBER } from '@/lib/lubnel-types';
import { useCart } from '@/lib/cart-store';
// U22-LANG-FIX — useLang is imported for the header's language toggle button.
// It was previously referenced WITHOUT an import, so every tap on «EN» threw
// a ReferenceError inside the React event handler and the switch silently
// did nothing — the owner's «english بضغط عليه مش شغال» report.
import { useT, useLang } from '@/lib/i18n';

// U57-TEXTS-COMPLETE — every label is a DICT key: the owner edits these from
// Studio → «كل النصوص» (group القوائم والروابط) and the change hits the site
// on save. `k` is the dict key; no more hardcoded literals here.
// GEO-NAV — «المجموعات» (/c/sets) pointed at a category that no longer
// exists in the live catalog (404); replaced with the real bridal-boxes
// category (slug read live from the DB).
const NAV: { href: string; k: 'home' | 'allProducts' | 'navBrides' | 'navMakeup' | 'navSkincare' | 'navBodyCare' }[] = [
  { href: '/', k: 'home' },
  { href: '/c/all', k: 'allProducts' },
  { href: '/c/bridal-boxes', k: 'navBrides' },
  { href: '/c/makeup', k: 'navMakeup' },
  { href: '/c/skincare', k: 'navSkincare' },
  { href: '/c/body-care', k: 'navBodyCare' },
];

// U21-MENU — the mobile menu gets a proper information section instead of
// dead empty space under the category links.
// MG-MENU-2026-10 — icons dropped from the list shape: the reference design
// marks every info link with a pink dot instead of a lucide glyph.
const INFO: { href: string; k: 'navAbout' | 'navShipping' | 'navReturns' | 'navFaq' | 'navContact' | 'navBlog' }[] = [
  { href: '/info/about', k: 'navAbout' },
  { href: '/blog', k: 'navBlog' }, // U61-BLOG
  { href: '/info/shipping', k: 'navShipping' },
  { href: '/info/returns', k: 'navReturns' },
  { href: '/faq', k: 'navFaq' }, // GEO — canonical FAQ URL
  { href: '/info/contact', k: 'navContact' },
];

export function StoreHeader({
  announcementAr,
  announcementEn,
  logoDark,
  whatsapp,
}: {
  announcementAr?: string;
  announcementEn?: string;
  // U16-BRAND — dark-text mark for the light header surface. Falls back to
  // the owner's shipped artwork when Studio → الإعدادات → الهوية البصرية
  // hasn't set a custom one.
  logoDark?: string;
  // U21-MENU — store WhatsApp number for the menu's customer-service button
  whatsapp?: string;
} = {}) {
  const brandLogo = logoDark || '/brand/logo-dark.png';
  const pathname = usePathname();
  const { t, ar, lang } = useT();
  const items = useCart((s) => s.items);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const [open, setOpen] = useState(false);
  const waDigits = (whatsapp || '').replace(/[^0-9]/g, '') || WHATSAPP_NUMBER;
  // U14 — live search typeahead (بحث سريع مع اقتراحات أثناء الكتابة)
  const searchState = useState(false);
  const searchOpen = searchState[0];
  const setSearchOpen = searchState[1];

  // U22-LANG-FIX — mirror the language switch onto <html> so English is a
  // real direction flip (LTR layout, lang="en"), not just translated strings.
  // Runs on every lang change and once on mount (covers the persisted EN
  // preference after a reload).
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = ar ? 'rtl' : 'ltr';
  }, [lang, ar]);

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Dynamic Announcement Bar — managed via Admin → شريط الإعلانات */}
      <AnnouncementBar />

      {/* U29-THEME-STUDIO — the header surface follows --color-header from
          Studio → هوية الموقع; factory fallback mimics bg-background/85. */}
      <div
        className="w-full border-b border-border/70 backdrop-blur-md"
        style={{ background: 'var(--color-header, color-mix(in srgb, var(--background) 85%, transparent))' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* mobile menu — MG-MENU-2026-10: the hamburger stays exactly where
              it was, but now opens the reference «حديقة» drawer
              (menu-garden.tsx). The old Radix Sheet drawer (logo row, the
              تسوّقي/معلومات lists, the pill WhatsApp button) was removed
              wholesale. */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t.menuAria}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <MenuGarden
            open={open}
            onClose={() => setOpen(false)}
            shop={NAV.map((n) => ({ href: n.href, label: t[n.k] }))}
            info={INFO.map((n) => ({ href: n.href, label: t[n.k] }))}
            waHref={`https://wa.me/${waDigits}`}
          />

          {/* brand — U16-BRAND: owner's LUBNÉL wordmark + L-ring badge */}
          <Link href="/" className="flex items-center transition-opacity hover:opacity-80" aria-label={`LUBNÉL — ${t.home}`}>
            <img
              src={brandLogo}
              alt="LUBNÉL"
              className="h-9 w-auto object-contain sm:h-10"
              draggable={false}
            />
          </Link>

          {/* desktop nav */}
          <nav className="mr-auto hidden items-center gap-1 lg:flex" aria-label={t.navMainAria}>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary hover:text-primary ${
                  pathname === n.href ? 'bg-secondary text-primary' : 'text-foreground/80'
                }`}
              >
                {t[n.k]}
              </Link>
            ))}
          </nav>

          <div className="mr-auto flex items-center gap-2 lg:mr-3">
            {/* lang toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => useLang.getState().toggle()}
              className="h-10 rounded-full border-primary/25 bg-card px-3.5 font-bold text-primary hover:bg-secondary"
              aria-label={t.menuLangAria}
            >
              {ar ? 'EN' : 'ع'}
            </Button>

            {/* live search — U14 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-10 gap-2 rounded-full border-primary/25 bg-card px-3.5 font-bold text-primary hover:bg-secondary"
              aria-label={t.menuSearchAria}
            >
              <Search className="h-4.5 w-4.5" />
              <span className="hidden md:inline">{t.search}</span>
            </Button>

            {/* cart */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="relative h-10 gap-2 rounded-full border-primary/25 bg-card px-4 font-bold text-primary hover:bg-secondary"
            >
              <Link href="/cart" aria-label={t.bag}>
                <ShoppingBag className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">{t.bag}</span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                    {count}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {/* language-dependent dir helper */}
        <span className="hidden" aria-hidden data-lang={lang} />
      </div>

      {/* U14 — live suggestions dialog */}
      <SearchDialogV2 open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
