import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

/**
 * LUBNÉL AI agent — provider-first with hardened local fallback.
 * Rebuilt post-reset (was lost in sandbox wipe). Backend only.
 *
 * Strategy (addresses the old "AI fallback gap" blocker):
 * 1. Try provider (z-ai-web-dev-sdk chat completions) with timeout + retries.
 * 2. On failure (429/5xx/network/empty), degrade gracefully to a local
 *    rule-based assistant grounded in the live product catalog, so the
 *    customer NEVER sees a dead chat even during provider outages.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResult {
  reply: string;
  source: 'provider' | 'local';
  attempts: number;
}

// U21-AI — the static prompt is the LAST-RESORT fallback (DB unreachable);
// it deliberately carries NO hardcoded product prices (they drifted before —
// the live prompt is built from real store data instead).
const BASE_SYSTEM_PROMPT = `أنتِ "لُو" — مساعدة متجر LUBNÉL (لوبنيل) المصري لمستحضرات التجميل والعناية والبوكسات.
- جاوبِ بالعربية الفصحى المبسطة، بأسلوب ودود ومختصر (2-4 جمل كحد أقصى).
- ساعدي العميل في اختيار المنتجات، البوكسات، الأسعار، والشحن.
- الأسعار اللي معاكِ مش مضمونة — قولي للعميلة إن الأسعار الحديثة على صفحة "كل المنتجات"، وتقدري ترشحي حسب نوع المنتج والميزانية بشكل عام.
- الشحن 60 ج.م، ومجاني للطلبات فوق 900 ج.م. التوصيل 2-5 أيام عمل لكل مصر. الإرجاع خلال 14 يوم للمنتجات غير المفتوحة. الدفع عند الاستلام متاح.
- لا تخترعي منتجات أو أسعارًا غير موجودة. لو مش متأكدة، اعترفي بلطف وحوّلي العميل لخدمة العملاء.`;

const PROVIDER_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 2;

/** U21-AI — structured live grounding shared by the prompt and the fallback. */
export type Grounding = {
  productLines: string[];
  shippingLine: string;
  couponLine: string | null;
} | null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('provider timeout')), ms)
    ),
  ]);
}

/** Local rule-based fallback — grounded in live catalog when available. */
export function localFallback(messages: ChatMessage[], g?: Grounding): string {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const q = (last?.content || '').toLowerCase();

  if (/شحن|توصيل|delivery|shipping/.test(q)) {
    return g?.shippingLine || 'الشحن 60 ج.م، ومجاني تمامًا للطلبات فوق 900 ج.م. التوصيل بيستغرق من 2 لـ 5 أيام عمل لجميع محافظات مصر 🌸';
  }
  if (/إرجاع|استبدال|ارجاع|return|refund/.test(q)) {
    return 'ممكن الإرجاع أو الاستبدال خلال 14 يوم من الاستلام بشرط بقاء المنتج بحالته الأصلية. تواصلي معانا وهنرتب كل حاجة فورًا.';
  }
  if (/سعر|كام|price|أسعار|اسعار|ميزانية/.test(q) && g?.productLines.length) {
    return `دي منتجاتنا المتاحة حاليًا بالأسعار الحقيقية:\n${g.productLines.slice(0, 6).join('\n')}\nتحبي أرشحلك حسب ميزانيتك؟`;
  }
  if (/هدية|بوكس|صندوق|gift|box|هديه|جامعة/.test(q) && g?.productLines.length) {
    return `أحلى اختيارات للهدايا عندنا:\n${g.productLines.slice(0, 4).join('\n')}\nكل البوكسات بتجي بتغليف أنيق 🎁`;
  }
  if (/سعر|كام|price|أسعار|اسعار/.test(q)) {
    return 'تقدري تشوفي كل المنتجات وأسعارها الحديثة على صفحة «كل المنتجات» — وأنا موجودة أرشحلك حسب ميزانيتكِ 🌸';
  }
  if (/هدية|بوكس|صندوق|gift|box|هديه/.test(q)) {
    return 'عندنا بوكسات هدايا بتغليف أنيق ومجموعات مختارة — شوفي صفحة «المجموعات» أو قوليلي الميزانية والمناسبة وأنا أرشحلك 🎁';
  }
  if (/شكرا|شكراً|thanks|تسلم/.test(q)) {
    return 'العفو! تحت أمرك في أي وقت — لو محتاجة مساعدة في الاختيار أنا موجودة دايمًا 🌷';
  }
  if (/مرحبا|السلام|اهلا|أهلا|هاي|hello|hi/.test(q)) {
    return 'أهلًا بك في لوبنيل 🌸 أنا "لُو"، مساعدتك لاختيار أجمل الهدايا ومستحضرات التجميل. تحتأمرين بإيه النهاردة؟';
  }
  return 'شكرًا لتواصلك مع لوبنيل 🌸 فريقنا هيرد عليك في أسرع وقت. للطلبات العاجلة: خدمة العملاء متاحة يوميًا من 10 صباحًا لـ 10 مساءً.';
}

