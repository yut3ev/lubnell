'use client';

// U76-AI-IMAGES — the assistant now accepts product photos ATTACHED to the
// admin's message (name, price, category …). Photos are compressed in-browser
// (image-compress.ts: ≤1280px JPEG, EXIF-upright → light on mobile data),
// previewed as removable thumbnails, shown inside the sent bubble, and the
// vision agent (src/lib/ai-agent.ts) understands them together with the text
// and can create the product with her exact values — or answer a question
// about the photo. Built to feel native on phone / iPad / tablet: 44px touch
// targets, wrap-friendly preview strip, paste-from-clipboard support.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Loader2, Send, Sparkles, UserRound, Wrench, X } from 'lucide-react';
import { apiJson } from '../helpers';
import { prepareImageFile } from '@/lib/image-compress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ExecutedTool = { tool: string; ok: boolean; dryRun?: boolean; summary?: string };

type ChatItem = {
  role: 'user' | 'ai';
  text: string;
  images?: string[];
  tools?: ExecutedTool[];
  provider?: string;
};

type AttachedImage = { id: string; name: string; dataUrl: string };

const MAX_IMAGES = 5;

const SUGGESTIONS = [
  'لخّصي لي مبيعات اليوم وحالة المخزون',
  'أضيفي منتج "روتين العناية الصباحي" بسعر 450 ج.م في قسم العناية',
  'اقترحي أفكار عروض للجمعة البيضاء',
  'أي المنتجات مخزونها أقل من 5 قطع؟',
];

