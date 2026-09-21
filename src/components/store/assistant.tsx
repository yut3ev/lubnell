'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Send, Loader2, MessageCircleHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: Msg = {
  role: 'assistant',
  content: 'أهلًا بك في لوبنيل 🌸 أنا "لُو"، مساعدتك الشخصية. اسأليني عن الهدايا، الأسعار، أو الشحن!',
};

const QUICK = ['إيه الهدايا المناسبة للجامعة؟', 'كم سعر الشحن؟', 'في خصومات حاليًا؟'];

export function AssistantWidget() {
  const { ar } = useT();
  const pathname = usePathname();
  // U21-LOU-FLOAT — on product pages the sticky add-to-cart bar occupies the
  // band right above the bottom nav; floats (and the chat panel) climb above
  // it there, otherwise they sit just above the nav.
  // U23-CHECKOUT-MOBILE — /cart joins the raised pages: its sticky checkout
  // bar occupies the same bottom zone the sticky ATC does on product pages.
  const isPdp = pathname.startsWith('/p/') || pathname.startsWith('/cart');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  // U10-LOU — any storefront surface (AI stylist banner, product page, …) can
  // summon the widget via window.dispatchEvent(new CustomEvent('open-lou')).
  useEffect(() => {
    const openLou = () => setOpen(true);
    window.addEventListener('open-lou', openLou);
    return () => window.removeEventListener('open-lou', openLou);
  }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            data?.reply ||
            'عذرًا، حصلت مشكلة مؤقتة. جرّبي تاني بعد لحظات 🌸',
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'الاتصال ضعيف الآن — تأكدي من الشبكة وحاولي مرة أخرى 🌷' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* U22-AI-ONLY-FLOAT — the floating WhatsApp bubble was removed at the
          owner's request; Lou is now the ONE and only float, taking WhatsApp's
          old corner (bottom-left, the conventional chat-bubble spot in RTL),
          still raised above the bottom nav on phones and above the sticky
          add-to-cart bar on product pages, never affecting page scroll.
          U42-LOU-FLOAT — the owner called the flat disc + cramped corner chip
          ugly («شكل الايقون دي عايز يتحسن شكلها بداي وحش»): the launcher is
          now a lit brand sphere (radial light + inner highlight + colored
          shadow), a slow breathing halo invites the first tap, and the AI
          medallion is a lifted gradient chip that no longer reads as a
          growth stuck on the edge. All colors derive from the theme vars
          (color-mix) so light/dark both adapt. Behavior untouched. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={ar ? 'افتحي المساعدة الذكية لُو' : 'Open Lou — smart assistant'}
          className={`group fixed left-4 z-50 block h-14 w-14 [-webkit-tap-highlight-color:transparent] md:left-5 ${
            isPdp
              ? 'bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-5'
              : 'bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-5'
          }`}
        >
          {/* breathing halo — behind the disc, invites without shouting */}
          <span aria-hidden className="lou-halo absolute inset-0 rounded-full bg-primary/50" />
          {/* the disc — lit sphere in the brand rust */}
          <span
            aria-hidden
            className="lou-disc relative grid h-full w-full place-items-center rounded-full text-primary-foreground transition-transform duration-300 ease-out group-hover:scale-105 group-active:scale-95"
          >
            <MessageCircleHeart
              className="h-7 w-7 -translate-x-px drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
              aria-hidden
            />
          </span>
          {/* AI medallion — lifted, gradient cream, clean separation */}
          <span
            aria-hidden
            className="lou-badge absolute -top-1.5 -end-1.5 grid h-6 min-w-6 place-items-center rounded-full px-1 text-[10px] font-black tracking-wide text-primary ring-2 ring-background"
          >
            AI
          </span>
        </button>
      )}

      {/* chat panel — anchored above the float on the same (left) side */}
      {open && (
        <div
          role="dialog"
          aria-label="المساعدة الذكية لوبنيل"
          className={`fixed left-4 z-50 flex h-[480px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-border/80 shadow-2xl shadow-primary/20 bg-card/85 supports-[backdrop-filter]:bg-card/55 supports-[backdrop-filter]:backdrop-blur-2xl md:left-5 md:max-h-[calc(100dvh-3rem)] ${
            isPdp
              ? 'bottom-[calc(13.75rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-14.5rem)] md:bottom-5'
              : 'bottom-[calc(9.25rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-10rem)] md:bottom-5'
          }`}
        >
          <div className="flex items-center justify-between gap-2.5 border-b border-border/70 bg-primary/90 text-primary-foreground supports-[backdrop-filter]:bg-primary/70 supports-[backdrop-filter]:backdrop-blur-xl px-4 py-3">
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/15">
                <MessageCircleHeart className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="block leading-tight">
                <span className="block text-sm font-bold">لُو — المساعدة الذكية</span>
                <span className="block text-[11px] opacity-80">متاحة الآن للرد على استفساراتك</span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المحادثة"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15 transition-colors hover:bg-primary-foreground/25"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-full flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground rounded-br-sm'
                    : 'mr-auto bg-secondary/90 supports-[backdrop-filter]:bg-secondary/70 text-secondary-foreground rounded-bl-sm'
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary/90 supports-[backdrop-filter]:bg-secondary/70 px-3.5 py-2.5 text-sm text-secondary-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                لُو بتكتب…
              </div>
            )}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-primary/25 bg-background/75 supports-[backdrop-filter]:bg-background/55 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border/70 bg-card/40 supports-[backdrop-filter]:bg-card/25 supports-[backdrop-filter]:backdrop-blur-md p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتبي سؤالك هنا…"
              aria-label="رسالتك للمساعدة"
              className="rounded-full border-primary/20 bg-background/85 supports-[backdrop-filter]:bg-background/65"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              aria-label="إرسال"
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground"
            >
              <Send className="h-4 w-4 -scale-x-100" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
