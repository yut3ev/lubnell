import { StoreHeader } from "@/components/store/header";
import { StoreFooter } from "@/components/store/footer";
import { AssistantWidget } from "@/components/store/assistant";
import { BottomNav } from "@/components/store/bottom-nav";
import VisitTracker from "@/components/store/visit-tracker";
import { db } from "@/lib/db";
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
