'use client';

import { confirmDialog } from '@/components/ui/confirm-service';


// U17-COUPONS — «العروض والكوبونات» rebuilt to the owner's exact spec:
// header copy, «عرض جديد» dialog with كود الخصم / اسم العرض / نوع الخصم /
// قيمة الخصم / الحد الأدنى للطلب / أقصى خصم اختياري / يبدأ في / ينتهي في /
// حد الاستخدام, إلغاء + حفظ العرض actions, a table of الكود / الخصم /
// الشروط / الاستخدام / الحالة, and her empty-state copy.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Ticket, Trash2, X } from 'lucide-react';
import { apiJson, EGP, fmtDay } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  label: string | null;
  active: boolean;
  usageCount: number;
  usageLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

const EMPTY = {
  code: '',
  label: '',
  type: 'percent',
  value: '',
  minSubtotal: '0',
  maxDiscount: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
};

function couponStatus(c: Coupon): { label: string; cls: string } {
  if (!c.active) return { label: 'موقوف', cls: 'bg-stone-100 text-stone-500' };
  const now = Date.now();
  if (c.startsAt && new Date(c.startsAt).getTime() > now)
    return { label: 'لم يبدأ بعد', cls: 'bg-sky-50 text-sky-700' };
  if (c.endsAt && new Date(c.endsAt).getTime() < now)
    return { label: 'منتهي', cls: 'bg-rose-50 text-rose-700' };
  if (c.usageLimit !== null && c.usageCount >= c.usageLimit)
    return { label: 'اكتمل الاستخدام', cls: 'bg-amber-50 text-amber-700' };
  return { label: 'نشط', cls: 'bg-emerald-50 text-emerald-700' };
}

function termsText(c: Coupon): string {
  const parts: string[] = [];
  parts.push(c.minSubtotal > 0 ? `الحد الأدنى ${EGP(c.minSubtotal)}` : 'بدون حد أدنى');
  if (c.maxDiscount) parts.push(`أقصى خصم ${EGP(c.maxDiscount)}`);
  if (c.startsAt && c.endsAt) parts.push(`من ${fmtDay(c.startsAt)} إلى ${fmtDay(c.endsAt)}`);
  else if (c.endsAt) parts.push(`حتى ${fmtDay(c.endsAt)}`);
  else if (c.startsAt) parts.push(`يبدأ ${fmtDay(c.startsAt)}`);
  return parts.join(' · ');
}

export default function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; coupons: Coupon[] }>('/api/admin/coupons');
    if (ok && data?.ok) setCoupons(data.coupons);
    else setCoupons([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    if (!form.code.trim() || !form.value) {
      toast({ title: 'أدخلي الكود وقيمة الخصم أولًا', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({
        code: form.code,
        label: form.label || undefined,
        type: form.type,
        value: Number(form.value),
        minSubtotal: Number(form.minSubtotal) || 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        active: true,
      }),
    });
    setSaving(false);
    if (!ok || !data?.ok) {
      toast({ title: 'تعذر إنشاء العرض', description: data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: `تم إنشاء العرض ${form.code.toUpperCase()} ✓` });
    setOpen(false);
    setForm(EMPTY);
    load();
  }

  async function toggle(c: Coupon) {
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/coupons/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !c.active }),
    });
    if (ok) {
      toast({ title: c.active ? 'تم إيقاف العرض' : 'تم تفعيل العرض' });
      load();
    } else toast({ title: data?.error || 'تعذر التحديث', variant: 'destructive' });
  }

  async function remove(c: Coupon) {
    if (!(await confirmDialog({ title: 'حذف العرض', message: `حذف العرض ${c.code} نهائيًا؟`, confirmText: 'حذف نهائي', danger: true }))) return;
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
    if (ok) {
      toast({ title: 'تم حذف العرض' });
      load();
    } else toast({ title: data?.error || 'تعذر الحذف', variant: 'destructive' });
  }

  if (!coupons)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* head — her exact copy */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Ticket className="h-5 w-5 text-primary" aria-hidden />
            العروض والكوبونات
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أنشئي عروضًا وأكواد خصم بالنسبة أو القيمة الثابتة، مع حد أدنى وفترة صلاحية وحد للاستخدام.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Plus className="h-4 w-4" aria-hidden /> عرض جديد
        </Button>
      </div>

      {/* table — her exact columns */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/50 text-right text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">الكود</th>
                <th className="px-4 py-3 font-bold">الخصم</th>
                <th className="px-4 py-3 font-bold">الشروط</th>
                <th className="px-4 py-3 font-bold">الاستخدام</th>
                <th className="px-4 py-3 font-bold">الحالة</th>
                <th className="px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const st = couponStatus(c);
                return (
                  <tr key={c.id} className={`border-t border-border/50 ${!c.active ? 'opacity-55' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 font-black tracking-wide" dir="ltr">
                        <Ticket className="h-3.5 w-3.5 text-primary" /> {c.code}
                      </span>
                      {c.label && <span className="mt-1 block text-xs font-bold">{c.label}</span>}
                    </td>
                    <td className="px-4 py-3 font-black text-primary">
                      {c.type === 'percent' ? `${c.value}%` : EGP(c.value)}
                    </td>
                    <td className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">{termsText(c)}</td>
                    <td className="px-4 py-3 font-bold">
                      {c.usageCount}
                      <span className="text-xs font-normal text-muted-foreground"> / {c.usageLimit ?? 'غير محدود'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggle(c)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                        >
                          {c.active ? 'إيقاف' : 'تفعيل'}
                        </button>
                        <button
                          onClick={() => remove(c)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-destructive"
                          aria-label={`حذف ${c.code}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Ticket className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden />
                    <p className="mt-2 text-sm font-black">لا توجد عروض بعد</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      أنشئي أول عرض ليظهر هنا وتابعي استخدامه من لوحة التحكم.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* عرض جديد — her exact fields, order and placeholders */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">عرض جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-code">كود الخصم</Label>
              <Input
                id="cp-code"
                dir="ltr"
                className="text-left font-bold uppercase"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME20"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cp-label">اسم العرض</Label>
              <Input
                id="cp-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="خصم الترحيب"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-type">نوع الخصم</Label>
                <select
                  id="cp-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="percent">نسبة مئوية</option>
                  <option value="fixed">قيمة ثابتة</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-value">قيمة الخصم</Label>
                <Input
                  id="cp-value"
                  type="number"
                  min={1}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === 'percent' ? '20' : '100'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-min">الحد الأدنى للطلب</Label>
                <Input
                  id="cp-min"
                  type="number"
                  min={0}
                  value={form.minSubtotal}
                  onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-max">أقصى خصم اختياري</Label>
                <Input
                  id="cp-max"
                  type="number"
                  min={1}
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  placeholder="بدون حد"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-starts">يبدأ في</Label>
                <Input
                  id="cp-starts"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-ends">ينتهي في</Label>
                <Input
                  id="cp-ends"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cp-limit">حد الاستخدام</Label>
              <Input
                id="cp-limit"
                type="number"
                min={1}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="غير محدود"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" /> إلغاء
              </Button>
              <Button
                disabled={saving || !form.code.trim() || !form.value}
                onClick={save}
                className="rounded-full bg-primary font-bold text-primary-foreground"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ العرض'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
