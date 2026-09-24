import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";
import { getSettingsRows } from "@/lib/settings-cache"; // U54-PERF-ROBUST
import { siteUrl } from "@/lib/site-url";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmHost } from "@/components/ui/confirm-service";
import { ExtensionShield } from "@/components/extension-shield";
import { StoreBoot } from "@/components/store-boot";
import { VersionWatch } from "@/components/version-watch";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

// U15-SEO — default metadata now follows Studio → الإعدادات → SEO when set.
// U54-PERF-ROBUST — generateMetadata runs on EVERY dynamic render; settings
// rows come from the TTL cache and the hero OG fallback is micro-cached
// (10s, stale-while-error) instead of a fresh DB round-trip per request.
let heroOgCache: { at: number; value: string } | null = null;
async function getCachedHeroOg(): Promise<string> {
  if (heroOgCache && Date.now() - heroOgCache.at < 10_000) return heroOgCache.value;
  try {
    const hero = await db.heroSlide.findFirst({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { image: true },
    });
    const value = hero?.image || "/icon.png";
    heroOgCache = { at: Date.now(), value };
    return value;
  } catch {
    return heroOgCache?.value || "/icon.png";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  let title = "LUBNÉL | لوبنيل — جمالٌ يُهدى بكل حب";
  let description =
    "متجر لوبنيل لصناديق الهدايا الفاخرة والمكياج والعناية بالبشرة والعطور الأصلية. تغليف هدايا مجاني وتوصيل سريع.";
  let keywords = ["لوبنيل", "LUBNÉL", "هدايا", "مكياج", "عطور", "العناية بالبشرة", "صناديق هدايا"];
  let titleEn = "";
  let descriptionEn = "";
  let ogImage: string | undefined;
  let favicon: string | undefined;
  try {
    const rows = await getSettingsRows(["seo", "store", "brand"]);
    for (const row of rows) {
      let val: Record<string, unknown> = {};
      try {
        val = JSON.parse(row.value) as Record<string, unknown>;
      } catch {
        val = {};
      }
      if (row.key === "seo") {
        if (typeof val.metaTitleAr === "string" && val.metaTitleAr.trim()) title = val.metaTitleAr.trim();
        if (typeof val.metaDescriptionAr === "string" && val.metaDescriptionAr.trim()) description = val.metaDescriptionAr.trim();
        if (typeof val.metaKeywords === "string" && val.metaKeywords.trim()) {
          keywords = val.metaKeywords.split(',').map((k) => k.trim()).filter(Boolean);
        }
        if (typeof val.ogImage === "string" && val.ogImage.trim()) ogImage = val.ogImage.trim();
        // U22 — EN pair from الإعدادات → SEO (openGraph/twitter surface them)
        if (typeof val.metaTitleEn === "string") titleEn = val.metaTitleEn.trim();
        if (typeof val.metaDescriptionEn === "string") descriptionEn = val.metaDescriptionEn.trim();
      }
      if (row.key === "store") {
        if (typeof val.storeDescriptionAr === "string" && val.storeDescriptionAr.trim() && !ogImage) {
          description = val.storeDescriptionAr.trim();
        }
      }
      if (row.key === "brand") {
        // U16-BRAND/U22 — Studio favicon wins, then the square icon
        if (typeof val.favicon === "string" && val.favicon.trim()) favicon = val.favicon.trim();
        else if (typeof val.logoSquare === "string" && val.logoSquare.trim()) favicon = val.logoSquare.trim();
      }
    }
    // SEC-AUDIT-5 — homepage OG image fallback: WhatsApp/Twitter link
    // previews of the homepage used to render with NO image when the owner
    // hadn't set الإعدادات → SEO → ogImage yet. Fallback chain: first active
    // hero slide (branded, lifestyle shot) → /icon.png (always exists).
    // metadataBase resolves relative /uploads URLs into absolute ones.
    if (!ogImage) {
      ogImage = await getCachedHeroOg();
    }
  } catch {
    // DB unavailable → shipped defaults
    if (!ogImage) ogImage = "/icon.png";
  }
  return {
    // U31-SEO-FIX — resolves every relative canonical (e.g. /info/*) and
    // relative OG image against the official production origin, so crawlers
    // never see localhost or internal deploy hosts. Invisible metadata only.
    metadataBase: new URL(siteUrl()),
    title,
    description,
    keywords,
    authors: [{ name: "LUBNÉL" }],
    openGraph: {
      // EN pair surfaces on share cards when the owner sets them in Studio
      title: titleEn || title,
      description: descriptionEn || description,
      siteName: "LUBNÉL",
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: titleEn || title,
      description: descriptionEn || description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(favicon
      ? { icons: { icon: favicon, shortcut: favicon, apple: favicon } }
      : {}),
  };
}

// U18-MOBILE — viewport-fit=cover lets the bottom-nav / sticky ATC / sheets
// honor env(safe-area-inset-*) on notch devices (iPhone); themeColor paints
// the browser chrome in the brand navy on Android/iOS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#010F1C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {/* U23 — strips extension-injected attrs (bis_size…) before hydration */}
        <ExtensionShield />
        {/* U23-HYDRA-BOOT — rehydrates lang/cart after mount (no SSR mismatch) */}
        <StoreBoot />
        {/* U23-BOOTID — refreshes stale tabs that outlived a server restart
            BEFORE React pairs them with mismatched markup (aria-controls) */}
        {/* U84 — disabled on Vercel: every serverless instance has its own
            boot id, so the watchdog would reload her tab every minute and
            destroy in-progress work. Self-hosted (z.ai/local/VPS) keeps it. */}
        {process.env.VERCEL ? null : <VersionWatch />}
        {children}
        <ConfirmHost />
        <Toaster />
      </body>
    </html>
  );
}
