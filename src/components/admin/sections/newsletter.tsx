'use client';

// U71-NEWSLETTER-ADMIN — «النشرة البريدية» dashboard section.
// The owner's ask: «ضيف اوبشن ف لوحة التحكم النشرة البريدية … المشتركون
// البريد الإلكتروني الاسم Lang Date ip مع امكانية ارسال رسالة احترافية
// ليهم بتمبلت جاهز يخص الموقع علي بريدهم».
// → subscribers table (email/name/lang/date/ip) + a composer with a
// ready-made branded template, live preview (the EXACT html that ships —
// same buildNewsletterHtml the API uses), per-language targeting, a test
// send, and a send history log.

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MailPlus,
  Send,
  Sparkles,
  TriangleAlert,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiJson, fmtDate } from '../helpers';
import { useToast } from '@/hooks/use-toast';
import {
  READY_TEMPLATE_AR,
  READY_TEMPLATE_EN,
  buildNewsletterHtml,
} from '@/lib/newsletter-template';

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  lang: string;
  ip: string | null;
  createdAt: string;
};

type SendLog = {
  id: string;
  subject: string;
  target: string;
  recipients: number;
  sent: number;
  failed: number;
  status: string;
  createdAt: string;
};

type NewsletterData = {
  subscribers: Subscriber[];
  logs: SendLog[];
  smtpReady: boolean;
  smtpUser: string;
  smtpFromName: string;
  smtpFromEmail: string;
};

type Target = 'all' | 'ar' | 'en';

const TARGET_LABEL: Record<Target, string> = {
  all: 'كل المشتركين',
  ar: 'العربية فقط',
  en: 'English only',
};

