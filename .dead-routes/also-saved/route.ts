import { db } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-helpers";

// R46 — PDP cross-sell: "visitors who saved this also saved …". Powered by
// WishEvent co-occurrence: which products were saved (action = add) by the
// same visitors (ip) who saved the current product. Aggregate counts only —
// no per-visitor detail ever leaves the server, same privacy posture as the
// bootstrap wishCounts.
//
// Two honest tiers (no fake data, mirroring the wish-proof badge convention):
//   tier "co"  — real co-occurrence for this product (top 3 by add count)
//   tier "top" — cold start: nobody who saved this product saved anything
//                else yet, so fall back to the store's most-saved products
//                overall (excluding the current one)
//   empty      — no wish activity at all → the PDP rail simply stays hidden
//
// R60 — cart cross-sell: the SAME endpoint now also serves the bag page's
// "كمّلي حقيبتكِ" strip. With NO slug there is no anchor product to co-occur
// with, so the route returns the store-wide most-saved products (tier "top"
// semantics) and honors an optional `exclude` CSV — the bag's slugs — so the
// strip never suggests what the shopper already carries. Contract evolution:
// a MISSING slug used to be a 400; it is now the store-wide list. A PRESENT
// but unknown slug stays a hard 404 — a typo'd anchor must never silently
// degrade into unrelated suggestions. `exclude` is deliberately ignored on
// the anchored path: the PDP rail's behavior is byte-for-byte R58/R59's.
export const dynamic = "force-dynamic";

const TAKE = 3;
const MAX_EXCLUDE = 20;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")?.trim() || "";
    const excluded = slug
      ? []
      : (url.searchParams.get("exclude")?.trim() || "")
          .split(",").map(s => s.trim()).filter(Boolean).slice(0, MAX_EXCLUDE);

    // Store-wide "top saves" scan (adds only) — the cart path's whole answer
    // AND the anchored path's cold-start tier. `not` carries the PDP anchor
    // exclusion, `notIn` the shopper's bag; both optional, both honest.
    // (No result-type annotation here: Prisma's groupBy overloads infer best
    // untouched — an explicit SaveGroup[] Poisons the generic resolution.)
    const topSaves = (opts: { not?: string; notIn?: string[] }) => {
      const productId: { not?: string; notIn?: string[] } = {};
      if (opts.not) productId.not = opts.not;
      if (opts.notIn?.length) productId.notIn = opts.notIn;
      return db.wishEvent.groupBy({
        by: ["productId"],
        where: { action: "add", ...(Object.keys(productId).length ? { productId } : {}) },
        _count: { productId: true },
        orderBy: { _count: { productId: "desc" } },
        take: TAKE,
      });
    };

    // Shared tail — visible-product metadata + the R59 railOrders proof scan.
    // A product hidden after the wish was made must not re-enter the
    // storefront through here. WishEvent.productId stores the SLUG (the
    // storefront product id), so the lookup keys on slug; images is a JSON
    // string column → parse first.
    const resolveItems = async (groups: readonly { productId: string; _count: { productId: number } }[]) => {
      const slugs = groups.map(g => g.productId);
      const rows = await db.storeProduct.findMany({
        where: { slug: { in: slugs }, visible: true },
        select: { slug: true, name: true, nameAr: true, price: true, oldPrice: true, images: true, stock: true },
      });
      const bySlug = new Map(
        rows.map(r => {
          let imgs: string[] = [];
          try { imgs = JSON.parse(r.images || "[]"); } catch { imgs = []; }
          return [r.slug, { id: r.slug, name: r.name, nameAr: r.nameAr, price: r.price, oldPrice: r.oldPrice, image: imgs[0] || "/images/p-beauty-box.webp", alt: r.nameAr, stock: r.stock }];
        })
      );
      const countBySlug = new Map(groups.map(g => [g.productId, g._count.productId]));
      // R59 — shopper-facing proof, aggregate only: how many non-cancelled
      // orders CONTAIN this product and came from a rail-attributed visitor
      // (vid stamped convertedAt on one of its rail pulls within 24h). Same
      // json_each machinery as the stats route's R56 line scan — the vid list
      // rides as ONE bound parameter. Counting DISTINCT orders so a duplicated
      // line can never double-count. Cards with 0 render NO badge — absence,
      // not a column of zeros (same honesty as the wish-proof convention).
      const convertedVidRows = await db.railEvent.findMany({
        where: { convertedAt: { not: null } },
        select: { vid: true },
        distinct: ["vid"],
      });
      const convertedVids = convertedVidRows.map(r => r.vid).filter(Boolean);
      const railOrderRows = convertedVids.length
        ? await db.$queryRaw<{ slug: string | null; railOrders: bigint | number | null }[]>`
          SELECT json_extract(j.value, '$.id') AS slug,
                 COUNT(DISTINCT o.id) AS railOrders
          FROM StoreOrder o, json_each(o.items) j
          WHERE o.status != 'cancelled' AND o.items IS NOT NULL AND json_valid(o.items)
            AND o.vid IN (SELECT value FROM json_each(${JSON.stringify(convertedVids)}))
          GROUP BY slug`
        : [] as { slug: string | null; railOrders: bigint | number | null }[];
      const railOrdersBySlug = new Map(railOrderRows.map(r => [r.slug as string, Number(r.railOrders) || 0]));
      return slugs
        .map(s => {
          const row = bySlug.get(s);
          if (!row) return null;
          return { ...row, count: countBySlug.get(s) || 0, railOrders: railOrdersBySlug.get(s) || 0 };
        })
        .filter(Boolean);
    };

    if (!slug) {
      // R60 — store-wide top saves, minus the shopper's bag.
      const groups = await topSaves({ notIn: excluded });
      if (!groups.length) return jsonOk({ success: true, basis: "top", items: [] });
      return jsonOk({ success: true, basis: "top", items: await resolveItems(groups) });
    }

    const product = await db.storeProduct.findUnique({ where: { slug }, select: { id: true } });
    if (!product) return jsonError("منتج غير معروف", 404);

    // Tier 1 — co-occurrence: visitors (distinct ips) who added this product…
    const wisherIps = (
      await db.wishEvent.findMany({
        where: { productId: slug, action: "add", ip: { not: "local" } },
        distinct: ["ip"],
        select: { ip: true },
      })
    ).map(r => r.ip);

    const coGroups = wisherIps.length
      ? await db.wishEvent.groupBy({
          by: ["productId"],
          where: { action: "add", ip: { in: wisherIps }, productId: { not: slug } },
          _count: { productId: true },
          orderBy: { _count: { productId: "desc" } },
          take: TAKE,
        })
      : [];
    const basis = coGroups.length ? "co" : "top";
    // Tier 2 — cold-start fallback: most-saved products overall (adds only),
    // excluding the current product. Same convention as the studio wish board.
    const groups = coGroups.length ? coGroups : await topSaves({ not: slug });

    if (!groups.length) return jsonOk({ success: true, basis, items: [] });
    return jsonOk({ success: true, basis, items: await resolveItems(groups) });
  } catch {
    return jsonError("تعذّر تحميل الاقتراحات", 500);
  }
}
