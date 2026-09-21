import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettingRow } from '@/lib/settings-cache';

export const dynamic = 'force-dynamic';

// U19-SETTINGS — the bootstrap payload now carries the owner's REAL store &
// order settings (Studio → بيانات المتجر / الشحن والدفع) next to the catalog
// data. Before this the route only served hardcoded site constants, so the
// cart silently ignored her shipping fee / WhatsApp number / greeting / COD
// toggle / currency. All fields fall back to the shipped defaults on any error.

// U54-PERF-ROBUST — this is the HOTTEST endpoint (every pageview fires it).
// The catalog part (categories + featured + counts) is cached with
// stale-while-revalidate: bursts of visitors are answered instantly from
// process memory while a single background refetch refreshes it. Admin
// product/category writes call invalidateCatalog() so the storefront still
// reflects the owner's changes on the next request. The 'store' settings row
// goes through the shared settings cache (invalidated on admin saves).
const DEFAULTS = {
  storeName: 'LUBNÉL',
  shippingFee: 60,
  freeShippingThreshold: 900,
  whatsappNumber: '201000000000',
  whatsappMessage: 'مرحبًا، أريد تأكيد طلبي من LUBNÉL.',
  codEnabled: true,
  currency: '',
  deliveryTime: '',
  minOrderTotal: 0,
};

type StoreBag = Partial<typeof DEFAULTS>;

async function loadCatalog() {
  const [categories, featured, counts] = await Promise.all([
    db.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    db.product.findMany({
      where: { featured: true, published: true },
      take: 8,
      orderBy: { reviews: 'desc' },
    }),
    Promise.all([db.product.count(), db.category.count()]),
  ]);
  return { categories, featured, counts };
}

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

const CATALOG_TTL_MS = 10_000;
const gCat = globalThis as unknown as {
  __lubnelCatalog?: { data?: Catalog; at?: number; refresh?: Promise<Catalog> };
};

function catalogWithSwr(): Promise<Catalog> {
  const c = (gCat.__lubnelCatalog ??= {});
  const needRefresh = !c.data || Date.now() - (c.at ?? 0) >= CATALOG_TTL_MS;
  if (needRefresh && !c.refresh) {
    c.refresh = loadCatalog()
      .then((data) => {
        c.data = data;
        c.at = Date.now();
        return data;
      })
      .catch((err) => {
        // stale-while-error: keep serving the last-known-good catalog
        console.error('[bootstrap:catalog]', err);
        if (!c.data) throw err;
        return c.data;
      })
      .finally(() => {
        c.refresh = undefined;
      });
  }
  if (c.data) return Promise.resolve(c.data);
  if (c.refresh) return c.refresh;
  return loadCatalog(); // safety net — unreachable in practice
}

export async function GET() {
  try {
    const [{ categories, featured, counts }, storeRow] = await Promise.all([
      catalogWithSwr(),
      getSettingRow('store'),
    ]);

    let bag: StoreBag = {};
    try {
      const parsed = JSON.parse(storeRow?.value ?? '{}') as StoreBag;
      if (parsed && typeof parsed === 'object') bag = parsed;
    } catch {
      bag = {};
    }

    const num = (v: unknown, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    const str = (v: unknown, fallback: string) =>
      typeof v === 'string' && v.trim() ? v.trim() : fallback;

    const shippingFee = num(bag.shippingFee, DEFAULTS.shippingFee);
    const freeShippingThreshold = num(bag.freeShippingThreshold, DEFAULTS.freeShippingThreshold);
    const whatsappNumber = str(bag.whatsappNumber, DEFAULTS.whatsappNumber).replace(/[^0-9]/g, '');
    const codEnabled = bag.codEnabled !== false;
    const currency = typeof bag.currency === 'string' ? bag.currency.trim() : '';
    const deliveryTime = typeof bag.deliveryTime === 'string' ? bag.deliveryTime.trim() : '';
    const minOrderTotal = num(bag.minOrderTotal, 0);
    const storeName = str(bag.storeName, DEFAULTS.storeName);

    return NextResponse.json({
      ok: true,
      site: {
        name: storeName,
        nameAr: 'لوبنيل',
        tagline: 'جمالٌ يُهدى بكل حب',
      },
      stats: { products: counts[0], categories: counts[1] },
      categories,
      featured,
      // order settings (top-level, as the cart/checkout expect)
      storeName,
      shippingFee,
      freeShippingThreshold,
      whatsappNumber,
      whatsappMessage: str(bag.whatsappMessage, DEFAULTS.whatsappMessage),
      codEnabled,
      currency,
      deliveryTime,
      minOrderTotal,
    });
  } catch (err) {
    console.error('[bootstrap]', err);
    return NextResponse.json(
      { ok: false, error: 'bootstrap failed' },
      { status: 500 }
    );
  }
}
