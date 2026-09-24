'use client';

import { confirmDialog } from '@/components/ui/confirm-service';


import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Loader2, Trash2 } from 'lucide-react';
import { apiJson, EGP, fmtDate, ORDER_STATUSES, orderNo, STATUS_CLASS, STATUS_LABEL } from '../helpers';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type OrderItem = { nameAr: string; qty: number; price: number };
type Order = {
  id: string;
  orderNumber: string | null;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  notes: string | null;
  customerIp: string | null;
  userAgent: string | null;
  cancelRequested: boolean;
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode: string | null;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

export default function OrdersSection() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; orders: Order[] }>('/api/admin/orders');
    if (ok && data?.ok) setOrders(data.orders);
    else setOrders([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders?.length || 0 };
    for (const s of ORDER_STATUSES) c[s] = orders?.filter((o) => o.status === s).length || 0;
    return c;
  }, [orders]);

  const shown = useMemo(
    () => (tab === 'all' ? orders : orders?.filter((o) => o.status === tab)),
    [orders, tab]
  );

  async function setStatus(id: string, status: string) {
    setOrders((prev) => prev?.map((o) => (o.id === id ? { ...o, status } : o)) || null);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!ok || !data?.ok) {
      toast({ title: 'تعذر تحديث الحالة', description: data?.error, variant: 'destructive' });
      load();
      return;
    }
    toast({ title: `تم تحديث الطلب ${orderNo(id)} → ${STATUS_LABEL[status]}` });
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: 'حذف الطلب', message: `سيتم حذف الطلب ${orderNo(id)} نهائيًا من السجل — لا يمكن الرجوع بعد التأكيد.`, confirmText: 'حذف نهائي', danger: true }))) return;
    /* U50-ORDER-DELETE-FK — الرسالة القديمة «(Owner فقط)» كانت بتظهر لأي فشل حذف
       حتى لو السبب قيد FK وليس صلاحيات. الآن نُظهر سبب الخطر الحقيقي من السيرفر. */
    const { ok, status, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/orders/${id}`, { method: 'DELETE' });
    if (ok) {
      toast({ title: `تم حذف الطلب ${orderNo(id)}` });
      load();
    } else if (status === 401) {
      toast({ title: 'تعذر الحذف (Owner فقط)', variant: 'destructive' });
    } else {
      toast({ title: 'تعذر الحذف', description: data?.error || 'حاولي مرة تانية', variant: 'destructive' });
    }
  }

  if (!orders)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'الكل'], ...ORDER_STATUSES.map((s) => [s, STATUS_LABEL[s]])].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {label} <b className="opacity-70">({counts[id]})</b>
            </button>
          ))}
        </div>
        <a href="/api/admin/export?type=orders" download>
          <Button variant="outline" size="sm" className="rounded-full gap-1.5">
            <Download className="h-3.5 w-3.5" /> تصدير CSV
          </Button>
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/50 text-right text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">الطلب</th>
                <th className="px-4 py-3 font-bold">العميلة</th>
                <th className="px-4 py-3 font-bold">التاريخ</th>
                <th className="px-4 py-3 font-bold">الإجمالي</th>
                <th className="px-4 py-3 font-bold">الحالة</th>
                <th className="px-4 py-3 font-bold">تفاصيل</th>
                <th className="px-4 py-3 font-bold">حذف</th>
              </tr>
            </thead>
            <tbody>
              {shown?.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا طلبات في هذه الحالة.</td></tr>
              )}
              {shown?.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-t border-border/50">
                    <td className="px-4 py-3 font-black" dir="ltr">{o.orderNumber || orderNo(o.id)}</td>
                    <td className="px-4 py-3">
                      <strong>{o.customerName}</strong>
                      <span className="block text-xs text-muted-foreground" dir="ltr">{o.phone}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <b className="font-black">{EGP(o.total)}</b>
                      {o.discount > 0 && (
                        <span className="block text-[11px] font-bold text-emerald-700">
                          خصم {EGP(o.discount)} {o.couponCode ? `(${o.couponCode})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => setStatus(o.id, e.target.value)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[o.status] || ''}`}
                        aria-label={`حالة الطلب ${orderNo(o.id)}`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setOpen(open === o.id ? null : o.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
                        aria-expanded={open === o.id}
                        aria-label={`تفاصيل الطلب ${orderNo(o.id)}`}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${open === o.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => remove(o.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-destructive"
                        aria-label={`حذف الطلب ${orderNo(o.id)}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {open === o.id && (
                    <tr className="border-t border-border/40 bg-secondary/30">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="mb-2 text-xs font-black text-muted-foreground">المنتجات</h4>
                            <ul className="space-y-1.5">
                              {o.items.map((it, i) => (
                                <li key={i} className="flex justify-between text-sm">
                                  <span>{it.nameAr} × {it.qty}</span>
                                  <b>{EGP(it.price * it.qty)}</b>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                              شحن: {o.shipping === 0 ? 'مجاني' : EGP(o.shipping)} · مجموع فرعي: {EGP(o.subtotal)}
                            </div>
                          </div>
                          <div className="text-sm">
                            <h4 className="mb-2 text-xs font-black text-muted-foreground">التوصيل</h4>
                            <p>{o.city} — {o.address}</p>
                            {o.notes && <p className="mt-1 text-xs text-muted-foreground">ملاحظات: {o.notes}</p>}
                            {o.cancelRequested && (
                              <p className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">
                                العميلية طلبت إلغاء هذا الطلب — راجعيه عبر واتساب
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 rounded-xl border border-border/50 bg-background/60 p-3">
                          <h4 className="mb-1.5 text-xs font-black text-muted-foreground">سجل الشخص — من أين جاء الطلب</h4>
                          <p className="text-xs" dir="ltr">
                            <span className="font-bold">IP:</span> {o.customerIp || 'غير مسجل (طلب قديم)'}
                          </p>
                          {o.userAgent && (
                            <p className="mt-1 truncate text-[10px] text-muted-foreground" dir="ltr" title={o.userAgent}>
                              <span className="font-bold">Device:</span> {o.userAgent}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
