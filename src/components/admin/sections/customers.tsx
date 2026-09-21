'use client';

// U13 — «سجل العميلة بالكامل»: every customer row expands into her full
// log — every order (number, items, total, status, date) + every IP she
// ordered from (the owner: «سجل الشخص من اسم وطلب و IP أساسي بتاعه»).
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Package, Users, Wifi } from 'lucide-react';
import { apiJson, fmtDay, EGP, orderNo, STATUS_CLASS, STATUS_LABEL } from '../helpers';

type CustomerOrder = {
  id: string;
  orderNumber: string | null;
  total: number;
  status: string;
  createdAt: string;
  ip: string | null;
  itemsSummary: string;
};

type Customer = {
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
  orders: CustomerOrder[];
};

type Stats = { total: number; repeat: number; revenue: number };

export default function CustomersSection() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState('');
  const [openPhone, setOpenPhone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; customers: Customer[]; stats: Stats }>('/api/admin/customers');
    if (ok && data?.ok) {
      setCustomers(data.customers);
      setStats(data.stats);
    } else setCustomers([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = (customers || []).filter(
    (c) => !q || c.name.includes(q) || c.phone.includes(q) || c.city.includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs font-bold text-muted-foreground">إجمالي العملاء</p>
          <p className="mt-1 text-2xl font-black">{stats?.total ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs font-bold text-muted-foreground">عملاء متكررون</p>
          <p className="mt-1 text-2xl font-black">{stats?.repeat ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs font-bold text-muted-foreground">إجمالي إنفاقهم</p>
          <p className="mt-1 text-2xl font-black">{stats ? EGP(stats.revenue) : '—'}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Users className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحثي بالاسم أو الهاتف أو المدينة…"
            className="h-10 w-full rounded-xl border border-border bg-card px-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">اضغطي على أي عميلة لعرض سجلها الكامل — الطلبات وعناوين الـ IP.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="max-h-[34rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/70 text-xs text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-3" aria-label="توسيع" />
                <th className="px-4 py-3 text-right font-bold">العميلة</th>
                <th className="px-4 py-3 text-right font-bold">الهاتف</th>
                <th className="hidden px-4 py-3 text-right font-bold sm:table-cell">المدينة</th>
                <th className="px-4 py-3 text-right font-bold">الطلبات</th>
                <th className="px-4 py-3 text-right font-bold">إجمالي الإنفاق</th>
                <th className="hidden px-4 py-3 text-right font-bold md:table-cell">آخر طلب</th>
                <th className="hidden px-4 py-3 text-right font-bold lg:table-cell">آخر IP</th>
                <th className="px-4 py-3 text-right font-bold">تواصل</th>
              </tr>
            </thead>
            <tbody>
              {customers === null && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">جاري التحميل…</td></tr>
              )}
              {customers !== null && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">لا يوجد عملاء بعد — ستظهر تلقائيًا مع أول طلب.</td></tr>
              )}
              {filtered.map((c) => {
                const open = openPhone === c.phone;
                return (
                  <CustomerRow
                    key={c.phone}
                    c={c}
                    open={open}
                    onToggle={() => setOpenPhone(open ? null : c.phone)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerRow({ c, open, onToggle }: { c: Customer; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className={`cursor-pointer border-t border-border/40 transition-colors ${open ? 'bg-secondary/40' : 'hover:bg-secondary/25'}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <td className="px-2 py-3 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </td>
        <td className="px-4 py-3 font-bold">{c.name}</td>
        <td className="px-4 py-3 font-mono text-xs" dir="ltr">{c.phone}</td>
        <td className="hidden px-4 py-3 sm:table-cell">{c.city}</td>
        <td className="px-4 py-3">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-black">{c.ordersCount}</span>
        </td>
        <td className="px-4 py-3 font-black text-primary">{EGP(c.totalSpent)}</td>
        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{fmtDay(c.lastOrderAt)}</td>
        <td className="hidden px-4 py-3 font-mono text-[11px] text-muted-foreground lg:table-cell" dir="ltr">{c.lastIp || '—'}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <a
            href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-transform hover:scale-110"
            aria-label={`واتساب ${c.name}`}
            title="مراسلة عبر واتساب"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
          </a>
        </td>
      </tr>

      {open && (
        <tr className="border-t border-border/30 bg-secondary/20">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              {/* orders log */}
              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <h4 className="flex items-center gap-2 text-sm font-black">
                  <Package className="h-4 w-4 text-primary" aria-hidden /> سجل الطلبات ({c.orders.length})
                </h4>
                <div className="mt-3 max-h-56 space-y-2.5 overflow-y-auto pl-1">
                  {c.orders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-border/40 bg-background p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-xs font-black" dir="ltr">{orderNo(o.id, o.orderNumber)}</strong>
                        <em className={`rounded-full border px-2 py-0.5 text-[10px] font-bold not-italic ${STATUS_CLASS[o.status] || ''}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </em>
                        <span className="mr-auto text-xs font-black text-primary">{EGP(o.total)}</span>
                      </div>
                      {o.itemsSummary && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{o.itemsSummary}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{fmtDay(o.createdAt)}</span>
                        {o.ip && <span className="font-mono" dir="ltr">IP: {o.ip}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IPs log */}
              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <h4 className="flex items-center gap-2 text-sm font-black">
                  <Wifi className="h-4 w-4 text-primary" aria-hidden /> عناوين الـ IP ({c.ips.length})
                </h4>
                {c.ips.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">لم يُسجَّل IP مع طلباتها (طلبات أقدم من خاصية التتبع).</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {c.ips.map((x) => (
                      <li key={x.ip} className="flex items-center justify-between rounded-xl border border-border/40 bg-background px-3 py-2">
                        <span className="font-mono text-xs" dir="ltr">{x.ip}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                          {x.count === 1 ? 'طلب واحد' : `${x.count} طلبات`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  أول طلب: {fmtDay(c.firstOrderAt)} — آخر ظهور: {fmtDay(c.lastOrderAt)} — العنوان: {c.city}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
