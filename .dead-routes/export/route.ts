// R29 — full-history orders CSV export for the studio.
// Pairs with the R27 SQL-aggregate work: unlike the paginated orders table,
// this streams EVERY order (uncapped) straight from SQLite, so the file is
// always the complete truth regardless of store size.
// CSV hygiene: RFC-4180 quoting, UTF-8 BOM (Excel opens Arabic correctly),
// CRLF line endings, and a formula-injection guard on text cells.
import { db } from "@/lib/db";
import { jsonError, requireAdmin, audit } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const csvCell = (raw: unknown) => {
  const s = raw == null ? "" : String(raw);
  // neutralize spreadsheet formula injection (=, +, -, @ prefixes)
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "orders.read");
  if (!ctx) return jsonError("غير مصرح", 401);

  const orders = await db.storeOrder.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      orderNumber: true, createdAt: true, customerName: true, customerPhone: true,
      customerAddress: true, giftNote: true, subtotal: true, shipping: true, discount: true,
      couponCode: true, total: true, status: true, cancelRequested: true, items: true, vid: true,
    },
  });
  // R51 — the file must agree with the screen: the R50 "من الريل" badge in
  // the orders table is derived from a converted rail click on the order's
  // vid, so the CSV carries the same flag as a yes/no column (same one-query
  // join, anonymous uuids only, no PII ever leaves the server).
  const convertedVids = new Set(
    (await db.railEvent.findMany({
      where: { convertedAt: { not: null } },
      select: { vid: true },
      distinct: ["vid"],
    })).map(r => r.vid).filter(Boolean)
  );

  const header = [
    "order_number", "created_at", "customer_name", "customer_phone",
    "customer_address", "gift_note", "items_count", "items_summary", "subtotal",
    "shipping", "discount", "coupon_code", "total", "status", "cancel_requested", "rail",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const o of orders) {
    let itemCount = 0;
    let itemsSummary = "";
    try {
      const parsed = JSON.parse(o.items) as { name?: string; nameAr?: string; qty?: number }[];
      itemCount = parsed.reduce((s, it) => s + (it.qty || 1), 0);
      itemsSummary = parsed
        .map(it => `${it.nameAr || it.name || "?"}${it.qty && it.qty > 1 ? ` ×${it.qty}` : ""}`)
        .join(" | ");
    } catch {
      itemsSummary = "";
    }
    lines.push([
      o.orderNumber,
      o.createdAt.toISOString(),
      o.customerName,
      o.customerPhone,
      o.customerAddress || "",
      o.giftNote || "",
      String(itemCount),
      itemsSummary,
      String(o.subtotal),
      String(o.shipping),
      String(o.discount),
      o.couponCode || "",
      String(o.total),
      o.status,
      o.cancelRequested ? "yes" : "no",
      !!o.vid && convertedVids.has(o.vid) ? "yes" : "no",
    ].map(csvCell).join(","));
  }

  await audit(ctx, "orders.export", "order", undefined, { count: orders.length });

  const stamp = new Date().toISOString().slice(0, 10);
  // \uFEFF BOM + CRLF so Excel/Sheets detect UTF-8 and render Arabic names
  const body = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lubnel-orders-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
