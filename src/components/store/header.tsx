'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Menu,
  Search,
  X,
  ChevronLeft,
  Info,
  Truck,
  RefreshCcw,
  HelpCircle,
  MessageCircle,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { SearchDialogV2 } from '@/components/store/search-dialog-v2';
import { WhatsAppGlyph } from '@/components/store/brand-icons';
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
const NAV: { href: string; k: 'home' | 'allProducts' | 'navSets' | 'navMakeup' | 'navSkincare' | 'navBodyCare' }[] = [
  { href: '/', k: 'home' },
  { href: '/c/all', k: 'allProducts' },
  { href: '/c/sets', k: 'navSets' },
  { href: '/c/makeup', k: 'navMakeup' },
  { href: '/c/skincare', k: 'navSkincare' },
  { href: '/c/body-care', k: 'navBodyCare' },
];

// U21-MENU — the mobile sheet gets a proper information section instead of
// dead empty space under the category links.
const INFO: { href: string; k: 'navAbout' | 'navShipping' | 'navReturns' | 'navFaq' | 'navContact' | 'navBlog'; icon: typeof Info }[] = [
  { href: '/info/about', k: 'navAbout', icon: Info },
  { href: '/blog', k: 'navBlog', icon: BookOpen }, // U61-BLOG
  { href: '/info/shipping', k: 'navShipping', icon: Truck },
  { href: '/info/returns', k: 'navReturns', icon: RefreshCcw },
  { href: '/info/faq', k: 'navFaq', icon: HelpCircle },
  { href: '/info/contact', k: 'navContact', icon: MessageCircle },
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
  // U46-ANNOUNCE-ROTATE — the top bar is now a mini news-ticker: the owner's
  // configured message, a welcome line and an authenticity line take turns
  // every 4.2s with a professional push-up transition (outgoing text slides
  // up + fades, incoming rises from below). Grid-stacked cells mean the bar
  // height always fits the tallest message (no jump between rotations),
  // rotation pauses while the tab is hidden, and motion-reduce keeps a plain
  // opacity swap.
  const [announce, setAnnounce] = useState({ cur: 0, prev: 0 });
  const announceMsgs = [
    (ar ? announcementAr : announcementEn) || t.announcement,
    // U51-GLOBAL-TEXTS — rotation messages 2 & 3 are now owner-editable
    // (Studio → كل النصوص → شريط الإعلان) instead of hardcoded.
    t.announceWelcome,
    t.announceAuthentic,
  ];
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      setAnnounce((s) => ({ cur: (s.cur + 1) % announceMsgs.length, prev: s.cur }));
    }, 4200);
    return () => clearInterval(id);
  }, [announceMsgs.length]);
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
      {/* announcement bar — U46-ANNOUNCE-ROTATE: rotating messages (owner
          copy first, then a welcome line + an authenticity line). Inactive
          messages stay aria-hidden; the bar keeps its brand surface. */}
      <div className="grid bg-primary text-center text-xs font-bold text-primary-foreground" aria-live="off">
        {announceMsgs.map((m, i) => (
          <span
            key={i}
            aria-hidden={i !== announce.cur}
            className={`col-start-1 row-start-1 flex items-center justify-center px-4 py-2 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              i === announce.cur
                ? 'translate-y-0 opacity-100'
                : i === announce.prev
                  ? 'pointer-events-none -translate-y-1.5 opacity-0'
                  : 'pointer-events-none translate-y-1.5 opacity-0'
            }`}
          >
            {m}
          </span>
        ))}
      </div>

      {/* U29-THEME-STUDIO — the header surface follows --color-header from
          Studio → هوية الموقع; factory fallback mimics bg-background/85. */}
      <div
        className="w-full border-b border-border/70 backdrop-blur-md"
        style={{ background: 'var(--color-header, color-mix(in srgb, var(--background) 85%, transparent))' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              {/* U33-HYDRA — suppressHydrationWarning on this exact button:
                  Radix derives aria-controls from useId, whose value is tied
                  to the server PROCESS that rendered the HTML. A tab reloaded
                  across a dev restart/recompile pairs fresh HTML with cached
                  client JS and the two useId values differ — the ONLY element
                  in the storefront that ever diffs first (grep-verified: it's
                  the single aria-controls consumer in the shop shell). The
                  attr is Radix-internal (re-rendered from client state on
                  open), so suppressing the warning changes nothing visible or
                  functional; it just stops the scary overlay on raced reloads.
                  Fresh loads stay byte-identical (verified via curl + browser). */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t.menuAria}
                suppressHydrationWarning
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            {/* U21-MENU — rebuilt mobile sheet: logo + close on one row (the
                built-in absolute ✕ collided with the logo in RTL), compact
                labeled sections, info links, WhatsApp CTA, safe-area bottom. */}
            <SheetContent
              side="right"
              className="w-[min(20rem,85vw)] gap-0 p-0 [&>button]:hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <SheetTitle asChild>
                  <span className="block">
                    <img
                      src={brandLogo}
                      alt="LUBNÉL"
                      className="h-8 w-auto object-contain"
                      draggable={false}
                    />
                  </span>
                </SheetTitle>
                <SheetClose
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={t.menuCloseAria}
                >
                  <X className="h-5 w-5" />
                </SheetClose>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label={t.menuMobileAria}>
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {t.menuShopLabel}
                </p>
                {NAV.map((n) => {
                  const active = pathname === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                        active
                          ? 'bg-secondary font-bold text-primary'
                          : 'font-semibold text-foreground/85 hover:bg-secondary/60'
                      }`}
                    >
                      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                      <span className="flex-1">{t[n.k]}</span>
                      <ChevronLeft
                        className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:-translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  );
                })}

                <p className="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {t.menuInfoLabel}
                </p>
                {INFO.map((n) => {
                  const active = pathname === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] transition-colors ${
                        active
                          ? 'bg-secondary font-bold text-primary'
                          : 'font-semibold text-foreground/85 hover:bg-secondary/60'
                      }`}
                    >
                      <n.icon className="h-4.5 w-4.5 shrink-0 text-primary/70" aria-hidden />
                      <span className="flex-1">{t[n.k]}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-border/60 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] [-webkit-tap-highlight-color:transparent]"
                >
                  <WhatsAppGlyph className="h-4.5 w-4.5" aria-hidden />
                  {t.orderViaWa}
                </a>
                <p className="pt-3 text-center text-[11px] font-semibold text-muted-foreground">
                  {t.navMoreTagline}
                </p>
              </div>
            </SheetContent>
          </Sheet>

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