export function NewsletterAdminSection() {
  const { toast } = useToast();
  const [data, setData] = useState<NewsletterData | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean } & NewsletterData>('/api/admin/newsletter');
    if (ok && data?.ok) setData({ subscribers: data.subscribers, logs: data.logs, smtpReady: data.smtpReady, smtpUser: data.smtpUser, smtpFromName: data.smtpFromName, smtpFromEmail: data.smtpFromEmail });
    else setData({ subscribers: [], logs: [], smtpReady: false, smtpUser: '', smtpFromName: '', smtpFromEmail: '' });
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const segCount = (seg: Target) => {
    if (!data) return 0;
    if (seg === 'all') return data.subscribers.length;
    return data.subscribers.filter((s) => s.lang === seg).length;
  };

  async function send() {
    if (sending) return;
    if (!subject.trim() || !message.trim()) {
      toast({ title: 'اكتبي عنوان الرسالة ونصها الأول', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { ok, data: res } = await apiJson<{ ok: boolean; error?: string; sent?: number; failed?: number; total?: number; test?: boolean }>(
      '/api/admin/newsletter/send',
      { method: 'POST', body: JSON.stringify({ subject, message, target, testEmail: testEmail.trim() || undefined }) },
    );
    setSending(false);
    if (ok && res?.ok) {
      toast({
        title: res.test
          ? `تم إرسال الرسالة التجريبية على ${testEmail.trim()} ✓ — لو مش واصلة خلال دقايق بصّي في Spam وفعّلي «مش سبام»`
          : `تم الإرسال ✓ — ${res.sent} وصلت${res.failed ? ` · ${res.failed} فشلت` : ''}`,
      });
      await load();
    } else {
      toast({ title: res?.error || 'تعذر الإرسال', variant: 'destructive' });
    }
  }

  function applyTemplate(lang: 'ar' | 'en') {
    const tpl = lang === 'en' ? READY_TEMPLATE_EN : READY_TEMPLATE_AR;
    setSubject(tpl.subject);
    setMessage(tpl.message);
    setPreview(true);
    toast({ title: lang === 'en' ? 'Ready template loaded — edit freely' : 'التمبلت الجاهز اتحمّل — عدّلي براحتك 🌸' });
  }

  const previewLang = target === 'en' ? 'en' : 'ar';

  return (
    <div className="space-y-4">
      {/* SMTP status */}
      {data && !data.smtpReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5" role="status">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-500">
            عشان تبعتيلهم فعليًا، ضيفي بيانات سيرفر الإيميل من{' '}
            <span className="font-bold">الإعدادات → بيانات المتجر → «إعدادات البريد الصادر (SMTP)»</span>{' '}
            (مزوّد مجاني زي Brevo يكفي) — التمبلت والمعاينة والجدول شغالين حتى قبل كده.
          </p>
        </div>
      )}
      {data?.smtpReady && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-600/25 bg-emerald-600/10 px-4 py-3" role="status">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-500">
            البريد جاهز للإرسال — المرسل الظاهر:{' '}
            <span dir="ltr" className="font-mono">
              {data.smtpFromEmail || data.smtpUser}
            </span>
            {data.smtpFromName ? ` باسم «${data.smtpFromName}»` : ''}
          </p>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {([
          { k: 'all' as Target, Icon: Users, label: 'الكل' },
          { k: 'ar' as Target, Icon: Mail, label: 'عربي' },
          { k: 'en' as Target, Icon: Mail, label: 'EN' },
        ]).map(({ k, Icon, label }) => (
          <div key={k} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-black leading-none">{segCount(k)}</p>
              <p className="mt-1 truncate text-[11px] font-bold text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* composer */}
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <MailPlus className="h-4.5 w-4.5 text-primary" aria-hidden />
            رسالة جديدة للمشتركين
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-full text-xs font-bold" onClick={() => applyTemplate('ar')}>
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              تمبلت جاهز
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-full text-xs font-bold" onClick={() => applyTemplate('en')} dir="ltr">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              EN template
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="nl-subject">عنوان الرسالة</label>
            <Input id="nl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="جديد لوبنيل 🌸 خصم خاص لمشتركات النشرة" maxLength={150} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="nl-message">نص الرسالة</label>
            <Textarea id="nl-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="min-h-36 resize-y leading-relaxed" placeholder="اكتبي رسالتك هنا…" />
            <p className="text-[11px] text-muted-foreground">الأسطر الفارغة تظهر كما هي، وأي رابط يتلوّن ويصبح قابلًا للضغط تلقائيًا.</p>
          </div>
        </div>

        {/* target + actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold text-muted-foreground">الإرسال إلى:</span>
          <div className="flex overflow-hidden rounded-full border border-border/60" role="group" aria-label="تقسيم المشتركين">
            {(Object.keys(TARGET_LABEL) as Target[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTarget(k)}
                aria-pressed={target === k}
                className={`px-3.5 py-2 text-xs font-bold transition-colors ${target === k ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-secondary'}`}
              >
                {TARGET_LABEL[k]} ({segCount(k)})
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full text-xs font-bold"
            onClick={() => setPreview((p) => !p)}
            aria-expanded={preview}
          >
            {preview ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {preview ? 'إخفاء المعاينة' : 'معاينة الرسالة'}
          </Button>
        </div>

        {/* preview — the EXACT html the API sends */}
        {preview && (
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <iframe
              title="معاينة رسالة النشرة"
              srcDoc={buildNewsletterHtml({ subject: subject || 'عنوان الرسالة', message: message || 'نص الرسالة سيظهر هنا…', lang: previewLang })}
              className="h-[480px] w-full bg-white"
              sandbox=""
            />
          </div>
        )}

        {/* test + send */}
        <div className="grid gap-2.5 border-t border-border/50 pt-4 sm:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="nl-test">رسالة تجريبية على إيميلك (اختياري)</label>
            <Input id="nl-test" dir="ltr" type="email" className="text-left" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="flex items-end">
            <Button onClick={send} disabled={sending} className="h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
              {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : <Send className="h-4 w-4 -scale-x-100 rtl:rotate-180" aria-hidden />}
              {sending ? 'جاري الإرسال…' : testEmail.trim() ? 'إرسال تجريبي' : `إرسال لـ ${segCount(target)} مشتركة`}
            </Button>
          </div>
        </div>
      </div>

      {/* subscribers table */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5">
          <h3 className="text-sm font-black">المشتركون</h3>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-black">{segCount('all')}</span>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-secondary/70 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-3 text-right font-bold">البريد الإلكتروني</th>
                <th className="px-4 py-3 text-right font-bold">الاسم</th>
                <th className="px-4 py-3 text-right font-bold">Lang</th>
                <th className="px-4 py-3 text-right font-bold">Date</th>
                <th className="hidden px-4 py-3 text-right font-bold sm:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {data === null && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">جاري التحميل…</td></tr>
              )}
              {data !== null && data.subscribers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">لا يوجد مشتركون بعد — كل من يشترك من فوتر المتجر («نادي لوبنيل») يظهر هنا فورًا.</td></tr>
              )}
              {data?.subscribers.map((s) => (
                <tr key={s.id} className="border-t border-border/40 transition-colors hover:bg-secondary/25">
                  <td className="px-4 py-3 font-bold" dir="ltr">{s.email}</td>
                  <td className="px-4 py-3">{s.name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-black uppercase">{s.lang}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.createdAt)}</td>
                  <td className="hidden px-4 py-3 font-mono text-[11px] text-muted-foreground sm:table-cell" dir="ltr">{s.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* send history */}
      {data && data.logs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 py-3.5">
            <h3 className="text-sm font-black">سجل الإرسال</h3>
          </div>
          <ul className="divide-y divide-border/40">
            {data.logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    l.status === 'sent' ? 'bg-emerald-600/10 text-emerald-600' : l.status === 'partial' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600'
                  }`}
                  aria-hidden
                >
                  {l.status === 'failed' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{l.subject}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {l.target === 'test' ? 'تجربة' : TARGET_LABEL[(l.target as Target)] || l.target}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">
                  {l.sent}/{l.recipients} وصلت{l.failed ? ` · ${l.failed} فشلت` : ''}
                </span>
                <span className="text-[11px] text-muted-foreground">{fmtDate(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