/**
 * U21-AI — load LIVE store data so Lou always answers with the real catalog,
 * the owner's current shipping/delivery/COD settings and active coupons (she
 * changes them in Studio → Lou follows). Returns null on any DB hiccup.
 */
async function loadGrounding(): Promise<Grounding> {
  try {
    const [settingRow, products, coupons] = await Promise.all([
      db.storeSettings.findUnique({ where: { key: 'store' } }),
      db.product.findMany({
        where: { published: true },
        orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { createdAt: 'asc' }],
        take: 14,
        select: { nameAr: true, price: true, compareAt: true, badgeAr: true, stock: true },
      }),
      db.coupon.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { code: true, type: true, value: true, minSubtotal: true },
      }),
    ]);

    let store: Record<string, unknown> = {};
    if (settingRow) {
      try {
        store = JSON.parse(settingRow.value || '{}') as Record<string, unknown>;
      } catch {
        store = {};
      }
    }
    if (!products.length && !Object.keys(store).length) return null;

    const shipping = Number(store.shippingFee);
    const threshold = Number(store.freeShippingThreshold);
    const delivery =
      typeof store.deliveryTime === 'string' && store.deliveryTime.trim()
        ? store.deliveryTime.trim()
        : '2-5 أيام عمل';
    const cod = store.codEnabled !== false;

    const shippingLine = `الشحن ${Number.isFinite(shipping) && shipping > 0 ? shipping : 60} ج.م${
      Number.isFinite(threshold) && threshold > 0 ? `، ومجاني تمامًا للطلبات فوق ${threshold} ج.م` : ''
    }. مدة التوصيل ${delivery} لكل مصر. ${cod ? 'الدفع عند الاستلام متاح.' : 'الدفع عند الاستلام غير متاح حاليًا.'} الإرجاع خلال 14 يوم للمنتجات غير المفتوحة.`;

    const productLines = products.map(
      (p) =>
        `• ${p.nameAr} — ${p.price} ج.م${
          p.compareAt && p.compareAt > p.price ? ` (مخفّض من ${p.compareAt} ج.م)` : ''
        }${p.stock <= 0 ? ' (غير متوفر حاليًا)' : ''}${p.badgeAr ? ` — ${p.badgeAr}` : ''}`
    );

    const couponLine = coupons.length
      ? `كوبونات الخصم الفعالة: ${coupons
          .map(
            (c) =>
              `${c.code} (${c.type === 'percent' ? `خصم ${c.value}%` : `خصم ${c.value} ج.م`}${
                c.minSubtotal > 0 ? ` بحد أدنى ${c.minSubtotal} ج.م` : ''
              })`
          )
          .join('، ')}.`
      : null;

    return { productLines, shippingLine, couponLine };
  } catch {
    return null;
  }
}

