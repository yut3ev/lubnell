// U24-404 — the (store) 404 boundary. Before this file, every notFound()
// thrown inside the store (dead product link on /p/[slug], unknown category
// on /c/[slug], unknown info page) bubbled all the way to the root
// not-found.tsx — losing the header, footer and bottom-nav chrome, so a
// shopper who followed a stale link suddenly landed on an orphan page. This
// boundary catches those misses INSIDE the store shell: same hero and
// recovery shelf, wrapped by the live StoreHeader/StoreFooter.
import { NotFoundHero, NotFoundShelf, fetchShelfProducts } from "@/components/store/not-found-parts";

export const dynamic = "force-dynamic";

export default async function StoreNotFound() {
  const products = await fetchShelfProducts();
  return (
    <div className="flex min-h-[60vh] flex-col">
      <NotFoundHero variant="route" />
      <NotFoundShelf products={products} variant="route" />
    </div>
  );
}
