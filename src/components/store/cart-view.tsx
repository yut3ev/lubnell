'use client';

// Cart + WhatsApp checkout. Guest-only flow: bag → delivery details →
// WhatsApp confirmation. Server re-prices the order; this view validates
// input with clear Arabic messages and composes the organized WA message.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  PartyPopper,
  Loader2,
  MessageCircle,
  Ticket,
  X,
  Check,
  ChevronDown,
  Banknote,
  RefreshCcw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  cartTotals,
  useCart,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  WHATSAPP_NUMBER,
} from '@/lib/cart-store';
import { useT } from '@/lib/i18n';
import { trackVisit } from '@/components/store/visit-tracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Egyptian mobile numbers (010/011/012/015) or generic 8–15 digit intl numbers
const PHONE_RE = /^(01[0125][0-9]{8}|[0-9]{8,15})$/;

// U23-CHECKOUT-MOBILE — Egypt's 27 governorates as input suggestions; the
// datalist keeps free text working for edge cases and international orders.
const EG_GOV = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'القليوبية',
  'كفر الشيخ', 'الغربية', 'المنوفية', 'البحيرة', 'الإسماعيلية', 'بورسعيد',
  'السويس', 'دمياط', 'المنيا', 'بني سويف', 'الفيوم', 'أسيوط', 'سوهاج',
  'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح',
  'شمال سيناء', 'جنوب سيناء',
];

// proper Arabic plural for the bag count chip
function itemCountLabel(items: { qty: number }[], ar: boolean) {
  const n = items.reduce((s, i) => s + i.qty, 0);
  if (!ar) return `${n} ${n === 1 ? 'item' : 'items'}`;
  if (n === 1) return 'قطعة واحدة';
  if (n === 2) return 'قطعتان';
  return `${n.toLocaleString('en-US')} قطع`;
}

// Admin-editable order settings (StoreSettings → store) fetched once from
// the bootstrap payload; falls back to the baked constants until it resolves.
// SETTINGS-HUB: also carries the WhatsApp greeting, delivery window and COD
// availability the owner edits in Studio → «الشحن والدفع».
let shippingSettingsCache: Promise<{
  shippingFee: number;
  freeShippingThreshold: number;
  whatsappMessage?: string;
  deliveryTime?: string;
  codEnabled: boolean;
  currency?: string;
  minOrderTotal: number;
}> | null = null;

function loadShippingSettings() {
  shippingSettingsCache ??= fetch('/api/store/bootstrap', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => {
      const fee = Number(d?.shippingFee);
      const threshold = Number(d?.freeShippingThreshold);
      const min = Number(d?.minOrderTotal);
      return {
        shippingFee: Number.isFinite(fee) && fee >= 0 ? fee : SHIPPING_FEE,
        freeShippingThreshold:
          Number.isFinite(threshold) && threshold >= 0
            ? threshold
            : FREE_SHIPPING_THRESHOLD,
        whatsappMessage: typeof d?.whatsappMessage === 'string' ? d.whatsappMessage : undefined,
        deliveryTime: typeof d?.deliveryTime === 'string' ? d.deliveryTime : undefined,
        codEnabled: d?.codEnabled !== false,
        currency: typeof d?.currency === 'string' && d.currency.trim() ? d.currency.trim() : undefined,
        minOrderTotal: Number.isFinite(min) && min > 0 ? min : 0,
      };
    })
    .catch(() => ({
      shippingFee: SHIPPING_FEE,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      codEnabled: true,
      minOrderTotal: 0,
    }));
  return shippingSettingsCache;
}

