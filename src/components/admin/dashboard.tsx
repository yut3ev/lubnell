'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  Eye,
  FileText,
  Heading1,
  Home,
  ImageIcon,
  ImageOff,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Loader2,
  Languages,
  Menu,
  Minus,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  Sparkles,
  Star,
  Tags,
  Ticket,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Type,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { apiJson, clearAdminToken, EGP, fmtDate, orderNo, STATUS_CLASS, STATUS_LABEL, type AdminInfo } from './helpers';
import OrdersSection from './sections/orders';
import ProductsSection from './sections/products';
import CategoriesSection from './sections/categories';
import CouponsSection from './sections/coupons';
import UsersSection from './sections/users';
import AuditSection from './sections/audit';
import CustomersSection from './sections/customers';
import MediaSection from './sections/media';
import HomepageSection from './sections/homepage';
import PagesSection from './sections/pages';
import AssistantSection from './sections/assistant';
import AnalyticsSection from './sections/analytics';
import SettingsSection from './sections/settings';
import ContentSection from './sections/content';
import ThemeSection from './sections/theme';
import VisitsSection from './sections/visits';
import ReviewsSection from './sections/reviews';
import { SectionsEditor } from './sections/sections-editor';
import { TextEverything } from './sections/text-everything';
import { Button } from '@/components/ui/button';

type Stats = {
  ordersToday: number;
  revenueTotal: number;
  avgOrder: number;
  lowStock: number;
  totalOrders: number;
  totalProducts: number;
  series: { label: string; total: number }[];
  topProducts: { id: string; nameAr: string; image: string | null; qty: number; revenue: number }[];
  statusCounts: Record<string, number>;
  topViewed?: { slug: string; nameAr: string; image: string | null; views: number }[];
  // U30-DASHBOARD-POLISH — period-over-period KPI comparisons (optional so
  // stale cached responses simply hide the chips instead of crashing).
  trends?: { revenue: Trend; ordersToday: Trend; avg: Trend };
};

type RecentOrder = { id: string; customer: string; total: number; status: string; date: string };

const NAV: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; perm?: string; ownerOnly?: boolean }[] = [
  // U22-TEAM-PERMS — every section now carries its OWN permission key
  // (previously reviews rode on products.read, visits on audit.read, theme +
  // content on settings.read, and the overview was visible to everyone) so the
  // team matrix in «الفريق» can grant each panel area independently.
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, perm: 'dashboard.read' },
  { id: 'orders', label: 'الطلبات', icon: Package, perm: 'orders.read' },
  { id: 'products', label: 'المنتجات', icon: Tags, perm: 'products.read' },
  { id: 'categories', label: 'الأقسام', icon: ListFilter, perm: 'categories.read' },
  { id: 'reviews', label: 'التقييمات', icon: Star, perm: 'reviews.read' },
  { id: 'customers', label: 'العملاء', icon: Users, perm: 'customers.read' },
  { id: 'visits', label: 'سجل الزيارات', icon: Activity, perm: 'visits.read' },
  { id: 'media', label: 'الوسائط', icon: ImageIcon, perm: 'media.read' },
  { id: 'homepage', label: 'الصفحة الرئيسية', icon: Home, perm: 'homepage.read' },
  { id: 'coupons', label: 'العروض والكوبونات', icon: Ticket, perm: 'coupons.read' },
  { id: 'pages', label: 'الصفحات', icon: FileText, perm: 'pages.read' },
  // U14 — the owner asked for team members («الأمن») to be able to edit any
  // texts/designs/images across the site. These three are now PERMISSION-gated
  // (settings.read / sections.read) instead of hard owner-only, so staff
  // granted those keys from «الفريق» can use them. Settings + Users stay owner-only.
  { id: 'sectionstexts', label: 'نصوص الأقسام', icon: Heading1, perm: 'sections.read' },
  { id: 'alltexts', label: 'كل النصوص', icon: Languages, perm: 'sections.read' },
  { id: 'content', label: 'النصوص والفوتر', icon: Type, perm: 'content.read' },
  { id: 'theme', label: 'الثيم والألوان', icon: Palette, perm: 'theme.read' },
  { id: 'assistant', label: 'المساعد', icon: Sparkles, perm: 'ai.use' },
  { id: 'analytics', label: 'التحليلات', icon: BarChart3, perm: 'analytics.read' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, perm: 'settings.read', ownerOnly: true },
  { id: 'users', label: 'الفريق', icon: UserCog, perm: 'users.read', ownerOnly: true },
  { id: 'audit', label: 'السجل', icon: ScrollText, perm: 'audit.read' },
];

