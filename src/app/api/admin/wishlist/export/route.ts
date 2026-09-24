// R49 — full-history wishlist CSV export for the studio.
// Mirrors the R29 orders export's hygiene exactly: RFC-4180 quoting, UTF-8
// BOM (Excel opens Arabic product names correctly), CRLF line endings, and
// the same formula-injection guard on text cells. Unlike the board (top rows
// only), this streams EVERY wishlisted product — the file is always the
// complete demand truth, with the rail-attribution columns (R47/R48/R49)
// joined alongside so the owner can slice demand offline.
import { db } from "@/lib/db";
import { jsonError, requireAdmin, audit } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const csvCell = (raw: unknown) => {
  const s = raw == null ? "" : String(raw);
  // neutralize spreadsheet formula injection (=, +, -, @ prefixes)
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
};

const num = (v: bigint | number) => Number(v);

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "analytics.read");
  if (!ctx) return jsonError("غير مصرح", 401);

  // adds-only convention: a remove is not a retraction (same as the board)
  const wishGroups = await db.wishEvent.groupBy({
    by: ["productId"],
    _count: { productId: true },
    where: { action: "add" },
  });
  const slugs = wishGroups.map(g => String(g.productId));

  // sold units per slug over non-cancelled orders — the exact json_each scan
  // the stats board uses, so CSV numbers always agree with the screen
  const soldRows = slugs.length
    ? await db.$queryRaw<{ slug: string | null; qty: bigint | number }[]>`
      SELECT json_extract(j.value, '$.id') AS slug,
             SUM(CAST(json_extract(j.value, '$.quantity') AS INTEGER)) AS qty
      FROM StoreOrder o, json_each(o.items) j
      WHERE o.status != 'cancelled' AND o.items IS NOT NULL AND json_valid(o.items)
      GROUP BY slug`
    : [];
  const soldBySlug = new Map(soldRows.map(r => [String(r.slug ?? ""), num(r.qty)]));

  // rail attribution: pulls (all clicks) + conversions (convertedAt stamped)
  const pullGroups = slugs.length
    ? await db.railEvent.groupBy({ by: ["targetId"], _count: { targetId: true }, where: { targetId: { in: slugs } } })
    : [];
  const soldGroups = slugs.length
    ? await db.railEvent.groupBy({ by: ["targetId"], _count: { targetId: true }, where: { targetId: { in: slugs }, convertedAt: { not: null } } })
    : [];
  const pullsBySlug = new Map(pullGroups.map(g => [g.targetId, num(g._count.targetId)]));
  const railSoldBySlug = new Map(soldGroups.map(g => [g.targetId, num(g._count.targetId)]));

  // live catalog meta so deleted products still export with their last name
  const products = await db.storeProduct.findMany({
    select: { slug: true, name: true, nameAr: true },
  });
  const metaBySlug = new Map(products.map(p => [p.slug, { nameAr: p.nameAr, name: p.name }]));

  const rows = wishGroups
    .map(g => {
      const slug = String(g.productId);
      const meta = metaBySlug.get(slug);
      return {
        slug,
        nameAr: meta?.nameAr || slug,
        name: meta?.name || meta?.nameAr || slug,
        saves: num(g._count.productId),
        sold: soldBySlug.get(slug) || 0,
        railPulls: pullsBySlug.get(slug) || 0,
        railConverted: railSoldBySlug.get(slug) || 0,
      };
    })
    .sort((a, b) => b.saves - a.saves || a.slug.localeCompare(b.slug));

  const header = [
    "product_slug", "name_ar", "name_en", "saves", "sold_units",
    "rail_pulls", "rail_converted",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      r.slug, r.nameAr, r.name, String(r.saves), String(r.sold),
      String(r.railPulls), String(r.railConverted),
    ].map(csvCell).join(","));
  }

  await audit(ctx, "wishlist.export", "product", undefined, { count: rows.length });

  const stamp = new Date().toISOString().slice(0, 10);
  // \uFEFF BOM + CRLF so Excel/Sheets detect UTF-8 and render Arabic names
  const body = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lubnel-wishlist-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
