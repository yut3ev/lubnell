import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// Shared product listing query builder — used by BOTH:
//   • GET /api/products  (route handler)
//   • /search server page
// Keeps API contract and page rendering in perfect sync.

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

export const SORT_VALUES = [
  'newest',
  'oldest',
  'price-asc',
  'price-desc',
  'best-selling',
  'featured',
  'rating',
] as const;

export type ProductSort = (typeof SORT_VALUES)[number];

export interface ProductQueryParams {
  q?: string;
  category?: string;
  sort?: ProductSort;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductQueryResult {
  products: ProductCardDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductCardDto {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
  images: string[];
  badgeAr: string | null;
  badgeEn: string | null;
  stock: number;
  featured: boolean;
  rating: number;
  reviews: number;
  createdAt: string | Date;
  categorySlug: string | null;
  category: { slug: string; nameAr: string; nameEn: string } | null;
}

const CARD_SELECT = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  description: true,
  price: true,
  compareAt: true,
  image: true,
  gallery: true,
  badgeAr: true,
  badgeEn: true,
  stock: true,
  featured: true,
  rating: true,
  reviews: true,
  createdAt: true,
  category: { select: { slug: true, nameAr: true, nameEn: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

// ---- parsing ---------------------------------------------------------------

function toNumber(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function toPositiveInt(raw: string | null, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/** Parse URLSearchParams (as received by the API route) into typed params. */
export function parseProductSearchParams(sp: URLSearchParams): ProductQueryParams {
  const params: ProductQueryParams = {};

  const q = sp.get('q')?.trim();
  if (q) params.q = q;

  const category = sp.get('category')?.trim();
  if (category) params.category = category;

  const sort = sp.get('sort')?.trim() as ProductSort | null;
  if (sort && (SORT_VALUES as readonly string[]).includes(sort)) params.sort = sort;

  const minPrice = toNumber(sp.get('minPrice'));
  if (minPrice !== undefined) params.minPrice = minPrice;

  const maxPrice = toNumber(sp.get('maxPrice'));
  if (maxPrice !== undefined) params.maxPrice = maxPrice;

  const inStock = sp.get('inStock');
  if (inStock === '1' || inStock === 'true') params.inStock = true;

  if (sp.has('page')) params.page = toPositiveInt(sp.get('page'), 1);
  if (sp.has('pageSize')) {
    params.pageSize = Math.min(toPositiveInt(sp.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  }

  return params;
}

// ---- where / order ----------------------------------------------------------

function buildWhere(params: ProductQueryParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { published: true };

  if (params.category) where.category = { slug: params.category };

  if (params.q) {
    where.OR = [
      { nameAr: { contains: params.q } },
      { nameEn: { contains: params.q } },
      { description: { contains: params.q } },
    ];
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.price = {
      ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
    };
  }

  if (params.inStock) where.stock = { gt: 0 };

  return where;
}

function orderByFor(sort?: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'price-asc':
      return [{ price: 'asc' }, { createdAt: 'asc' }];
    case 'price-desc':
      return [{ price: 'desc' }, { createdAt: 'asc' }];
    case 'featured':
      return [{ featured: 'desc' }, { rating: 'desc' }, { createdAt: 'asc' }];
    case 'rating':
      return [{ rating: 'desc' }, { reviews: 'desc' }, { createdAt: 'desc' }];
    case 'best-selling':
    case 'oldest':
    default:
      // legacy default: oldest first (previous behavior of the API route)
      return [{ createdAt: 'asc' }];
  }
}

/** productId → total qty sold across non-cancelled orders. */
async function bestSellerQtyMap(): Promise<Map<string, number>> {
  const groups = await db.orderItem.groupBy({
    by: ['productId'],
    _sum: { qty: true },
    where: { order: { status: { not: 'cancelled' } }, productId: { not: null } },
  });
  return new Map(groups.map((g) => [g.productId as string, g._sum.qty ?? 0]));
}

// ---- mapping ----------------------------------------------------------------

function parseGallery(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function mapCard(p: CardRow): ProductCardDto {
  return {
    id: p.id,
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    description: p.description,
    price: p.price,
    compareAt: p.compareAt,
    image: p.image,
    images: parseGallery(p.gallery),
    badgeAr: p.badgeAr,
    badgeEn: p.badgeEn,
    stock: p.stock,
    featured: p.featured,
    rating: p.rating,
    reviews: p.reviews,
    createdAt: p.createdAt,
    categorySlug: p.category?.slug ?? null,
    category: p.category,
  };
}

// ---- main query ---------------------------------------------------------------

/**
 * Query published products with optional search/category/sort/price/stock
 * filters and optional 1-based pagination.
 *
 * When no explicit paging params are provided the call returns ALL matches
 * (legacy behavior of the original /api/products route).
 */
export async function queryProducts(
  params: ProductQueryParams = {},
  opts: { paginate?: boolean } = {}
): Promise<ProductQueryResult> {
  const paginate =
    opts.paginate ?? (params.page !== undefined || params.pageSize !== undefined);
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildWhere(params);

  if (params.sort === 'best-selling') {
    const [sold, rows] = await Promise.all([
      bestSellerQtyMap(),
      db.product.findMany({
        where,
        select: CARD_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    // groupBy + JS sort (fine at SQLite scale) — stable: newest first on ties
    const sorted = [...rows].sort(
      (a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0)
    );
    const total = sorted.length;
    const products = (
      paginate ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted
    ).map(mapCard);
    return { products, total, page: paginate ? page : 1, pageSize: paginate ? pageSize : total };
  }

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      select: CARD_SELECT,
      orderBy: orderByFor(params.sort),
      ...(paginate ? { take: pageSize, skip: (page - 1) * pageSize } : {}),
    }),
    paginate ? db.product.count({ where }) : Promise.resolve(0),
  ]);

  return {
    products: rows.map(mapCard),
    total: paginate ? total : rows.length,
    page: paginate ? page : 1,
    pageSize: paginate ? pageSize : rows.length,
  };
}
