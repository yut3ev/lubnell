// U24-404 — root 404 rebuilt. The R144 version still spoke the dead `nf-*`
// CSS vocabulary (the classes no longer exist in any live stylesheet), linked
// to the removed #/shop hash routes and rendered as naked text (owner
// screenshot). This face now ships the storefront's real Tailwind language,
// links real routes, and recovers with a DB-backed product shelf — full
// ProductCards, so add-to-cart works even from a dead URL.
// Standalone chrome: unknown top-level URLs render OUTSIDE the (store)
// layout, so this page carries its own mini brand bar and footer line.
import Link from "next/link";
import type { Metadata } from "next";
import { NotFoundHero, NotFoundShelf, fetchShelfProducts } from "@/components/store/not-found-parts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ضاعتِ من الخريطة — LUBNÉL" };

export default async function NotFound() {
  const products = await fetchShelfProducts();
  return (
    <main className="flex flex-1 flex-col">
      {/* mini brand bar — the only chrome this standalone page has */}
      <header className="border-b border-border/60 bg-background/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="LUBNÉL — الرئيسية" className="flex items-center">
            <img src="/brand/logo-dark.png" alt="LUBNÉL" className="h-7 w-auto" />
          </Link>
          <span className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground sm:text-[11px]">
            GIFTING &amp; RITUALS
          </span>
        </div>
      </header>

      <NotFoundHero variant="route" />
      <NotFoundShelf products={products} variant="route" />

      {/* footer line sticks to the viewport bottom on short viewports */}
      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-5 text-[11px] text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} LUBNÉL — جمالٌ يُهدى بكل حب</span>
          <span>الدفع عند الاستلام · توصيل لكل محافظات مصر</span>
        </div>
      </footer>
    </main>
  );
}
