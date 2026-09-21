'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, UserRound, Wrench } from 'lucide-react';
import { apiJson } from '../helpers';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ExecutedTool = { tool: string; ok: boolean; dryRun?: boolean; summary?: string };

type ChatItem = {
  role: 'user' | 'ai';
  text: string;
  tools?: ExecutedTool[];
  provider?: string;
};

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, busy]);

  const send = useCallback(async (message: string, history: ChatItem[]) => {
    if (!message.trim() || busy) return;
    setItems([...history, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);
    const { ok, status, data } = await apiJson<{
      ok: boolean; reply?: string; executed?: ExecutedTool[]; provider?: string; canExecute?: boolean; error?: string;
    }>('/api/admin/ai', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history: history.slice(-6).map((h) => ({ role: h.role, text: h.text })),
        mode: execute ? 'execute' : 'plan',
      }),
    });
    setBusy(false);
    if (!ok || !data?.reply) {
      toast({ title: status === 401 ? 'انتهت الجلسة — أعيدي الدخول' : data?.error || 'تعذر تنفيذ الطلب الآن', variant: 'destructive' });
      return;
    }
    if (data.canExecute !== undefined) setCanExecute(data.canExecute);
    setItems((prev) => [...prev, { role: 'ai', text: data.reply!, tools: data.executed || [], provider: data.provider }]);
  }, [busy, execute, toast]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          المساعد الذكي: يسألي عن المتجر، يعدّل المنتجات، ويحلل المبيعات.
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
          </div>
        )}

        {items.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === 'user' ? 'bg-secondary text-primary' : 'bg-primary text-primary-foreground'}`} aria-hidden>
              {m.role === 'user' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </span>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-secondary' : 'bg-background border border-border/60'}`}>
              <p className="whitespace-pre-line">{m.text}</p>
              {m.tools?.length ? (
                <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                  {m.tools.map((t, j) => (
                    <li key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Wrench className="h-3 w-3" aria-hidden />
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
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> المساعد يفكر…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input, items); }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="مثال: أضيفي خصم 15% على كل منتجات المكياج…"
          className="h-12 flex-1 rounded-full border border-border bg-card px-5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button type="submit" disabled={busy || !input.trim()} className="h-12 w-12 shrink-0 rounded-full bg-primary p-0 text-primary-foreground shadow-lg shadow-primary/25" aria-label="إرسال">
          <Send className="h-5 w-5" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