export default function AssistantSection() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [execute, setExecute] = useState(false);
  const [canExecute, setCanExecute] = useState(false);
  const [files, setFiles] = useState<AttachedImage[]>([]);
  const [preparing, setPreparing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<AttachedImage[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, busy, files]);

  const handleFiles = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list || !list.length) return;
      if (busy || preparing) return;
      const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'));
      if (!incoming.length) {
        toast({ title: 'دي مش صورة — اختاري ملف JPG أو PNG', variant: 'destructive' });
        return;
      }
      const room = MAX_IMAGES - filesRef.current.length;
      if (room <= 0) {
        toast({ title: `الحد الأقصى ${MAX_IMAGES} صور للرسالة الواحدة`, variant: 'destructive' });
        return;
      }
      const chosen = incoming.slice(0, room);
      if (incoming.length > room) {
        toast({ title: `الحد الأقصى ${MAX_IMAGES} صور — هضيف أول ${room} بس` });
      }
      setPreparing(true);
      try {
        const prepared: AttachedImage[] = [];
        for (const f of chosen) {
          try {
            const p = await prepareImageFile(f);
            prepared.push({ id: p.id, name: f.name || 'صورة', dataUrl: p.dataUrl });
          } catch {
            toast({ title: `تعذر قراءة «${f.name}» — جرّبي صورة JPG أو PNG واضحة`, variant: 'destructive' });
          }
        }
        if (prepared.length) {
          setFiles((prev) => [...prev, ...prepared].slice(0, MAX_IMAGES));
        }
      } finally {
        setPreparing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [busy, preparing, toast]
  );

  const send = useCallback(
    async (message: string, history: ChatItem[], imageUrls: string[] = []) => {
      if (busy) return;
      if (!message.trim() && !imageUrls.length) return;
      setItems([...history, { role: 'user', text: message.trim() || 'حللي الصور دي وجهزي المنتج.', images: imageUrls }]);
      setInput('');
      setBusy(true);
      const { ok, status, data } = await apiJson<{
        ok: boolean; reply?: string; executed?: ExecutedTool[]; provider?: string; canExecute?: boolean; error?: string;
      }>('/api/admin/ai', {
        method: 'POST',
        body: JSON.stringify({
          message,
          // API contract is AgentImage[] = {url: dataUrl} objects (strings get
          // filtered out by the route and silently fall back to the text path)
          images: imageUrls.map((u) => ({ url: u })),
          history: history.slice(-6).map((h) => ({ role: h.role, text: h.text })),
          mode: execute ? 'execute' : 'plan',
        }),
      });
      setBusy(false);
      if (!ok || !data?.reply) {
        // attachments stay in place so she can simply re-send after a hiccup
        toast({ title: status === 401 ? 'انتهت الجلسة — أعيدي الدخول' : data?.error || 'تعذر تنفيذ الطلب الآن', variant: 'destructive' });
        return;
      }
      if (data.canExecute !== undefined) setCanExecute(data.canExecute);
      setFiles([]); // success → clear the staging area
      setItems((prev) => [...prev, { role: 'ai', text: data.reply!, tools: data.executed || [], provider: data.provider }]);
    },
    [busy, execute, toast]
  );

  const hasContent = input.trim().length > 0 || files.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          المساعد الذكي: يسألي عن المتجر، يعدّل المنتجات، ويحلل المبيعات — ودلوقتي بيفهم صور المنتجات 📸
        </p>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={execute}
            disabled={!canExecute}
            onChange={(e) => setExecute(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary,#8a2f3b)]"
          />
          {canExecute ? 'وضع التنفيذ الفعلي' : 'التنفيذ متاح للمالكة فقط'}
        </label>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-[30rem] min-h-[18rem] flex-col gap-3 overflow-y-auto rounded-2xl border border-border/60 bg-card p-4"
        aria-live="polite"
      >
        {items.length === 0 && (
          <div className="my-auto text-center">
            <Bot className="mx-auto h-10 w-10 text-primary/40" aria-hidden />
            <p className="mt-2 text-sm font-bold">اسألي المساعد أي شيء عن متجرك</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s, items)}
                  className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-right text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              ارفعي صورة منتج واكتبي اسمه وسعره — والمساعد يضيفه على طول
            </p>
          </div>
        )}

        {items.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === 'user' ? 'bg-secondary text-primary' : 'bg-primary text-primary-foreground'}`} aria-hidden>
              {m.role === 'user' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </span>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-secondary' : 'bg-background border border-border/60'}`}>
              {m.role === 'user' && m.images?.length ? (
                <div className={`mb-1.5 grid gap-1.5 ${m.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {m.images.map((src, j) => (
                    <img
                      key={j}
                      src={src}
                      alt={`صورة مرفقة ${j + 1}`}
                      className="h-28 w-full rounded-xl border border-border/40 object-cover"
                    />
                  ))}
                </div>
              ) : null}
              <p className="whitespace-pre-line">{m.text}</p>
              {m.tools?.length ? (
                <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                  {m.tools.map((t, j) => (
                    <li key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Wrench className="h-3 w-3 shrink-0" aria-hidden />
                      <span dir="ltr" className="font-mono">{t.tool}</span>
                      <span className={t.ok ? 'text-emerald-600' : 'text-destructive'}>{t.ok ? '✓' : '✗'}{t.dryRun ? ' (محاكاة)' : ''}</span>
                      {t.summary && <span className="truncate">{t.summary}</span>}
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.role === 'ai' && m.provider && (
                <p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground/60" dir="ltr">{m.provider}</p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {files.length ? 'بيقرا الصور ويفكر…' : 'المساعد يفكر…'}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-3" role="list" aria-label="الصور المرفقة">
          {files.map((f) => (
            <div key={f.id} className="relative" role="listitem">
              <img src={f.dataUrl} alt={f.name} className="h-16 w-16 rounded-xl border border-border object-cover" />
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                aria-label={`إزالة ${f.name}`}
                className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-white shadow transition-transform hover:scale-110"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
          <p className="min-w-[9rem] flex-1 text-[11px] leading-snug text-muted-foreground">
            بتتهيأ تلقائيًا للويب — سريعة على الموبايل والتابلت ✓
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input, items, files.map((f) => f.dataUrl)); }}
        className="flex items-center gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { void handleFiles(e.target.files); }}
          aria-hidden
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || preparing || files.length >= MAX_IMAGES}
          aria-label="إرفاق صورة"
          title="إرفاق صورة منتج (حتى 5 صور)"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-card text-primary transition-colors hover:bg-secondary disabled:opacity-40"
        >
          {preparing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData?.files;
            if (pasted && pasted.length && Array.from(pasted).some((f) => f.type.startsWith('image/'))) {
              e.preventDefault();
              void handleFiles(pasted);
            }
          }}
          placeholder="مثال: أضيفي المنتج ده باسم «سيروم فيتامين سي» بسعر 320 ج.م…"
          className="h-12 min-w-0 flex-1 rounded-full border border-border bg-card px-5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button type="submit" disabled={busy || preparing || !hasContent} className="h-12 w-12 shrink-0 rounded-full bg-primary p-0 text-primary-foreground shadow-lg shadow-primary/25" aria-label="إرسال">
          <Send className="h-5 w-5" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
