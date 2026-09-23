import { StoreHeader } from "@/components/store/header";
import { StoreFooter } from "@/components/store/footer";
import { AssistantWidget } from "@/components/store/assistant";
import { BottomNav } from "@/components/store/bottom-nav";
import { MaintenanceScreen } from "@/components/store/maintenance-screen";
import VisitTracker from "@/components/store/visit-tracker";
import { cookies } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { ADMIN_SESSION_COOKIE, getAdminFromToken } from "@/lib/admin-auth";
import { getMaintenanceState } from "@/lib/maintenance"; // U77-MAINTENANCE-MODE
import { getSettingsRows } from "@/lib/settings-cache"; // U54-PERF-ROBUST — hot settings reads served from the TTL cache
import { resolveSiteTexts, type SiteTexts } from "@/lib/site-texts";
import { sanitizeTextBag, type TextOverrideBag } from "@/lib/text-keys";
import { TextsProvider } from "@/lib/i18n";
import { resolveTheme, themeStyleVars } from "@/lib/theme-presets";
import { getThemeCss } from "@/lib/theme-server";
import { brandFontById, googleFontsHref } from "@/lib/brand-fonts";

export const dynamic = "force-dynamic";

// SUP-8 — the storefront shell is now settings-driven: the owner picks a
// color theme (Studio → «الثيم والألوان») and edits every copy (Studio →
// «النصوص والفوتر»); both are read straight from the DB on each request and
// applied server-side. CSS variable overrides on this wrapper re-theme every
// Tailwind utility inside; DB failures fall back to the shipped defaults.
export default async function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let texts: SiteTexts = {};
  let uiTextOverrides: TextOverrideBag = {}; // U51-GLOBAL-TEXTS
  let whatsapp: string | undefined;
  let announcementAr = "";
  let announcementEn = "";
  let palette = null;
  let logoDark: string | undefined;
  let brandFont: string | undefined;
  // U29-THEME-STUDIO — the v2 theme CSS is resolved once per request and
  // hoisted into <head> before first paint (no flash on any device).
  const themeCss = await getThemeCss();

  try {
    // U54-PERF-ROBUST — cached (10s TTL, single-flight, invalidated on admin
    // saves): this batch is read on EVERY storefront render.
    const rows = await getSettingsRows(["store", "texts", "theme", "brand", "uitexts"]);
    for (const row of rows) {
      let val: unknown = {};
      try {
        val = JSON.parse(row.value);
      } catch {
        val = {};
      }
      if (row.key === "texts") {
        const resolved = resolveSiteTexts(val);
        announcementAr = (resolved.announcementAr || "").trim();
        announcementEn = (resolved.announcementEn || "").trim();
        // strip the defaults-only empties so texts stays a plain override bag
        texts = val && typeof val === "object" ? (val as SiteTexts) : {};
      } else if (row.key === "uitexts") {
        // U51-GLOBAL-TEXTS — per-key dictionary overrides for every useT() string
        uiTextOverrides = sanitizeTextBag(val);
      } else if (row.key === "store") {
        const s = (val ?? {}) as Record<string, unknown>;
        whatsapp = typeof s.whatsappNumber === "string" ? s.whatsappNumber : undefined;
        if (!announcementAr && typeof s.announcementAr === "string") announcementAr = s.announcementAr.trim();
        if (!announcementEn && typeof s.announcementEn === "string") announcementEn = s.announcementEn.trim();
      } else if (row.key === "theme") {
        palette = resolveTheme(val);
      } else if (row.key === "brand") {
        const b = (val ?? {}) as Record<string, unknown>;
        // U16-BRAND — the header/footer sit on light surfaces, so they render
        // the dark-text mark (owner artwork, shipped at /brand/logo-dark.png);
        // a Studio-set logoDark still wins. logoLight stays available for
        // dark surfaces (admin login) via /brand/logo-light.png.
        if (typeof b.logoDark === "string" && b.logoDark.trim()) logoDark = b.logoDark.trim();
        // U22 — الخط الأساسي: the owner's chosen site-wide font
        if (typeof b.brandFont === "string" && b.brandFont.trim() && brandFontById(b.brandFont)) {
          brandFont = b.brandFont.trim();
        }
      }
    }
  } catch {
    // DB unavailable → ship defaults, never block the storefront
  }

  // U77-MAINTENANCE-MODE — when the owner closes the store, visitors see ONLY
  // the branded maintenance screen (no header/footer/products at all). A
  // signed-in admin still browses the real storefront — with a wine ribbon
  // reminding her the site is closed — so she can QA her own store and
  // re-open it from Studio without losing access.
  const maintenance = await getMaintenanceState();
  let maintenanceAdmin = false;
  if (maintenance.enabled) {
    try {
      const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
      maintenanceAdmin = Boolean(await getAdminFromToken(token));
    } catch {
      maintenanceAdmin = false;
    }
    if (!maintenanceAdmin) {
      return <MaintenanceScreen message={maintenance.message} logoDark={logoDark} />;
    }
  }

  // U29 — when a v2 theme is active it owns ALL color tokens; the legacy
  // SUP-8 wrapper palette would fight it via inline-style precedence, so
  // it's suppressed while v2 rules.
  const legacyPalette = themeCss ? null : palette;

  return (
    <div
      style={themeStyleVars(legacyPalette) as React.CSSProperties}
      {...(brandFont
        ? {
            "data-brand-font": "",
            style: {
              ...(themeStyleVars(legacyPalette) as React.CSSProperties),
              "--font-brand": `'${brandFont}'`,
            } as React.CSSProperties,
          }
        : {})}
      className="flex w-full min-h-screen flex-col"
    >
      {/* U29-THEME-STUDIO — hoisted <head> style: Theme Configuration → CSS
          Variables → every component. Rendered before paint → zero flash. */}
      {themeCss ? (
        <style href="lubnel-theme-v2" precedence="high" dangerouslySetInnerHTML={{ __html: themeCss }} />
      ) : null}
      {/* U22 — load ONLY the chosen brand font (css2, self-hosted by the browser cache) */}
      {brandFont && <link rel="stylesheet" href={googleFontsHref([brandFont])} precedence="default" />}
      {/* U77 — while maintenance is ON the admin still browses the store,
          with this ribbon making the closed state impossible to miss. */}
      {maintenance.enabled && maintenanceAdmin ? (
        <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#7a2e3b] px-3 py-2 text-center text-[11px] font-bold text-[#fdf4f5] sm:text-xs">
          <span>🔒 وضع الصيانة مُفعّل — الزوار شايفين صفحة الصيانة بس، وإنتِ بتشوفي المتجر عادي كمديرة</span>
          <Link href="/admin" className="rounded-full bg-white/15 px-3 py-0.5 underline-offset-4 transition hover:bg-white/25 hover:underline">
            فتح الموقع من الإعدادات
          </Link>
        </div>
      ) : null}
      {/* U51-GLOBAL-TEXTS — feeds the DB text overrides to every useT() consumer;
          context (not state) so SSR and hydration render identical text. */}
      <TextsProvider overrides={uiTextOverrides}>
      <StoreHeader announcementAr={announcementAr} announcementEn={announcementEn} logoDark={logoDark} whatsapp={whatsapp} />
      <main className="flex-1">{children}</main>
      <StoreFooter texts={texts} whatsapp={whatsapp} logoDark={logoDark} />
      <AssistantWidget />
      <BottomNav />
      <VisitTracker />
      </TextsProvider>
    </div>
  );
}
