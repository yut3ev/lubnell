'use client';

// VISITS-1 — storefront visitor log for the admin panel.
// Every visit to the STOREFRONT (not the panel): IP, device/browser parsed
// from the user-agent, entry time, and an expandable per-visit timeline
// replaying what the visitor did (pages viewed, add-to-cart, orders…).
// UI mirrors the team SessionsTab so both logs feel like one system.

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { apiJson, fmtDate } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type VisitRow = {
  id: string;
  sessionId: string;
  ip: string | null;
  device: string | null;
  deviceLabel: string | null;
  entryPath: string | null;
  lastPath: string | null;
  events: number;
  startedAt: string;
  lastSeenAt: string;
};

type VisitEventRow = {
  id: string;
  path: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

type VisitStats = {
  today: number;
  total: number;
  uniqueIpsToday: number;
  deviceBreakdown: Record<string, number>;
};

const ACTION_LABEL: Record<string, string> = {
  page_view: 'مشاهدة صفحة',
  product_view: 'مشاهدة منتج',
  add_to_cart: 'إضافة للسلة',
  cart_view: 'عرض السلة',
  checkout_start: 'بدء إتمام الطلب',
  order_placed: 'إتمام طلب 🛒',
  review_submitted: 'كتابة تقييم',
  newsletter_subscribed: 'اشتراك بالنشرة',
  search: 'بحث في المتجر',
};

const DEVICE_LABEL: Record<string, string> = {
  mobile: 'موبايل',
  tablet: 'تابلت',
  desktop: 'كمبيوتر',
};

const DEVICE_ICON: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

const DEVICE_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'الكل' },
  { key: 'mobile', label: 'موبايل' },
  { key: 'desktop', label: 'كمبيوتر' },
  { key: 'tablet', label: 'تابلت' },
];

export default function VisitsSection() {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [device, setDevice] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trail, setTrail] = useState<VisitEventRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setRefreshing(true);
    const params = new URLSearchParams({ page: String(page) });
    if (device) params.set('device', device);
    if (query) params.set('q', query);
    const { ok, data } = await apiJson<{
      ok: boolean;
      stats: VisitStats;
      visits: VisitRow[];
      totalPages: number;
    }>(`/api/admin/visits?${params.toString()}`);
    setRefreshing(false);
    if (ok && data?.ok) {
      setStats(data.stats);
      setVisits(data.visits);
      setTotalPages(data.totalPages);
    } else {
      if (ok === false) toast({ title: 'تعذر تحميل سجل الزيارات', variant: 'destructive' });
      setVisits([]);
    }
  }, [page, device, query, toast]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // light auto-refresh so "نشطة الآن" stays honest while the tab is open
  useEffect(() => {
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  async function toggleExpand(v: VisitRow) {
    if (expanded === v.id) {
      setExpanded(null);
      setTrail(null);
      return;
    }
    setExpanded(v.id);
    setTrail(null);
    const { ok, data } = await apiJson<{ ok: boolean; visit: { visitEvents: VisitEventRow[] } }>(
      `/api/admin/visits?id=${encodeURIComponent(v.id)}`
    );
    setTrail(ok && data?.ok ? data.visit.visitEvents : []);
  }

  return (
    <div className="space-y-4">
      {/* stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-sm">
          <span className="block text-2xl font-black text-primary">{stats?.today ?? '—'}</span>
          <span className="text-xs font-bold text-muted-foreground">زيارات اليوم</span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-sm">
          <span className="block text-2xl font-black">{stats?.total ?? '—'}</span>
          <span className="text-xs font-bold text-muted-foreground">إجمالي الزيارات</span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-sm">
          <span className="block text-2xl font-black">{stats?.uniqueIpsToday ?? '—'}</span>
          <span className="text-xs font-bold text-muted-foreground">عناوين IP فريدة اليوم</span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-sm">
          <span className="block text-2xl font-black capitalize">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-primary" aria-hidden />
              {stats?.deviceBreakdown?.mobile ?? 0}
              <Monitor className="mr-1.5 h-4 w-4 text-primary" aria-hidden />
              {stats?.deviceBreakdown?.desktop ?? 0}
            </span>
          </span>
          <span className="text-xs font-bold text-muted-foreground">موبايل / كمبيوتر (الإجمالي)</span>
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب الجهاز">
          {DEVICE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setDevice(f.key);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                device === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mr-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setQuery(q.trim()), setPage(1))}
              placeholder='ابحثي برقم IP أو مسار…'
              className="h-9 rounded-full pr-9 text-xs"
              aria-label="بحث في الزيارات"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 text-xs"
            onClick={() => {
              setQuery(q.trim());
              setPage(1);
              load();
            }}
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            بحث
          </Button>
        </div>
      </div>

      {/* list */}
      {!visits && (
        <div className="flex h-52 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
        </div>
      )}

      {visits?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          لا زيارات مسجلة بعد — تُسجّل زيارات المتجر تلقائيًا هنا مع IP والجهاز وكل صفحة يشاهدها الزائر.
        </div>
      )}

      <div className="space-y-2.5">
        {visits?.map((v) => {
          const DeviceIcon = DEVICE_ICON[v.device || 'desktop'] || Globe;
          const isOpen = expanded === v.id;
          return (
            <div key={v.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <DeviceIcon className="h-5 w-5" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm" dir="ltr">{v.ip || 'IP غير معروف'}</strong>
                    <em className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-bold not-italic text-muted-foreground">
                      {DEVICE_LABEL[v.device || ''] || 'جهاز'}
                    </em>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{v.deviceLabel || 'جهاز غير معروف'}</span>
                    <span>دخول: {fmtDate(v.startedAt)}</span>
                    <span>آخر ظهور: {fmtDate(v.lastSeenAt)}</span>
                    {v.entryPath && (
                      <span className="max-w-[220px] truncate" dir="ltr" title={v.entryPath}>
                        أول صفحة: {v.entryPath}
                      </span>
                    )}
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  <Activity className="h-3 w-3" aria-hidden /> {v.events} إجراء
                </span>

                <button
                  onClick={() => toggleExpand(v)}
                  aria-expanded={isOpen}
                  aria-label="عرض تفاصيل الزيارة"
                  className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-border/50 bg-secondary/20 p-4">
                  <p className="mb-2.5 text-xs font-black text-muted-foreground">
                    ماذا فعل الزائر في هذه الزيارة — {v.events} إجراء مسجل
                  </p>
                  {!trail && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                  {trail?.length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">لا إجراءات مسجلة في هذه الزيارة.</p>
                  )}
                  {trail && trail.length > 0 && (
                    <ol className="space-y-2">
                      {trail.map((e) => (
                        <li key={e.id} className="flex items-start gap-2.5 text-xs">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                          <span className="font-bold">{ACTION_LABEL[e.action] || e.action}</span>
                          {e.path && (
                            <span className="min-w-0 truncate text-muted-foreground" dir="ltr" title={e.path}>
                              {e.path}
                            </span>
                          )}
                          {e.detail && e.detail !== e.path && (
                            <span className="min-w-0 truncate text-muted-foreground/80" dir="auto">
                              ({e.detail})
                            </span>
                          )}
                          <span className="mr-auto shrink-0 text-[10px] text-muted-foreground">{fmtDate(e.createdAt)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" /> السابق
          </Button>
          <span className="text-xs font-bold text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