function buildSystemPrompt(g: Grounding): string {
  if (!g) return BASE_SYSTEM_PROMPT;
  const lines: string[] = [
    'أنتِ "لُو" — مساعدة متجر LUBNÉL (لوبنيل) المصري لمستحضرات التجميل والعناية والبوكسات.',
    '- جاوبِ بالعربية المبسطة، بأسلوب ودود ومختصر (2-4 جمل كحد أقصى).',
    '- ساعدي العميل في اختيار المنتجات والبوكسات والأسعار والشحن، واقترحي حسب ميزانيتها والمناسبة.',
    `- بيانات الشحن الحالية: ${g.shippingLine}`,
  ];
  if (g.productLines.length) {
    lines.push('- المنتجات المتاحة فعلًا (استخدمي الأسعار دي حرفيًا):\n' + g.productLines.map((l) => `  ${l}`).join('\n'));
  }
  if (g.couponLine) lines.push(`- ${g.couponLine}`);
  lines.push(
    '- لا تخترعي منتجات أو أسعارًا غير موجودة في القايمة اللي فوق دي. لو السؤال خارج اختصاصك (أرقام طلبات، شكاوى)، اعتذري بلطف وحوّلي العميل لخدمة العملاء على واتساب.'
  );
  return lines.join('\n');
}

export async function askAssistant(
  history: ChatMessage[]
): Promise<AssistantResult> {
  // U21-AI — live-grounded system prompt (real products/prices/shipping)
  const grounding = await loadGrounding();
  const msgs = [
    { role: 'assistant' as const, content: buildSystemPrompt(grounding) },
    ...history.slice(-10),
  ];

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: msgs,
          thinking: { type: 'disabled' },
        }),
        PROVIDER_TIMEOUT_MS
      );
      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) throw new Error('empty provider response');
      return { reply: content, source: 'provider', attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  console.error(
    `[ai-agent] provider failed after ${MAX_ATTEMPTS} attempts (${lastError}) — using local fallback`
  );
  return { reply: localFallback(history, grounding), source: 'local', attempts: MAX_ATTEMPTS };
}

// ── Legacy admin-agent compat shim (outage-recovery era) ─────────────────
// The pre-wipe admin agent (runAgent with tool execution, images, plan/execute
// modes) was lost in the sandbox wipe; the rebuilt minimal assistant above
// covers customer chat only. The admin route (src/app/api/admin/ai/route.ts)
// still imports the old contract, which broke the production build. This shim
// adapts the old signature onto askAssistant: chat works, tool execution is
// unavailable and always returns executed: []. Images are accepted but text
// is the only channel — documented in the outage-recovery worklog entry.
export type AgentImage = { url: string };
export type AgentHistoryItem = { role: 'user' | 'ai'; text: string };

export async function runAgent(opts: {
  message: string;
  images?: AgentImage[];
  history?: AgentHistoryItem[];
  execute?: boolean;
  admin?: { id: number | string; username: string };
  meta?: unknown;
  permissions?: string[];
}): Promise<{
  reply: string;
  executed: { tool: string; ok: boolean; dryRun: boolean }[];
  provider: 'provider' | 'local';
}> {
  const history: ChatMessage[] = [
    ...(opts.history || []).map((h) => ({
      role: (h.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: h.text,
    })),
    { role: 'user', content: opts.message },
  ];
  const result = await askAssistant(history);
  return { reply: result.reply, executed: [], provider: result.source };
}

/* ---------- AI provider settings (outage-recovery rebuild) ----------
 * The admin AI settings route reads provider config from StoreSettings key
 * "ai". loadAiSettings was lost in the sandbox wipe; this rebuild restores
 * the read path with safe defaults (zai provider, gemini-2.0-flash, no key).
 * Missing DB model/table degrades to defaults instead of throwing. */
export type AiSettings = {
  provider: 'zai' | 'gemini';
  geminiModel: string;
  geminiApiKey: string;
};

export async function loadAiSettings(): Promise<AiSettings> {
  try {
    const row = await db.storeSettings.findUnique({ where: { key: 'ai' } });
    const parsed = row ? (JSON.parse(row.value || '{}') as Partial<AiSettings>) : {};
    return {
      provider: parsed.provider === 'gemini' ? 'gemini' : 'zai',
      geminiModel:
        typeof parsed.geminiModel === 'string' && parsed.geminiModel.trim()
          ? parsed.geminiModel.trim()
          : 'gemini-2.0-flash',
      geminiApiKey: typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : '',
    };
  } catch {
    return { provider: 'zai', geminiModel: 'gemini-2.0-flash', geminiApiKey: '' };
  }
}
