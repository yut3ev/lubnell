// U54-PERF-ROBUST — in-memory TTL cache for the storefront's hottest DB reads.
//
// Every page render re-reads the same StoreSettings rows (theme, texts,
// uitexts, brand, store, pages, seo…) and /api/store/bootstrap re-reads the
// catalog on every pageview. That data changes at admin-save pace, so under
// concurrent traffic the same rows were being fetched dozens of times per
// second. A short TTL + single-flight dedupe collapses that to ~1 query per
// key-window per process, keeping the store responsive under load
// («مستعد لكذا مستخدم ويستحمل ضغط»).
//
// Consistency contract: admin write routes call invalidateSettings() right
// after a successful save, so the owner's edits appear on the very next
// request. Worst case without a hook is TTL_MS (10s).
import { db } from '@/lib/db';

export type SettingsRow = { key: string; value: string };

const TTL_MS = 10_000;

type CacheState = {
  entries: Map<string, { at: number; rows: SettingsRow[] }>;
  inflight: Map<string, Promise<SettingsRow[]>>;
};

// globalThis → survives dev hot-reload like the Prisma client does
const g = globalThis as unknown as { __lubnelSettingsCache?: CacheState };
const state: CacheState = (g.__lubnelSettingsCache ??= {
  entries: new Map(),
  inflight: new Map(),
});

/** Drop every cached settings row — called by admin write routes after save. */
export function invalidateSettings(): void {
  state.entries.clear();
  state.inflight.clear();
}

async function fetchRows(keys: string[]): Promise<SettingsRow[]> {
  if (keys.length === 0) return [];
  return db.storeSettings.findMany({ where: { key: { in: keys } } });
}

/**
 * Cached findMany over StoreSettings for a set of keys. Never throws: on a DB
 * hiccup it serves the last-known rows (or [] when nothing was ever read) so
 * a settings blip can never 500 the storefront.
 */
export async function getSettingsRows(keys: string[]): Promise<SettingsRow[]> {
  const ck = keys.slice().sort().join('|');
  const now = Date.now();

  const hit = state.entries.get(ck);
  if (hit && now - hit.at < TTL_MS) return hit.rows;

  const pending = state.inflight.get(ck);
  if (pending) return pending;

  const p = fetchRows(keys)
    .then((rows) => {
      state.entries.set(ck, { at: Date.now(), rows });
      return rows;
    })
    .catch(() => {
      // stale-while-error: last-known-good beats a 500 for the visitor
      return hit?.rows ?? [];
    })
    .finally(() => {
      state.inflight.delete(ck);
    });

  state.inflight.set(ck, p);
  return p;
}

/** Cached findUnique-equivalent for a single StoreSettings key. */
export async function getSettingRow(key: string): Promise<SettingsRow | null> {
  const rows = await getSettingsRows([key]);
  return rows.find((r) => r.key === key) ?? null;
}

/**
 * U54-PERF-ROBUST — /api/store/bootstrap keeps its own stale-while-revalidate
 * catalog cache (categories + featured + counts). Admin product/category
 * writes call invalidateCatalog() so the storefront reflects the owner's
 * changes on the very next request instead of waiting out the TTL.
 */
export function invalidateCatalog(): void {
  const g2 = globalThis as unknown as { __lubnelCatalog?: { data?: unknown; refresh?: unknown; at?: number } };
  const c = g2.__lubnelCatalog;
  if (c) {
    c.at = 0; // force the next request to refetch (in-flight refresh still lands)
  }
}
