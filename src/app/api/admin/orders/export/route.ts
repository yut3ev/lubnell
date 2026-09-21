// R29/U13 — full-history orders CSV export for the studio.
// Streams EVERY order (uncapped) straight from SQLite against the live
// Order/OrderItem models (the recovered copy referenced a phantom storeOrder
// model and held a corrupted header line, so it never compiled clean).
// CSV hygiene: RFC-4180 quoting, UTF-8 BOM (Excel opens Arabic correctly),
// CRLF line endings, and a formula-injection guard on text cells.
import { db } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-helpers";

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

  const orders = await db.order.findMany({
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  const header = [
    "order_number", "created_at", "customer_name", "customer_phone",
    "city", "address", "gift_note", "items_count", "items_summary",
    "subtotal", "shipping", "discount", "coupon_code", "total",
    "status", "cancel_requested", "customer_ip",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const o of orders) {
    const items = o.items;
    const itemCount = items.reduce((s, it) => s + it.qty, 0);
    const itemsSummary = items
      .map((it) => `${it.nameAr}${it.qty > 1 ? ` ×${it.qty}` : ""}`)
      .join(" | ");
    lines.push(
      [
        o.orderNumber ?? o.id,
        o.createdAt.toISOString(),
        o.customerName,
        o.phone,
        o.city,
        o.address,
        o.giftNote,
        itemCount,
        itemsSummary,
        o.subtotal,
        o.shipping,
        o.discount,
        o.couponCode,
        o.total,
        o.status,
        o.cancelRequested ? "yes" : "no",
        o.customerIp,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  // UTF-8 BOM + CRLF so Excel renders Arabic and rows correctly
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lubnel-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
