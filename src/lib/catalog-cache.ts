import { db } from '@/lib/db';

// PERF-2026-11 — storefront catalog snapshot cache.
// The owner: «حاسس الموقع بقا تقيل شويه وبياخد وقت يحمل» — the hot storefront
// pages (/, /c/[slug]) each ran their own `db.product.findMany` +
// `db.category.findMany` on EVERY request against the remote Turso instance,
// and then rendered ~145 cards. This module caches the snapshot in the
// server process for a few seconds (inflight-deduped, stale-while-error), so
// repeat views skip the DB round trips entirely while admin writes still
// land instantly: every admin product/category write calls
// invalidateCatalog() (settings-cache), which zeroes this cache too.

export type CatalogSnapshot = {
  categories: Awaited<ReturnType<typeof db.category.findMany>>;
  products: Awaited<ReturnType<typeof db.product.findMany>>;
};

const TTL_MS = 10_000;

const g = globalThis as unknown as {
  __lubnelCatalogData?: {
    data?: CatalogSnapshot;
    at: number;
    inflight?: Promise<CatalogSnapshot>;
  };
};

async function fetchCatalog(): Promise<CatalogSnapshot> {
  const [categories, products] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.product.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { createdAt: 'asc' }],
    }),
  ]);
  return { categories, products };
}

/** Cached categories + published products for the storefront pages. */
export async function getCatalog(): Promise<CatalogSnapshot> {
  const c = (g.__lubnelCatalogData ??= { at: 0 });
  const now = Date.now();
  if (c.data && now - c.at < TTL_MS) return c.data;
  if (c.inflight) return c.inflight;
  const p = fetchCatalog()
    .then((data) => {
      c.data = data;
      c.at = Date.now();
      return data;
    })
    .catch(() => {
      // stale-while-error: last-known-good beats a 500 for the visitor
      return c.data ?? { categories: [], products: [] };
    })
    .finally(() => {
      c.inflight = undefined;
    });
  c.inflight = p;
  return p;
}

/** Force the next getCatalog() to refetch (called by invalidateCatalog). */
export function invalidateCatalogData(): void {
  const c = g.__lubnelCatalogData;
  if (c) c.at = 0;
}
