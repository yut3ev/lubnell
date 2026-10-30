'use client';

// PUSH-2026-10 — «الإشعارات» dashboard section: the owner-facing UI for
// /api/admin/push (web-push broadcast). The backend pieces live in
// src/lib/push.ts (VAPID + subscriptions in StoreSettings) and public/sw.js;
// visitors opt in via the soft PushPrompt banner in the storefront.
// → status card (subscribers + readiness) + a broadcast composer, in the
// same visual language as the newsletter section.

import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Info,
  Loader2,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '../helpers';
import { useToast } from '@/hooks/use-toast';

type PushStatus = {
  ok: boolean;
  vapidReady: boolean;
  subscribers: number;
};

export function PushAdminSection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('/');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; vapidReady: boolean; subscribers: number }>(
      '/api/admin/push',
    );
    if (ok && data?.ok) {
      setStatus({ ok: true, vapidReady: !!data.vapidReady, subscribers: data.subscribers || 0 });
    } else {
      setStatus({ ok: false, vapidReady: false, subscribers: 0 });
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function send() {
    if (sending) return;
    if (!title.trim() || !message.trim()) {
      toast({ title: 'اكتبي عنوان الإشعار ونصه الأول', variant: 'destructive' });
      return;
    }
    if (!status?.subscribers) {
      toast({ title: 'مفيش مشتركين إشعارات لسه — الإشعار مش هيوصل لحد', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { ok, data: res } = await apiJson<{ ok: boolean; error?: string; sent?: number; failed?: number }>(
      '/api/admin/push',
      { method: 'POST', body: JSON.stringify({ title, body: message, url: url.trim() || '/' }) },
    );
    setSending(false);
    if (ok && res?.ok) {
      toast({
        title: `تم الإرسال ✓ — ${res.sent ?? 0} وصلت${res.failed ? ` · ${res.failed} فشلت` : ''}`,
      });
      setTitle('');
      setMessage('');
      setUrl('/');
      await load();
    } else {
      toast({ title: res?.error || 'تعذر الإرسال', variant: 'destructive' });
    }
  }

  const ready = !!status?.vapidReady;

  return (
    <div className="space-y-4">
      {/* readiness banner */}
      {status === null && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5">
          <Loader2 className="h-4.5 w-4.5 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">جاري التحميل…</p>
        </div>
      )}
      {status !== null && !ready && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5" role="status">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-500">
            نظام الإشعارات مش جاهز على السيرفر حاليًا — جربي تحدّثي الصفحة، ولو فضلت المشكلة بصّي في سجل السيرفر.
          </p>
        </div>
      )}
      {status !== null && ready && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-600/25 bg-emerald-600/10 px-4 py-3" role="status">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-500">
            نظام الإشعارات جاهز — عندكِ <span className="font-black">{status.subscribers}</span>{' '}
            {status.subscribers === 1 ? 'مشترك' : 'مشتركين'} هيوصلكم كل إشعار فورًا.
          </p>
        </div>
      )}

      {/* how it grows */}
      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5">
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p>
            المشتركين بيزيدوا لوحدهم: كل زائرة بتفعّل «إشعارات لوبنيل» من الشريط اللي بيظهر في المتجر بتتسجل هنا تلقائيًا.
          </p>
          <p>
            كمان الإشعارات بتتبعت أوتوماتيك لما منتج نفدت كميته يرجع تاني — محتاجة بس تحدّثي الكمية من شاشة المنتجات.
          </p>
        </div>
      </div>

      {/* stats + composer */}
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <BellRing className="h-4.5 w-4.5 text-primary" aria-hidden />
            إشعار لكل المشتركين
          </h3>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
            <Bell className="h-3.5 w-3.5" aria-hidden />
            {status?.subscribers ?? 0} مشترك
          </span>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="push-title">
              عنوان الإشعار <span className="text-muted-foreground/70">({title.length}/60)</span>
            </label>
            <Input
              id="push-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="جديد لوبنيل 🌸 تخفيضات نهاية الأسبوع"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="push-message">
              نص الإشعار <span className="text-muted-foreground/70">({message.length}/180)</span>
            </label>
            <Textarea
              id="push-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={180}
              rows={3}
              className="resize-y leading-relaxed"
              placeholder="خصم يوصل لـ 30% على مجموعة العناية بالبشرة — لفترة محدودة!"
            />
            <p className="text-[11px] text-muted-foreground">نص قصير وواضح أحسن — الإشعار بيتعرض في شريط واحد على الموبايل.</p>
          </div>
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="push-url">
              الرابط اللي بتفتحه الضغطة (اختياري)
            </label>
            <Input
              id="push-url"
              dir="ltr"
              className="text-left font-mono text-xs"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/"
            />
            <p className="text-[11px] text-muted-foreground">مثال: <span dir="ltr" className="font-mono">/p/slug-المنتج</span> أو <span dir="ltr" className="font-mono">/cart</span> — فاضي يعني الصفحة الرئيسية.</p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-4">
          <Button
            onClick={send}
            disabled={sending}
            className="h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 sm:w-auto sm:px-10"
          >
            {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : <Send className="h-4 w-4 -scale-x-100 rtl:rotate-180" aria-hidden />}
            {sending ? 'جاري الإرسال…' : `إرسال لـ ${status?.subscribers ?? 0} مشترك`}
          </Button>
        </div>
      </div>
    </div>
  );
}
