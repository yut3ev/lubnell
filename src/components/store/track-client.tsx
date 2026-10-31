'use client';

// Order tracking (MOBILE-TRACK-2026-10 / Feature 4):
// Interactive step-by-step order tracking with Lubnel rose aesthetics,
// animated step indicator, accurate shipping status, and 1-tap WhatsApp support.

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Package, Truck, CheckCircle2, ClipboardList, Search, ArrowRight, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/cart-store';

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
  { key: 'pending', label: 'قيد المراجعة', desc: 'استلمنا طلبكِ ونقوم بمراجعته 🌸', icon: ClipboardList },
  { key: 'confirmed', label: 'قيد التجهيز', desc: 'يتم تحضير وتغليف طلبكِ بكل حب 🎁', icon: Package },
  { key: 'shipped', label: 'في الطريق', desc: 'طلبكِ مع المندوب وفي الطريق إليكِ 🚚', icon: Truck },
  { key: 'delivered', label: 'تم التسليم', desc: 'تم تسليم الطلب، نتمنى أن يسعدكِ! ✨', icon: CheckCircle2 },
];

function egp(n: number) {
  return `${Number(n).toLocaleString('en-US')} ج.م`;
}

function TrackContent() {
  const searchParams = useSearchParams();
  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const fetchTrack = useCallback(async (oNo: string, pNo: string) => {
    if (!oNo.trim() || !pNo.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/track?order=${encodeURIComponent(oNo.trim())}&phone=${encodeURIComponent(pNo.trim())}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setOrder(data.order as TrackedOrder);
      } else {
        setError(data?.error || 'لم نتمكن من العثور على الطلب — تأكدي من رقم الطلب والموبايل.');
      }
    } catch {
      setError('تعذر الاتصال — تأكدي من اتصالكِ بالإنترنت وجربي ثانية.');
    } finally {
      setBusy(false);
    }
  }, []);

  // Pre-fill from URL params or localStorage profile
  useEffect(() => {
    const qOrder = searchParams.get('order');
    const qPhone = searchParams.get('phone');

    let initialPhone = qPhone || '';
    if (!initialPhone) {
      try {
        const saved = localStorage.getItem('lubnel_customer_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.phone) initialPhone = parsed.phone;
        }
      } catch {}
    }

    if (qOrder) setOrderNo(qOrder);
    if (initialPhone) setPhone(initialPhone);

    if (qOrder && initialPhone) {
      fetchTrack(qOrder, initialPhone);
    }
  }, [searchParams, fetchTrack]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNo.trim() || !phone.trim()) {
      setError('اكتبي رقم الطلب ورقم الموبايل');
      return;
    }
    fetchTrack(orderNo, phone);
  }

  const activeIdx = order
    ? order.cancelled
      ? -1
      : Math.max(0, STEPS.findIndex((s) => s.key === order.status))
    : -1;

  const progressPct = activeIdx < 0 ? 0 : (activeIdx / (STEPS.length - 1)) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-extrabold text-[#7a2e3b] sm:text-4xl">
          تتبعي طلبكِ 🌸
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اكتبي رقم الطلب (يبدأ بـ LN-) ورقم الموبايل المسجل لمتابعة مرحلة التجهيز والشحن لحظة بلحظة.
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-4 rounded-3xl border border-[#ebd8d0] bg-[#fffaf8] p-5 shadow-sm sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="track-order" className="mb-1.5 block text-xs font-bold text-[#5a2230]">
              رقم الطلب
            </label>
            <input
              id="track-order"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="LN-XXXXXX"
              dir="ltr"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-[#ecd9d1] bg-white px-4 text-left font-mono text-sm font-bold text-[#3a2226] outline-none transition-colors focus:border-[#8a3a46]"
            />
          </div>
          <div>
            <label htmlFor="track-phone" className="mb-1.5 block text-xs font-bold text-[#5a2230]">
              رقم الموبايل
            </label>
            <input
              id="track-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01012345678"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              className="h-12 w-full rounded-2xl border border-[#ecd9d1] bg-white px-4 text-left text-sm font-bold text-[#3a2226] outline-none transition-colors focus:border-[#8a3a46]"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#8a3a46] text-sm font-bold text-white shadow-md transition-all hover:bg-[#5a2230] disabled:opacity-60"
        >
          <Search size={17} />
          {busy ? 'جارٍ البحث عن الطلب…' : 'تتبعي حالة الطلب'}
        </button>
      </form>

      {order && (
        <div className="mt-8 overflow-hidden rounded-3xl border border-[#ebd8d0] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ecd9d1] pb-4">
            <div>
              <span className="text-xs text-muted-foreground">رقم الطلب:</span>
              <strong dir="ltr" className="ms-2 font-mono text-base font-extrabold text-[#7a2e3b]">
                {order.orderNumber}
              </strong>
            </div>
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                order.cancelled
                  ? 'bg-red-100 text-red-700'
                  : 'bg-[#fbeee9] text-[#7a2e3b]'
              }`}
            >
              {order.statusLabel}
            </span>
          </div>

          {!order.cancelled && (
            <div className="mt-7">
              {/* Animated Step Progress Bar */}
              <div className="relative mb-8 px-2">
                <div className="h-2 w-full rounded-full bg-[#fbeee9]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#e9a9ae] to-[#8a3a46] transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <ol className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="مراحل الطلب">
                {STEPS.map((s, i) => {
                  const done = i <= activeIdx;
                  const current = i === activeIdx;
                  const Icon = s.icon;
                  return (
                    <li
                      key={s.key}
                      className={`flex flex-col items-center rounded-2xl p-3 text-center transition-all ${
                        current
                          ? 'border border-[#e9a9ae] bg-[#fffaf8] shadow-sm'
                          : done
                          ? 'bg-[#fdf8f6]'
                          : 'opacity-50'
                      }`}
                    >
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-full transition-transform ${
                          done
                            ? 'bg-[#8a3a46] text-white'
                            : 'border-2 border-[#ecd9d1] bg-white text-muted-foreground'
                        } ${current ? 'scale-110 shadow-md ring-4 ring-[#e9a9ae]/40' : ''}`}
                      >
                        <Icon size={19} />
                      </span>
                      <span className={`mt-2.5 text-xs font-extrabold ${done ? 'text-[#5a2230]' : 'text-muted-foreground'}`}>
                        {s.label}
                      </span>
                      <span className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {s.desc}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Items Summary */}
          <div className="mt-7 border-t border-[#ecd9d1] pt-5">
            <h3 className="text-xs font-bold text-[#5a2230]">محتويات الطلب:</h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              {order.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 rounded-xl bg-[#faf6f3] p-3">
                  <div>
                    <span className="font-bold text-[#3a2226]">{it.name}</span>
                    {it.variant && (
                      <span className="ms-2 text-xs text-muted-foreground">({it.variant})</span>
                    )}
                    <span className="ms-2 inline-block rounded-md bg-white px-2 py-0.5 text-xs font-bold text-[#8a3a46]">
                      × {it.qty}
                    </span>
                  </div>
                  <span className="font-extrabold text-[#7a2e3b]">{egp(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>

            {/* Financials */}
            <dl className="mt-4 space-y-1.5 border-t border-[#ecd9d1] pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>المجموع الفرعي</dt>
                <dd className="font-bold text-[#3a2226]">{egp(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>الشحن وطريقة التوصيل</dt>
                <dd className="font-bold text-[#8a3a46]">
                  {order.shipping === 0
                    ? order.subtotal >= 1500
                      ? 'مجاني (تجاوز 1,500 ج.م) 🌸'
                      : 'يُحدد مع المسؤولة عبر واتساب'
                    : egp(order.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[#ecd9d1] pt-2 text-base">
                <dt className="font-extrabold text-[#3a2226]">الإجمالي المطلوب</dt>
                <dd className="font-extrabold text-[#7a2e3b]">{egp(order.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `مرحبًا LUBNÉL 🌸\nأود الاستفسار عن حالة طلبي:\n• رقم الطلب: ${order.orderNumber}\n• الاسم/الموبايل: ${phone}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-4 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100"
            >
              <MessageCircle size={16} className="text-emerald-600" />
              <span>استفسار عبر واتساب بخصوص هذا الطلب</span>
            </a>
            <Link
              href="/"
              className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#ecd9d1] bg-white px-5 text-xs font-bold text-[#7a2e3b] transition-all hover:bg-[#fbeee9]"
            >
              <span>متابعة التسوق</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrackClient() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>}>
      <TrackContent />
    </Suspense>
  );
}