export default function AdminDashboard({ admin, onLogout }: { admin: AdminInfo; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const title = NAV.find((n) => n.id === section)?.label || 'نظرة عامة';
  const isOwner = admin.role === 'owner';
  const perms = admin.permissions || [];
  const visibleNav = NAV.filter((n) => {
    if (n.ownerOnly && !isOwner) return false;
    if (!n.perm) return true;
    if (isOwner) return true; // owner implicitly holds every permission
    return perms.includes(n.perm);
  });

  async function logout() {
    await apiJson('/api/admin/logout', { method: 'POST' });
    clearAdminToken();
    onLogout();
  }

  return (
    <div className="flex min-h-screen w-full bg-secondary/40">
      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-border/60 bg-card transition-transform lg:static lg:translate-x-0 ${
          mobileNav ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-black text-primary-foreground">L</span>
          <div>
            <span className="block text-sm font-black tracking-[0.2em]" dir="ltr">LUBNÉL</span>
            <span className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground">STUDIO</span>
          </div>
          <button className="mr-auto lg:hidden" onClick={() => setMobileNav(false)} aria-label="إغلاق القائمة">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="أقسام لوحة الإدارة">
          {visibleNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setMobileNav(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                section === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
              aria-current={section === id ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="space-y-2 border-t border-border/60 p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-black text-primary">
              {admin.displayName.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm">{admin.displayName}</strong>
              <span className="text-[11px] text-muted-foreground">{admin.role === 'owner' ? 'مديرة المتجر' : 'فريق العمل'}</span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full rounded-full">
            <Link href="/"><Eye className="h-3.5 w-3.5" /> مشاهدة المتجر</Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-full rounded-full text-muted-foreground hover:text-destructive" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
          </Button>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)} aria-hidden />}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3.5 backdrop-blur sm:px-6">
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-border lg:hidden" onClick={() => setMobileNav(true)} aria-label="فتح القائمة">
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <span className="block text-[10px] font-bold tracking-[0.25em] text-muted-foreground">LUBNÉL / STUDIO</span>
            <h1 className="text-lg font-black leading-tight sm:text-xl">{title}</h1>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground sm:block" dir="ltr">
              {admin.username}
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
              {admin.displayName.slice(0, 1)}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {section === 'overview' && <Overview onGo={setSection} />}
          {section === 'orders' && <OrdersSection />}
          {section === 'products' && <ProductsSection />}
          {section === 'categories' && <CategoriesSection />}
          {section === 'reviews' && <ReviewsSection />}
          {section === 'customers' && <CustomersSection />}
          {section === 'visits' && <VisitsSection />}
          {section === 'media' && <MediaSection />}
          {section === 'homepage' && <HomepageSection />}
          {section === 'coupons' && <CouponsSection />}
          {section === 'pages' && <PagesSection />}
          {section === 'sectionstexts' && <SectionsEditor />}
          {section === 'alltexts' && <TextEverything />}
          {section === 'content' && <ContentSection />}
          {section === 'theme' && <ThemeSection />}
          {section === 'assistant' && <AssistantSection />}
          {section === 'analytics' && <AnalyticsSection onGo={setSection} />}
          {section === 'settings' && isOwner && <SettingsSection currentId={admin.id} />}
          {section === 'users' && isOwner && <UsersSection currentId={admin.id} />}
          {section === 'audit' && <AuditSection />}
        </main>
      </div>
    </div>
  );
}

/* ---------- overview ---------- */

// U30-DASHBOARD-POLISH — overview visual language: period-over-period trend
// chips (green ▲ / red ▼), a hero sales card, zero-aware chart with per-bar
// values, 1:1 media tiles with a unified no-photo placeholder, layered-card
// depth and colored status pills.
const fmtInt = (v: number) => new Intl.NumberFormat('ar-EG').format(v);
const fmtPctAdmin = (v: number) => `${new Intl.NumberFormat('ar-EG').format(Math.abs(v))}%`;

type Trend = { cur: number; prev: number; pct: number | null };

function TrendChip({ t, label }: { t: Trend; label?: string }) {
  // U30 — the whole unit (chip + context label) disappears when there is
  // nothing meaningful to compare (no activity in either period).
  if (t.prev === 0 && t.cur === 0) return null;
  let chip: React.ReactNode;
  if (t.prev === 0) {
    chip = (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800"
        title="لا توجد فترة سابقة للمقارنة"
      >
        <Sparkles className="h-3 w-3" aria-hidden /> جديد
      </span>
    );
  } else if (t.pct === 0) {
    chip = (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-black text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden /> ثابت
      </span>
    );
  } else {
    const up = (t.pct || 0) > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    chip = (
      <span
        dir="ltr"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
          up ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
        }`}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {up ? '+' : '−'}
        {fmtPctAdmin(Math.abs(t.pct || 0))}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      {chip}
      {label && <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>}
    </span>
  );
}

// unified square media tile — same 1:1 size, same rounding, same border and
// the same no-photo placeholder across «الأكثر مبيعًا» and «الأكثر مشاهدة».
function ProductThumb({ src, name }: { src: string | null; name: string }) {
  return (
    <span
      className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 ${
        src ? 'bg-background' : 'bg-secondary/60'
      }`}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageOff className="h-4 w-4 text-muted-foreground/60" aria-hidden />
      )}
    </span>
  );
}

