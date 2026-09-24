'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Monitor, Search, Smartphone, Tablet } from 'lucide-react';
import { apiJson, fmtDate } from '../helpers';
import { Input } from '@/components/ui/input';

type Log = {
  id: string;
  actor: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'تسجيل دخول',
  'auth.logout': 'تسجيل خروج',
  'owner.created': 'إنشاء Owner',
  'staff.created': 'إضافة موظف',
  'staff.updated': 'تعديل موظف',
  'staff.deleted': 'حذف موظف',
  'session.revoked': 'إنهاء جلسة',
  'role.saved': 'حفظ صلاحيات',
  'order.status_updated': 'تحديث حالة طلب',
  'order.deleted': 'حذف طلب',
  'order.cancel_requested': 'طلب إلغاء من عميلة',
  'product.created': 'إضافة منتج',
  'product.updated': 'تعديل منتج',
  'product.deleted': 'حذف منتج',
  'product.cleared': 'تصفير منتج مرتبط بطلبات',
  'category.created': 'إضافة قسم',
  'category.updated': 'تعديل قسم',
  'category.deleted': 'حذف قسم',
  'coupon.created': 'إضافة كوبون',
  'coupon.updated': 'تعديل كوبون',
  'coupon.deleted': 'حذف كوبون',
  'settings.updated': 'حفظ إعدادات / نصوص / ثيم',
  'slide.saved': 'حفظ سلايدر',
  'slide.removed': 'حذف سلايدر',
  'home_sections.published': 'نشر أقسام الرئيسية',
  'home_sections.updated': 'تحديث أقسام الرئيسية',
  'sections.updated': 'حفظ نصوص الأقسام',
  'media.uploaded': 'رفع صورة للمكتبة',
  'media.uploaded.video': 'رفع فيديو للمكتبة',
  'media.deleted': 'حذف من المكتبة',
  'review.approved': 'اعتماد مراجعة',
  'review.deleted': 'حذف مراجعة',
  'review.unpublished': 'إلغاء نشر مراجعة',
  'review.unfeatured': 'إلغاء تمييز مراجعة',
  'wishlist.export': 'تصدير المفضلة',
};

// U22 — the «الجهاز» column: same device parsing style as the visits log
function parseDevice(ua: string | null): { device: 'desktop' | 'mobile' | 'tablet' | null; label: string } {
  if (!ua) return { device: null, label: '—' };
  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = /Mobi|Android.*Mobile|iPhone/i.test(ua);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : 'متصفح';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'نظام';
  return { device, label: `${browser} · ${os}` };
}

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;

export default function AuditSection() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [filter, setFilter] = useState('');
  const [actor, setActor] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.trim()) params.set('action', filter.trim());
    if (actor.trim()) params.set('actor', actor.trim());
    const qs = params.toString();
    const { ok, data } = await apiJson<{ ok: boolean; logs: Log[] }>(
      `/api/admin/audit${qs ? `?${qs}` : ''}`
    );
    if (ok && data?.ok) setLogs(data.logs);
    else setLogs([]);
  }, [filter, actor]);

  useEffect(() => {
    const t = setTimeout(load, filter || actor ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filter, actor]);

  if (!logs)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  const actionLabel = (l: Log) => {
    if (l.action === 'settings.updated' && l.entity === 'hero_slide') return 'حفظ سلايدر';
    return ACTION_LABEL[l.action] || l.action;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-xs flex-1 sm:max-w-sm">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="فلترة بنوع الحدث… مثل: auth" className="rounded-full bg-card pr-9" />
        </div>
        <div className="relative max-w-xs flex-1 sm:max-w-[220px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="فلترة باسم المستخدم…" className="rounded-full bg-card pr-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-secondary/50 text-right text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">الوقت</th>
                <th className="px-4 py-3 font-bold">بواسطة</th>
                <th className="px-4 py-3 font-bold">الحدث</th>
                <th className="px-4 py-3 font-bold">المنجز</th>
                <th className="px-4 py-3 font-bold">IP</th>
                <th className="px-4 py-3 font-bold">الجهاز</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const dev = parseDevice(l.userAgent);
                const Icon = dev.device ? DEVICE_ICON[dev.device] : null;
                return (
                  <tr key={l.id} className="border-t border-border/50">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-2.5 font-bold" dir="ltr">{l.actor || '—'}</td>
                    <td className="px-4 py-2.5">
                      <em className="rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-bold not-italic">
                        {actionLabel(l)}
                      </em>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {l.entity ? `${l.entity}${l.entityId ? ` · ${l.entityId.slice(-6)}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground" dir="ltr">{l.ip || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {Icon && <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />}
                        {dev.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">لا أحداث مطابقة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
