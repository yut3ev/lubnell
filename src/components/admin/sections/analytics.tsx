'use client';

// U23-ANALYTICS — «التحليلات» rebuilt into a real E-commerce analytics
// dashboard with its own LUBNÉL / STUDIO visual identity (owner's spec):
// branded header band + view tabs, period selector (7/14/30/90) with
// previous-period comparison, KPI cards that carry value + delta + context,
// a revenue chart with hover details and a ghost comparison line, an orders
// funnel with completion/cancellation rates, a best-sellers table with
// revenue-share bars, revenue-by-city bars, and a proper recent-orders
// table with the badge language (جديد برتقالي / مؤكد أخضر / شحن أزرق / ملغي أحمر).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Minus,
  Package,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { apiJson, EGP, fmtDate, orderNo, STATUS_CLASS, STATUS_LABEL } from '../helpers';
import { Button } from '@/components/ui/button';

type Analytics = {
  ok: boolean;
  range: number;
  compare: boolean;
  kpis: {
    revenue: { value: number; prev: number; deltaPct: number };
    aov: { value: number; prev: number; deltaPct: number; orders: number };
    orders: { value: number; prev: number; deltaAbs: number };
    lowStock: { value: number };
  };
  series: { label: string; revenue: number; orders: number }[];
  prevSeries: { label: string; revenue: number; orders: number }[];
  funnel: {
    counts: Record<string, number>;
    cancelled: number;
    total: number;
    completionRate: number;
    cancellationRate: number;
  };
  bestSellers: { id: string; nameAr: string; image: string | null; qty: number; orders: number; revenue: number; share: number }[];
  cities: { city: string; revenue: number; share: number }[];
  lowProducts: { id: string; nameAr: string; image: string | null; stock: number }[];
  recentOrders: {
    id: string;
    orderNumber: string | null;
    customerName: string;
    city: string;
    status: string;
    total: number;
    createdAt: string;
  }[];
};

type Tab = 'overview' | 'sales' | 'orders' | 'products';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'sales', label: 'المبيعات' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'products', label: 'المنتجات' },
];

const RANGES: { value: 7 | 14 | 30 | 90; label: string }[] = [
  { value: 7, label: 'آخر 7 أيام' },
  { value: 14, label: 'آخر 14 يومًا' },
  { value: 30, label: 'آخر 30 يومًا' },
  { value: 90, label: 'آخر 90 يومًا' },
];

const fmtPct = (v: number) => `${new Intl.NumberFormat('ar-EG').format(Math.abs(v))}%`;

// proper Arabic number agreement for order counts (1 طلب واحد / 2 طلبين / 3-10 طلبات / 11+ طلبًا)
const ordersWord = (n: number) => {
  if (n === 1) return 'طلب واحد';
  if (n === 2) return 'طلبين';
  return `${new Intl.NumberFormat('ar-EG').format(n)} ${n <= 10 ? 'طلبات' : 'طلبًا'}`;
};