function Overview({ onGo }: { onGo: (s: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; stats: Stats; recentOrders: RecentOrder[] }>('/api/admin/stats');
    if (ok && data?.ok) {
      setStats(data.stats);
      setRecent(data.recentOrders);
      setError(false);
    } else setError(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (error) return <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-bold text-destructive">تعذر تحميل الإحصائيات — أعيدي المحاولة بالتحديث.</p>;
  if (!stats)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  const maxDay = Math.max(...stats.series.map((s) => s.total), 1);
  const weekTotal = stats.series.reduce((s, d) => s + d.total, 0);
  const trends = stats.trends;

  // U30-DASHBOARD-POLISH — hierarchy: the revenue card is the hero (2 cells,
  // biggest number, branded tint) and icon chips shrink to h-8 so the numbers lead.
  const cards = [
    { label: 'طلبات اليوم', value: fmtInt(stats.ordersToday), sub: `إجمالي الطلبات: ${fmtInt(stats.totalOrders)}`, icon: Package, trend: trends?.ordersToday, trendLabel: 'عن أمس', warn: false },
    { label: 'متوسط قيمة الطلب', value: EGP(stats.avgOrder), sub: `${fmtInt(stats.totalProducts)} منتج في الكتالوج`, icon: Receipt, trend: trends?.avg, trendLabel: 'عن الأسبوع الماضي', warn: false },
    { label: 'منتجات منخفضة المخزون', value: fmtInt(stats.lowStock), sub: 'أقل من 10 قطع', icon: TriangleAlert, trend: null, trendLabel: '', warn: stats.lowStock > 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* hero — revenue (U30: enlarged, branded tint, week-over-week trend) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-l from-primary/[0.07] via-card to-card p-5 shadow-[0_2px_4px_rgb(0_0_0/0.05),0_14px_34px_-14px_rgb(0_0_0/0.18)] sm:col-span-2 xl:col-span-2">
          <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" aria-hidden />
          <div className="relative flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-muted-foreground">إجمالي المبيعات</span>
            {trends && <TrendChip t={trends.revenue} label="عن الأسبوع الماضي" />}
          </div>
          <strong className="relative mt-2 block text-3xl font-black tracking-tight">{EGP(stats.revenueTotal)}</strong>
          <span className="relative mt-1 block text-xs text-muted-foreground">لكل الطلبات غير الملغاة</span>
        </div>
        {cards.map(({ label, value, sub, icon: Icon, trend, trendLabel, warn }) => (
          <div key={label} className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.14)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-muted-foreground">{label}</span>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${warn ? 'bg-amber-100 text-amber-700' : 'bg-secondary text-primary'}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <strong className="mt-2 block text-2xl font-black tracking-tight">{value}</strong>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              {trend && <TrendChip t={trend} label={trendLabel} />}
              <span>{sub}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* 7-day chart */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.14)] xl:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black">المبيعات — آخر 7 أيام</h3>
              <p className="text-xs text-muted-foreground">مجموع الطلبات اليومية غير الملغاة</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => onGo('orders')}>
              كل الطلبات <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* U30-DASHBOARD-POLISH — zero-aware chart: every day shows its value
              (٠ for quiet days), quiet days keep a visible stub at the base,
              an axis line anchors the bars, and the footer states the week total. */}
          <div className="mt-5">
            <div className="flex h-40 items-end gap-1.5 border-b-2 border-border/70 px-0.5 sm:gap-2.5" role="img" aria-label="رسم بياني للمبيعات الأسبوعية">
              {stats.series.map((d, i) => {
                const zero = d.total <= 0;
                return (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className={`text-[10px] font-black tabular-nums ${zero ? 'text-muted-foreground/70' : 'text-foreground'}`}>{fmtInt(d.total)}</span>
                    {zero ? (
                      <div className="h-1 w-full rounded-full bg-primary/25" title={`${d.label}: لا مبيعات`} />
                    ) : (
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-primary/75 to-primary transition-colors hover:from-primary hover:to-primary"
                        style={{ height: `${Math.max(8, (d.total / maxDay) * 118)}px` }}
                        title={`${d.label}: ${EGP(d.total)}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5 px-0.5 sm:gap-2.5">
              {stats.series.map((d, i) => (
                <span key={i} className="flex-1 truncate text-center text-[10px] font-semibold text-muted-foreground">
                  {d.label}
                </span>
              ))}
            </div>
            <p className="mt-3 border-t border-border/50 pt-2.5 text-[11px] font-bold text-muted-foreground">
              {weekTotal > 0
                ? `إجمالي آخر 7 أيام: ${EGP(weekTotal)}`
                : 'لا مبيعات مسجلة خلال آخر 7 أيام — كل يوم فارغ يعني صفر طلبات مكتملة.'}
            </p>
          </div>
        </div>

        {/* top products */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.14)] xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black">الأكثر مبيعًا</h3>
              <p className="text-xs text-muted-foreground">حسب الكميات المباعة</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => onGo('products')}>
              المنتجات <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {stats.topProducts.length === 0 && <p className="text-sm text-muted-foreground">لا مبيعات مسجلة بعد.</p>}
            {stats.topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-secondary/30">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] font-black text-primary">{fmtInt(i + 1).padStart(2, '٠')}</span>
                <ProductThumb src={p.image} name={p.nameAr} />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{p.nameAr}</strong>
                  <span className="text-xs text-muted-foreground">{fmtInt(p.qty)} قطعة مباعة</span>
                </div>
                <b className="text-sm font-black text-primary">{EGP(p.revenue)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* U14 — most viewed products */}
      {stats.topViewed && stats.topViewed.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.14)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black">الأكثر مشاهدة</h3>
              <p className="text-xs text-muted-foreground">عدد مشاهدات صفحات المنتجات</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => onGo('products')}>
              المنتجات <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.topViewed.map((v) => (
              <div key={v.slug} className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/20 p-2.5">
                <ProductThumb src={v.image} name={v.nameAr} />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-black">{v.nameAr}</strong>
                  <span className="text-[11px] text-muted-foreground">{fmtInt(v.views)} مشاهدة</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* recent orders */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.14)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black">أحدث الطلبات</h3>
            <p className="text-xs text-muted-foreground">آخر 5 طلبات وصلت للمتجر</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => onGo('orders')}>
            المتابعة <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-right text-xs text-muted-foreground">
                <th className="pr-0 pl-2 pb-2 font-bold">الطلب</th>
                <th className="px-2 pb-2 font-bold">العميلة</th>
                <th className="px-2 pb-2 font-bold">التاريخ</th>
                <th className="px-2 pb-2 font-bold">الإجمالي</th>
                <th className="pr-2 pl-0 pb-2 font-bold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">لا طلبات بعد.</td></tr>
              )}
              {recent.map((o) => (
                <tr key={o.id} className="border-t border-border/50 transition-colors hover:bg-secondary/20">
                  <td className="py-2.5 pr-0 pl-2 font-black whitespace-nowrap" dir="ltr">{orderNo(o.id)}</td>
                  <td className="px-2 py-2.5">{o.customer}</td>
                  <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.date)}</td>
                  <td className="px-2 py-2.5 font-bold whitespace-nowrap">{EGP(o.total)}</td>
                  <td className="py-2.5 pr-2 pl-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        STATUS_CLASS[o.status] || 'border-border bg-secondary text-muted-foreground'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
