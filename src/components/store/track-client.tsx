'use client';

// Order tracking (MOBILE-TRACK-2026-10): order number + phone → live status
// from the same Order rows the Studio dashboard manages. Reduces «طلبي فين؟»
// support messages to a self-service lookup.

import { useState } from 'react';
import { Package, Truck, CheckCircle2, ClipboardList, Search, ArrowLeft } from 'lucide-react';

type TrackedItem = { name: string; qty: number; price: number; variant: string | null };
type TrackedOrder = {
  orderNumber: string;
  status: string;
  statusLabel: string;
  cancelled: boolean;
  placedAt: string;
  city: string;
  items: TrackedItem[];
  subtotal: number;
  shipping: number;
  total: number;
};

const STEPS = [
  { key: 'pending', label: 'قيد المراجعة', icon: ClipboardList },
  { key: 'confirmed', label: 'قيد التجهيز', icon: Package },
  { key: 'shipped', label: 'في الطريق', icon: Truck },
  { key: 'delivered', label: 'تم التسليم', icon: CheckCircle2 },
];

function egp(n: number) {
  return `${n.toLocaleString('en-US')} ج.م`;
}

export function TrackClient() {
  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOrder(null);
    if (!orderNo.trim() || !phone.trim()) {
      setError('اكتبي رقم الطلب ورقم الموبايل');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/track?order=${encodeURIComponent(orderNo.trim())}&phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) setOrder(data.order as TrackedOrder);
      else setError(data?.error || 'تعذر التتبع الآن — جربي بعد قليل');
    } catch {
      setError('تعذر الاتصال — تأكدي من الإنترنت وجربي تاني');
    } finally {
      setBusy(false);
    }
  }

  const activeIdx = order
    ? order.cancelled
      ? -1
      : Math.max(0, STEPS.findIndex((s) => s.key === order.status))
    : -1;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-center text-2xl font-extrabold">تتبعي طلبكِ</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        اكتبي رقم الطلب (يبدأ بـ LN-) ورقم الموبايل اللي طلبتِ بيه — الحالة تتحدث مباشرة من المتجر.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div>
          <label htmlFor="track-order" className="mb-1 block text-sm font-bold">رقم الطلب</label>
          <input
            id="track-order" value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
            placeholder="LN-..." dir="ltr" autoComplete="off"
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-left text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="track-phone" className="mb-1 block text-sm font-bold">رقم الموبايل</label>
          <input
            id="track-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx" dir="ltr" inputMode="tel" autoComplete="tel"
            className="h-11 w-full rounded-xl border border-border bg-background px-4 text-left text-sm outline-none focus:border-primary"
          />
        </div>
        {error && <p className="text-sm font-bold text-destructive">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md disabled:opacity-60"
        >
          <Search size={18} /> {busy ? 'جارٍ البحث…' : 'تتبعي الطلب'}
        </button>
      </form>

      {order && (
        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <strong dir="ltr" className="text-sm">{order.orderNumber}</strong>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${order.cancelled ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground'}`}>
              {order.statusLabel}
            </span>
          </div>

          {!order.cancelled && (
            <ol className="mt-5 flex items-start justify-between gap-1" aria-label="مراحل الطلب">
              {STEPS.map((s, i) => {
                const done = i <= activeIdx;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                    <span className={`grid h-10 w-10 place-items-center rounded-full border-2 ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'}`}>
                      <Icon size={17} />
                    </span>
                    <span className={`text-[11px] font-bold leading-tight ${done ? 'text-primary' : 'text-muted-foreground'}`}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <ul className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3">
                <span className="font-bold">
                  {it.name}
                  {it.variant ? <span className="ms-2 text-xs text-muted-foreground">{it.variant}</span> : null}
                  <span className="ms-2 text-xs text-muted-foreground">× {it.qty}</span>
                </span>
                <span className="font-bold text-primary">{egp(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">المجموع</dt><dd className="font-bold">{egp(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">الشحن</dt><dd className="font-bold">{order.shipping === 0 ? 'مجاني' : egp(order.shipping)}</dd></div>
            <div className="flex justify-between text-base"><dt className="font-bold">الإجمالي</dt><dd className="font-bold text-primary">{egp(order.total)}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            تم الطلب {new Date(order.placedAt).toLocaleDateString('ar-EG')} — التوصيل إلى {order.city}. لأي استفسار تواصلي معنا واتساب.
          </p>
          <a href="/#/" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline-offset-4 hover:underline">
            <ArrowLeft size={15} /> متابعة التسوق
          </a>
        </div>
      )}
    </div>
  );
}
