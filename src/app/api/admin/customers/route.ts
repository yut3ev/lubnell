// Admin customers: aggregate real customers from orders (grouped by phone).
// U13 — each customer now carries her FULL log, as the owner asked:
// every order (number, total, status, date, IP) + every IP she ordered from,
// so the studio answers «مين دي وطلبت إيه ومنين» without leaving the table.
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireAdmin } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export type AdminCustomerOrder = {
  id: string;
  orderNumber: string | null;
  total: number;
  status: string;
  createdAt: string;
  ip: string | null;
  itemsSummary: string;
};

export type AdminCustomer = {
  phone: string;
  name: string;
  city: string;
  ordersCount: number;
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
  lastStatus: string;
  lastIp: string | null;
  ips: { ip: string; count: number }[];
  orders: AdminCustomerOrder[];
};

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "customers.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { items: true },
    });
    const byPhone = new Map<string, AdminCustomer>();
    for (const o of orders) {
      const phone = o.phone.trim();
      if (!phone) continue;
      const spent = o.status === "cancelled" ? 0 : o.total;
      const itemsSummary = o.items
        .map((it) => `${it.nameAr}${it.qty > 1 ? ` ×${it.qty}` : ""}`)
        .join(" | ");
      const compactOrder: AdminCustomerOrder = {
        id: o.id,
        orderNumber: o.orderNumber,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        ip: o.customerIp ?? null,
        itemsSummary,
      };
      const existing = byPhone.get(phone);
      if (!existing) {
        byPhone.set(phone, {
          phone,
          name: o.customerName,
          city: o.city,
          ordersCount: 1,
          totalSpent: spent,
          firstOrderAt: o.createdAt.toISOString(),
          lastOrderAt: o.createdAt.toISOString(),
          lastStatus: o.status,
          lastIp: o.customerIp ?? null,
          ips: o.customerIp ? [{ ip: o.customerIp, count: 1 }] : [],
          orders: [compactOrder],
        });
      } else {
        existing.ordersCount += 1;
        existing.totalSpent += spent;
        existing.lastStatus = o.status;
        // orders are desc — first hit stays the latest order
        if (o.createdAt.toISOString() < existing.firstOrderAt) {
          existing.firstOrderAt = o.createdAt.toISOString();
          existing.name = o.customerName || existing.name;
        }
        if (!existing.lastIp && o.customerIp) existing.lastIp = o.customerIp;
        existing.orders.push(compactOrder);
        if (o.customerIp) {
          const hit = existing.ips.find((x) => x.ip === o.customerIp);
          if (hit) hit.count += 1;
          else existing.ips.push({ ip: o.customerIp, count: 1 });
        }
      }
    }
    const customers = Array.from(byPhone.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    const stats = {
      total: customers.length,
      repeat: customers.filter((c) => c.ordersCount > 1).length,
      revenue: customers.reduce((s, c) => s + c.totalSpent, 0),
    };
    return jsonOk({ ok: true, customers, stats });
  } catch (error) {
    console.error("customers aggregation failed", error);
    return jsonError("تعذر تحميل العملاء", 500);
  }
}