function DeltaChip({ pct, light }: { pct: number; light?: boolean }) {
  if (!pct) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-black text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden /> ثابت
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
        up ? (light ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-800') : 'bg-rose-100 text-rose-700'
      }`}
      dir="ltr"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {up ? '↑' : '↓'} {fmtPct(pct)}
    </span>
  );
}

type TipRow = { label: string; revenue: number; orders: number; prev?: number | null };

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: TipRow }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const delta = row.prev != null && row.prev > 0 ? Math.round(((row.revenue - row.prev) / row.prev) * 1000) / 10 : null;
  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur" dir="rtl">
      <p className="text-[11px] font-black text-muted-foreground">{row.label}</p>
      <p className="mt-0.5 text-sm font-black text-primary">{EGP(row.revenue)}</p>
      <p className="text-[11px] font-bold">{row.orders ? `${ordersWord(row.orders)}` : 'بدون طلبات'}</p>
      {row.prev != null && (
        <p className="mt-1 flex items-center gap-1.5 border-t border-border/50 pt-1 text-[10px] font-bold text-muted-foreground">
          الفترة السابقة: {EGP(row.prev)}
          {delta != null && <DeltaChip pct={delta} light />}
        </p>
      )}
    </div>
  );
}

function SectionCard({ title, extra, children, className = '' }: { title: string; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/60 bg-card shadow-sm ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h3 className="text-sm font-black">{title}</h3>
        {extra}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function AnalyticsSection({ onGo }: { onGo?: (section: string) => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<7 | 14 | 30 | 90>(14);
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { ok, data: d } = await apiJson<{ ok: boolean } & Analytics>(
      `/api/admin/analytics?range=${range}&compare=${compare ? '1' : '0'}`,
    );
    if (ok && d?.ok) setData(d);
    else setError(true);
  }, [range, compare]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const chartData: TipRow[] = useMemo(() => {
    if (!data) return [];
    return data.series.map((s, i) => ({ ...s, prev: data.compare ? data.prevSeries[i]?.revenue ?? null : null }));
  }, [data]);

  const k = data?.kpis;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label || '';
  const hasSales = (data?.kpis.revenue.value || 0) > 0 || chartData.some((d) => d.revenue > 0);

  // tab-driven block visibility
  const showChart = tab === 'overview' || tab === 'sales';
  const showFunnel = tab === 'overview' || tab === 'orders';
  const showSellers = tab !== 'orders';
  const showCities = tab === 'overview' || tab === 'sales';
  const showRecent = tab === 'overview' || tab === 'orders';
  const showLow = tab === 'products';

  return (
    <div className="space-y-4">
      {/* ── branded identity band ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-l from-secondary/70 via-card to-card p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -left-10 -top-14 h-44 w-44 rounded-full bg-primary/5 blur-2xl" aria-hidden />
        <span className="block text-[10px] font-black tracking-[0.3em] text-muted-foreground">LUBNÉL / STUDIO</span>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-border/50 pt-3">
          <div>
            <h2 className="text-xl font-black leading-tight sm:text-2xl">التحليلات</h2>
            <p className="mt-0.5 text-xs font-bold text-muted-foreground">نظرة شاملة عن أداء المتجر</p>
          </div>
          <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-bold text-muted-foreground">
            {fmtDate(new Date().toISOString())}
          </span>
        </div>

        {/* view tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="أقسام التحليلات">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* period + comparison controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                range === r.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-background/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            className={`mr-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
              compare ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background/60 text-muted-foreground'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${compare ? 'bg-primary' : 'bg-muted-foreground/40'}`} aria-hidden />
            مقارنة بالفترة السابقة
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-bold text-destructive">
          تعذر تحميل التحليلات — أعيدي المحاولة بالتحديث.
        </p>
      )}

      {/* ── KPI cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!data && !error
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-border/60 bg-card" />)
          : [
              {
                label: 'إجمالي الإيرادات',
                value: k ? EGP(k.revenue.value) : '—',
                delta: k && compare ? <DeltaChip pct={k.revenue.deltaPct} /> : null,
                context: compare ? 'مقارنة بالفترة السابقة' : rangeLabel,
                warn: false,
              },
              {
                label: 'متوسط قيمة الطلب',
                value: k ? EGP(k.aov.value) : '—',
                delta: k && compare ? <DeltaChip pct={k.aov.deltaPct} /> : null,
                context: k ? `من ${ordersWord(k.aov.orders)}` : '',
                warn: false,
              },
              {
                label: 'إجمالي الطلبات',
                value: k ? new Intl.NumberFormat('ar-EG').format(k.orders.value) : '—',
                delta:
                  k && compare && k.orders.deltaAbs !== 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
                        k.orders.deltaAbs > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                      }`}
                      dir="ltr"
                    >
                      {k.orders.deltaAbs > 0 ? '↑' : '↓'} {ordersWord(Math.abs(k.orders.deltaAbs))}
                    </span>
                  ) : null,
                context: rangeLabel,
                warn: false,
              },
              {
                label: 'منخفض المخزون',
                value: k ? `${new Intl.NumberFormat('ar-EG').format(k.lowStock.value)} منتجات` : '—',
                delta: k && k.lowStock.value > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> تحتاج متابعة
                  </span>
                ) : null,
                context: 'أقل من 10 قطع',
                warn: (k?.lowStock.value || 0) > 0,
              },
            ].map((c) => (
              <div
                key={c.label}
                className={`rounded-2xl border bg-card p-4 shadow-sm transition-colors ${
                  c.warn ? 'border-amber-300/60 bg-amber-50/40' : 'border-border/60'
                }`}
              >
                <p className="text-xs font-bold text-muted-foreground">{c.label}</p>
                <p className="mt-1.5 text-2xl font-black tracking-tight">{c.value}</p>
                <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  {c.delta}
                  <span>{c.context}</span>
                </div>
              </div>
            ))}
      </div>

      {/* ── revenue chart + orders funnel ── */}
      <div className={`grid gap-4 ${showChart && showFunnel ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        {showChart && (
          <SectionCard
            title="الإيرادات"
            className={showFunnel ? 'lg:col-span-2' : ''}
            extra={
              <span className="flex items-center gap-2">
                <span className="text-base font-black text-primary">{k ? EGP(k.revenue.value) : '—'}</span>
                {k && compare && <DeltaChip pct={k.revenue.deltaPct} />}
              </span>
            }
          >
            <div className="h-64 w-full sm:h-72" dir="ltr">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={18}
                    />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }} />
                    {compare && (
                      <Area
                        type="monotone"
                        dataKey="prev"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        fill="none"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      fill="url(#revFill)"
                      activeDot={{ r: 4, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {data && !hasSales && (
              <p className="mt-2 text-center text-xs font-bold text-muted-foreground">لا مبيعات في هذه الفترة بعد — السحرة بتمتلئ أول ما توصل طلبات.</p>
            )}
            {compare && (
              <p className="mt-2 flex items-center gap-3 text-[10px] font-bold text-muted-foreground" dir="rtl">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 rounded bg-primary" aria-hidden /> الفترة الحالية
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 rounded border-t-2 border-dashed border-muted-foreground" aria-hidden /> الفترة السابقة
                </span>
              </p>
            )}
          </SectionCard>
        )}

        {showFunnel && data && (
          <SectionCard title="قمع الطلبات">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black">{new Intl.NumberFormat('ar-EG').format(data.funnel.total)}</span>
              <span className="text-xs font-bold text-muted-foreground">{ordersWord(data.funnel.total)} في {rangeLabel}</span>
            </div>
            <ol className="mt-4 space-y-2">
              {(['pending', 'confirmed', 'shipped', 'delivered'] as const).map((st, i) => {
                const count = data.funnel.counts[st] || 0;
                const share = data.funnel.total ? Math.round((count / data.funnel.total) * 100) : 0;
                return (
                  <li key={st}>
                    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 px-3 py-2">
                      <span className="flex items-center gap-2 text-xs font-black">
                        <span className={`inline-block h-2 w-2 rounded-full ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-emerald-500' : i === 2 ? 'bg-sky-500' : 'bg-teal-500'}`} aria-hidden />
                        {STATUS_LABEL[st]}
                      </span>
                      <span className="text-sm font-black">{new Intl.NumberFormat('ar-EG').format(count)}</span>
                    </div>
                    <div className="mx-1 mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-emerald-400' : i === 2 ? 'bg-sky-400' : 'bg-teal-400'}`} style={{ width: `${Math.max(share, count ? 6 : 0)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-center">
                <p className="text-lg font-black text-emerald-700">{new Intl.NumberFormat('ar-EG').format(data.funnel.completionRate)}%</p>
                <p className="text-[10px] font-bold text-emerald-700/80">نسبة الإتمام</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-center">
                <p className="text-lg font-black text-rose-600">{new Intl.NumberFormat('ar-EG').format(data.funnel.cancellationRate)}%</p>
                <p className="text-[10px] font-bold text-rose-600/80">نسبة الإلغاء</p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── best sellers + revenue by city ── */}
      <div className={`grid gap-4 ${showSellers && showCities ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
        {showSellers && (
          <SectionCard title="الأكثر مبيعًا" extra={<span className="text-[10px] font-bold text-muted-foreground">{rangeLabel}</span>}>
            {data && data.bestSellers.length > 0 ? (
              <div className="space-y-2">
                <div className="hidden grid-cols-[2rem_1fr_4rem_4rem_5.5rem] items-center gap-2 px-1 pb-1 text-[10px] font-black text-muted-foreground sm:grid">
                  <span>#</span>
                  <span>المنتج</span>
                  <span className="text-center">المبيعات</span>
                  <span className="text-center">الطلبات</span>
                  <span className="text-left">الإيرادات</span>
                </div>
                {data.bestSellers.map((p, i) => (
                  <div key={p.id} className="rounded-xl bg-secondary/30 p-2.5 transition-colors hover:bg-secondary/50">
                    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 sm:grid-cols-[2rem_1fr_4rem_4rem_5.5rem]">
                      <span className="text-xs font-black text-muted-foreground" dir="ltr">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex min-w-0 items-center gap-2">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                            <Package className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black">{p.nameAr}</span>
                          {/* share-of-revenue bar */}
                          <span className="mt-1 block h-1 w-full max-w-40 overflow-hidden rounded-full bg-secondary">
                            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(p.share, 4)}%` }} />
                          </span>
                        </span>
                      </span>
                      <span className="text-center text-xs font-bold sm:hidden">{new Intl.NumberFormat('ar-EG').format(p.qty)} قطعة</span>
                      <span className="hidden text-center text-xs font-bold sm:block">{new Intl.NumberFormat('ar-EG').format(p.qty)}</span>
                      <span className="hidden text-center text-xs font-bold sm:block">{new Intl.NumberFormat('ar-EG').format(p.orders)}</span>
                      <span className="text-left text-xs font-black text-primary">{EGP(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">لا مبيعات في هذه الفترة بعد.</p>
            )}
          </SectionCard>
        )}

        {showCities && (
          <SectionCard title="الإيرادات حسب المدينة" extra={<span className="text-[10px] font-bold text-muted-foreground">{rangeLabel}</span>}>
            {data && data.cities.length > 0 ? (
              <div className="space-y-3">
                {data.cities.map((c) => (
                  <div key={c.city}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-black">{c.city}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-black text-primary">{EGP(c.revenue)}</span>
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-black text-muted-foreground">{fmtPct(c.share)}</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-primary/90 to-primary/60"
                        style={{ width: `${Math.max(c.share, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">لا طلبات في هذه الفترة بعد.</p>
            )}
          </SectionCard>
        )}
      </div>

      {/* ── low stock detail (المنتجات tab) ── */}
      {showLow && data && (
        <SectionCard title="منتجات تحتاج متابعة" extra={<span className="text-[10px] font-bold text-muted-foreground">المخزون أقل من 10 قطع</span>}>
          {data.lowProducts.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.lowProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-secondary/30 p-2.5">
                  {p.image ? (
                    <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                      <Package className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-black">{p.nameAr}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
                      p.stock <= 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {new Intl.NumberFormat('ar-EG').format(p.stock)} قطعة
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">كل المنتجات مخزونها كويس 👌</p>
          )}
        </SectionCard>
      )}

      {/* ── recent orders ── */}
      {showRecent && (
        <SectionCard
          title="أحدث الطلبات"
          extra={
            onGo ? (
              <Button variant="ghost" size="sm" className="gap-1 rounded-full text-xs font-black text-primary hover:text-primary" onClick={() => onGo('orders')}>
                عرض الكل <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              </Button>
            ) : undefined
          }
        >
          {data && data.recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-right">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] font-black text-muted-foreground">
                    <th className="pb-2 pl-2 font-black">الطلب</th>
                    <th className="pb-2 font-black">العميل</th>
                    <th className="hidden pb-2 font-black sm:table-cell">المدينة</th>
                    <th className="pb-2 font-black">الحالة</th>
                    <th className="pb-2 text-left font-black">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pl-2 font-mono text-xs font-bold" dir="ltr">
                        {orderNo(o.id, o.orderNumber)}
                      </td>
                      <td className="py-2.5 text-xs font-bold">{o.customerName}</td>
                      <td className="hidden py-2.5 text-xs text-muted-foreground sm:table-cell">{o.city}</td>
                      <td className="py-2.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-black ${STATUS_CLASS[o.status] || ''}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-left text-xs font-black text-primary">{EGP(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">لا طلبات بعد.</p>
          )}
        </SectionCard>
      )}

      {/* footer note — analytics window context */}
      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[10px] font-bold text-muted-foreground">
        <BarChart3 className="h-3 w-3" aria-hidden />
        البيانات محدثة لحظيًا — النافذة الحالية {rangeLabel}
        {compare ? ' مع مقارنة بالفترة السابقة' : ''}.
      </p>
    </div>
  );
}