export function CartView({ whatsapp }: { whatsapp?: string }) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const { t, ar } = useT();

  // settings-driven shipping — defaults to baked constants, refreshed from bootstrap
  const [ship, setShip] = useState<{
    shippingFee: number;
    freeShippingThreshold: number;
    whatsappMessage?: string;
    deliveryTime?: string;
    codEnabled: boolean;
    currency?: string;
    minOrderTotal: number;
  }>({
    shippingFee: SHIPPING_FEE,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    codEnabled: true,
    minOrderTotal: 0,
  });
  useEffect(() => {
    let dead = false;
    loadShippingSettings().then((s) => {
      if (!dead) setShip(s);
    });
    return () => {
      dead = true;
    };
  }, []);

  const { subtotal, shipping } = cartTotals(items, ship);
  // U19-SETTINGS — the currency label she sets in Studio → بيانات المتجر
  const money = (v: number) => `${v.toLocaleString('en-US')} ${ship.currency || t.egp}`;
  // U19-SETTINGS — minimum order total enforcement
  const belowMin = ship.minOrderTotal > 0 && subtotal < ship.minOrderTotal;

  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', notes: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  // U23-CHECKOUT-MOBILE — phones collapse the summary to one row; sm+ stays open
  const [summaryOpen, setSummaryOpen] = useState(false);

  // coupon state
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const discount = applied?.discount || 0;
  const totalAfterCoupon = Math.max(0, subtotal - discount) + shipping;

  const errors = {
    customerName: form.customerName.trim().length < 2 ? (ar ? 'الاسم مطلوب (حرفان على الأقل)' : 'Name is required') : '',
    phone: !PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))
      ? ar
        ? 'رقم الهاتف غير صحيح — 11 رقمًا'
        : 'Invalid phone number — 11 digits (e.g. 01012345678)'
      : '',
    city: form.city.trim().length < 2 ? (ar ? 'المدينة مطلوبة' : 'City is required') : '',
    address: form.address.trim().length < 5 ? (ar ? 'العنوان مطلوب بالتفصيل' : 'Detailed address is required') : '',
  };
  const formValid = !errors.customerName && !errors.phone && !errors.city && !errors.address;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || checkingCoupon) return;
    setCheckingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      const c = data?.coupon;
      if (c?.valid) {
        setApplied({ code: c.code, discount: c.discount });
        toast({ title: c.message || 'تم تطبيق الخصم 🎉' });
      } else {
        setApplied(null);
        toast({ title: c?.message || 'كود الخصم غير صالح', variant: 'destructive' });
      }
    } catch {
      toast({ title: ar ? 'تعذر التحقق من الكود' : 'Could not check code', variant: 'destructive' });
    } finally {
      setCheckingCoupon(false);
    }
  }

  const remainingForFree = Math.max(0, ship.freeShippingThreshold - subtotal);

  async function submitOrder() {
    if (items.length === 0 || submitting) return;
    if (belowMin) {
      toast({
        title: ar ? 'الحد الأدنى للطلب' : 'Minimum order',
        description: ar
          ? `أقل قيمة للطلب ${money(ship.minOrderTotal)} — ضيفي منتجات بقيمة ${money(ship.minOrderTotal - subtotal)} على الأقل.`
          : `Minimum order is ${money(ship.minOrderTotal)} — add ${money(ship.minOrderTotal - subtotal)} more.`,
        variant: 'destructive',
      });
      return;
    }
    setTouched({ customerName: true, phone: true, city: true, address: true });
    if (!formValid) {
      toast({
        title: ar ? 'بيانات ناقصة أو غير صحيحة' : 'Missing or invalid details',
        description: ar
          ? 'راجعي الحقول المظللة بالأحمر: الاسم، الهاتف، المدينة والعنوان.'
          : 'Check the highlighted fields: name, phone, city and address.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          couponCode: applied?.code,
          items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        toast({
          title: ar ? 'تعذر إتمام الطلب' : 'Could not place order',
          description: data?.error || (ar ? 'راجعي البيانات وحاولي مرة أخرى.' : 'Check details and retry.'),
          variant: 'destructive',
        });
        return;
      }

      // real LUBNÉL flow: order saved → WhatsApp confirmation message
      const orderNumber = `LN-${data.order.id.slice(-6).toUpperCase()}`;
      const finalTotal = data.order.total ?? totalAfterCoupon;
      const lines = items.map((i) => `- ${i.nameAr} × ${i.qty} · ${money(i.price * i.qty)}`).join('\n');
      // SETTINGS-HUB: greeting comes from Studio → «الشحن والدفع» when set
      const greeting = (ship.whatsappMessage || 'مرحبًا LUBNÉL 🌸').trim();
      const message = `${greeting}\nأريد تأكيد الطلب ${orderNumber}:\n\n${lines}\n\nالمجموع الفرعي: ${money(subtotal)}${applied ? `\nكود الخصم ${applied.code}: -${money(applied.discount)}` : ''}\nالشحن: ${shipping === 0 ? 'مجاني' : money(shipping)}\nالإجمالي: ${money(finalTotal)}\n\nبيانات التوصيل:\nالاسم: ${form.customerName}\nالهاتف: ${form.phone}\nالعنوان: ${form.city} — ${form.address}${form.notes ? `\nملاحظات: ${form.notes}` : ''}${(form as Record<string, unknown>).giftNote ? `\nبطاقة إهداء: ${(form as Record<string, unknown>).giftNote as string}` : ''}${ship.codEnabled ? `\n\nطريقة الدفع: الدفع عند الاستلام` : ''}`;
      window.open(`https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');

      setOrderId(data.order.id);
      trackVisit('order_placed', data.order.id);
      clear();
    } catch {
      toast({
        title: ar ? 'خطأ في الاتصال' : 'Connection error',
        description: ar ? 'تحققي من الشبكة وحاولي مرة أخرى.' : 'Check your network and try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- empty state ---------- */
  if (items.length === 0 && !orderId) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-secondary text-primary">
          <ShoppingBag className="h-9 w-9" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">{t.emptyCart}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t.emptyCartSub}</p>
        <Button asChild size="lg" className="mt-6 h-12 rounded-full bg-primary px-8 font-bold text-primary-foreground">
          <Link href="/">{t.startShopping}</Link>
        </Button>
      </div>
    );
  }

  const step = 2; // checkout view = details step (bag is implicitly step 1)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pb-10 sm:pt-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t.checkoutTitle}</h1>

      {/* steps indicator — single row, connector lines, current highlighted */}
      <ol className="mt-3 flex flex-nowrap items-center gap-1 text-[11px] font-bold sm:gap-2 sm:text-xs" aria-label={ar ? 'خطوات الطلب' : 'Checkout steps'}>
        {[
          { n: 1, label: ar ? 'الحقيبة' : 'Bag', state: 'done' as const },
          { n: 2, label: ar ? 'بيانات التوصيل' : 'Delivery details', state: 'current' as const },
          { n: 3, label: ar ? 'تأكيد واتساب' : 'WhatsApp confirm', state: 'todo' as const },
        ].map((s, i) => (
          <li key={s.n} className="flex min-w-0 items-center gap-1 sm:gap-2">
            {i > 0 && <span className="h-px w-3 shrink-0 bg-border sm:w-5" aria-hidden />}
            <span
              className={`flex min-w-0 items-center gap-1.5 rounded-full border py-1 pe-2.5 ps-1.5 ${
                s.state === 'done'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : s.state === 'current'
                    ? 'border-primary/40 bg-card text-primary'
                    : 'border-border bg-card text-muted-foreground'
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
                  s.state === 'done' ? 'bg-primary-foreground/25' : 'bg-secondary'
                }`}
              >
                {s.state === 'done' ? <Check className="h-3 w-3" aria-hidden /> : <span aria-hidden>{s.n}</span>}
              </span>
              <span className="truncate">{s.label}</span>
            </span>
          </li>
        ))}
      </ol>

      {items.length > 0 && remainingForFree > 0 && !belowMin && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/60 bg-accent/30 px-4 py-3">
          <Truck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm font-semibold">{t.freeShipLeft(remainingForFree.toLocaleString('en-US'))}</p>
        </div>
      )}

      {/* U19-SETTINGS — minimum order notice */}
      {belowMin && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <ShoppingBag className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-bold text-destructive">
            {ar
              ? `الحد الأدنى للطلب ${money(ship.minOrderTotal)} — ضيفي منتجات بقيمة ${money(ship.minOrderTotal - subtotal)} لتكملي الطلب.`
              : `Minimum order is ${money(ship.minOrderTotal)} — add ${money(ship.minOrderTotal - subtotal)} more to check out.`}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-6 sm:gap-8 lg:grid-cols-[1fr_400px]">
        {/* items */}
        <section aria-label={ar ? 'منتجات السلة' : 'Bag items'} className="space-y-4">
          {items.map((i) => (
            <div key={i.id} className="flex gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <Link href={`/p/${i.slug}`} className="shrink-0 overflow-hidden rounded-xl bg-secondary/40">
                { }
                <img src={i.image} alt={i.nameAr} loading="lazy" decoding="async" className="h-24 w-24 object-cover" />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/p/${i.slug}`} className="font-bold leading-snug transition-colors hover:text-primary">
                    {i.nameAr}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={ar ? `حذف ${i.nameAr}` : `Remove ${i.nameAr}`}
                    className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i.id)}
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </Button>
                </div>
                <span className="mt-1 text-sm font-bold text-primary">
                  {money(i.price)}
                  {i.qty > 1 && (
                    <span className="ms-2 text-xs font-bold text-muted-foreground">
                      {ar ? 'الإجمالي' : 'Total'}: {money(i.price * i.qty)}
                    </span>
                  )}
                </span>
                <div className="mt-auto flex w-fit items-center rounded-full border border-border bg-background">
                  <Button variant="ghost" size="icon" aria-label="+" className="h-11 w-11 rounded-full" onClick={() => setQty(i.id, i.qty + 1)} disabled={i.qty >= 20}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{i.qty}</span>
                  <Button variant="ghost" size="icon" aria-label="-" className="h-11 w-11 rounded-full" onClick={() => setQty(i.id, i.qty - 1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {items.length > 0 && (
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => clear()}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {ar ? 'إفراغ السلة' : 'Clear bag'}
            </Button>
          )}
        </section>

        {/* summary + checkout */}
        <aside className="flex h-fit flex-col gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          {/* U23-CHECKOUT-MOBILE — on phones the summary collapses to ONE row
              (count + total); expanding reveals lines, coupon and totals.
              sm+ keeps the always-open approved card. */}
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            aria-expanded={summaryOpen}
            className="flex w-full items-center justify-between gap-2 sm:hidden"
          >
            <span className="flex items-center gap-2 text-lg font-extrabold">
              {ar ? 'ملخص الطلب' : 'Order summary'}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {itemCountLabel(items, ar)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-base font-bold text-primary">{money(totalAfterCoupon)}</span>
              <ChevronDown
                aria-hidden
                className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${summaryOpen ? 'rotate-180' : ''}`}
              />
            </span>
          </button>
          <h2 className="hidden text-lg font-extrabold sm:block">{ar ? 'ملخص الطلب' : 'Order summary'}</h2>

          <div className={`${summaryOpen ? 'grid gap-4' : 'hidden'} sm:grid sm:gap-4`}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.subtotal}</span>
              <span className="font-bold">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.shipping}</span>
              <span className="font-bold">{shipping === 0 ? t.free : money(shipping)}</span>
            </div>
            {applied && discount > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <Ticket className="h-3.5 w-3.5" aria-hidden />
                  <span dir="ltr">{applied.code}</span>
                </span>
                <span className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  −{money(discount)}
                  <button
                    onClick={() => {
                      setApplied(null);
                      setCouponInput('');
                    }}
                    aria-label={ar ? 'إزالة الكوبون' : 'Remove coupon'}
                    className="grid h-5 w-5 place-items-center rounded-full text-emerald-600 hover:bg-emerald-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* coupon input */}
          {!applied && (
            <div className="flex gap-2">
              <Input
                dir="ltr"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                placeholder={ar ? 'كود الخصم' : 'Coupon code'}
                className="bg-background text-left uppercase"
                aria-label={ar ? 'كود الخصم' : 'Coupon code'}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!couponInput.trim() || checkingCoupon}
                onClick={applyCoupon}
                className="shrink-0 rounded-full px-4 font-bold"
              >
                {checkingCoupon ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : ar ? 'تطبيق' : 'Apply'}
              </Button>
            </div>
          )}

          <Separator />
          <div className="flex justify-between text-base">
            <span className="font-bold">{t.total}</span>
            <span className="font-bold text-primary">{money(totalAfterCoupon)}</span>
          </div>
          </div>{/* /collapsible summary */}

          <Separator />

          <div className="grid gap-3.5" aria-label={t.deliveryInfo}>
            <h3 className="text-sm font-bold">{t.deliveryInfo}</h3>
            <div className="grid gap-1.5">
              <Label htmlFor="customerName">{t.name}</Label>
              <Input
                id="customerName"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                onBlur={() => setTouched((s) => ({ ...s, customerName: true }))}
                aria-invalid={Boolean(touched.customerName && errors.customerName)}
                aria-describedby={touched.customerName && errors.customerName ? 'customerName-error' : undefined}
                placeholder={ar ? 'مثال: سارة أحمد' : 'e.g. Sara Ahmed'}
                className="h-12 bg-background text-base"
              />
              {touched.customerName && errors.customerName && (
                <p id="customerName-error" className="text-xs font-bold text-destructive">{errors.customerName}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
                aria-invalid={Boolean(touched.phone && errors.phone)}
                aria-describedby={touched.phone && errors.phone ? 'phone-error' : undefined}
                placeholder="01012345678"
                className="h-12 bg-background text-left text-base"
              />
              {touched.phone && errors.phone && (
                <p id="phone-error" className="text-xs font-bold text-destructive">{errors.phone}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="city">{t.city}</Label>
              <Input
                id="city"
                list={ar ? 'eg-governorates' : undefined}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                onBlur={() => setTouched((s) => ({ ...s, city: true }))}
                aria-invalid={Boolean(touched.city && errors.city)}
                aria-describedby={touched.city && errors.city ? 'city-error' : undefined}
                placeholder={ar ? 'مثال: القاهرة' : 'e.g. Cairo'}
                className="h-12 bg-background text-base"
              />
              {ar && (
                <datalist id="eg-governorates">
                  {EG_GOV.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              )}
              {touched.city && errors.city && (
                <p id="city-error" className="text-xs font-bold text-destructive">{errors.city}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address">{t.address}</Label>
              <Textarea
                id="address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                onBlur={() => setTouched((s) => ({ ...s, address: true }))}
                aria-invalid={Boolean(touched.address && errors.address)}
                aria-describedby={touched.address && errors.address ? 'address-error' : undefined}
                placeholder={ar ? 'الشارع، رقم العمارة، الدور، علامة مميزة…' : 'Street, building, floor, landmark…'}
                className="resize-none bg-background text-base"
              />
              {touched.address && errors.address && (
                <p id="address-error" className="text-xs font-bold text-destructive">{errors.address}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">{t.notes}</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t.notesPh}
                className="resize-none bg-background text-base"
              />
            </div>

            {/* trust badges — COD / returns / free shipping right above the CTA */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {[
                { icon: Banknote, label: t.codBadge },
                { icon: RefreshCcw, label: t.returnsBadge },
                {
                  icon: Truck,
                  label: ar
                    ? `شحن مجاني فوق ${ship.freeShippingThreshold.toLocaleString('en-US')}`
                    : `Free shipping over ${ship.freeShippingThreshold.toLocaleString('en-US')}`,
                },
              ].map((b, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/50 px-2.5 py-1 text-[11px] font-bold text-foreground/75"
                >
                  <b.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {b.label}
                </span>
              ))}
            </div>

            <Button
              size="lg"
              disabled={submitting || belowMin}
              onClick={submitOrder}
              className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  {ar ? 'جاري تأكيد الطلب…' : 'Confirming…'}
                </>
              ) : (
                <>
                  <MessageCircle className="h-5 w-5" aria-hidden />
                  {t.confirmWithTotal(money(totalAfterCoupon))}
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t.cod}</p>
            {ship.deliveryTime ? (
              <p className="text-center text-[11px] font-bold text-primary">{ar ? `مدة التوصيل: ${ship.deliveryTime}` : `Delivery: ${ship.deliveryTime}`}</p>
            ) : null}
            <p className="text-center text-[11px] text-muted-foreground">
              {ar ? 'لا يلزم إنشاء حساب — الطلب كضيفة في أقل من دقيقة.' : 'No account needed — guest checkout in under a minute.'}
            </p>
          </div>
        </aside>
      </div>

      {/* U23-CHECKOUT-MOBILE — sticky checkout bar: total + confirm always
          reachable on phones, riding just above the bottom nav (which hides
          at md together with this bar) */}
      {items.length > 0 && !orderId && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/70 bg-card/95 px-4 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="shrink-0">
              <p className="text-[10px] font-bold leading-none text-muted-foreground">{t.total}</p>
              <p className="mt-1 text-base font-bold leading-none text-primary">{money(totalAfterCoupon)}</p>
            </div>
            <Button
              size="lg"
              disabled={submitting || belowMin}
              onClick={submitOrder}
              className="h-11 flex-1 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                  {ar ? 'جاري التأكيد…' : 'Confirming…'}
                </>
              ) : (
                <>
                  <MessageCircle className="h-4.5 w-4.5" aria-hidden />
                  {ar ? 'تأكيد الطلب عبر واتساب' : 'Confirm via WhatsApp'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* success dialog */}
      <Dialog open={!!orderId} onOpenChange={(o) => !o && setOrderId(null)}>
        <DialogContent className="rounded-3xl text-center">
          <DialogHeader>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
              <PartyPopper className="h-8 w-8" aria-hidden />
            </div>
            <DialogTitle className="mt-3 text-2xl">{ar ? 'تم استلام طلبك بنجاح!' : 'Order received!'}</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {ar ? 'شكرًا لثقتك بلوبنيل 🌸 رقم طلبك:' : 'Thank you for shopping LUBNÉL 🌸 Your order:'}{' '}
              <span className="mx-1 font-bold text-primary" dir="ltr">
                {orderId ? `LN-${orderId.slice(-6).toUpperCase()}` : ''}
              </span>
              <br />
              {ar
                ? 'أكملينا رسالة واتساب جاهزة للإرسال — لو لم تُفتح تلقائيًا اضغطي الزر أدناه.'
                : 'We prepared your WhatsApp message — if it didn’t open, use the button below.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setOrderId(null)}
              className="h-11 rounded-full bg-primary px-8 font-bold text-primary-foreground"
            >
              {ar ? 'متابعة التسوق' : 'Keep shopping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
