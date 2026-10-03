import ZAI from 'z-ai-web-dev-sdk';
import { tryLocalAdminCommand, adminGroundedReply } from '@/lib/ai-cmd';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/admin-auth'; // U76-AI-IMAGES — product audits from the agent
import { invalidateCatalog } from '@/lib/settings-cache';
import { slugify } from '@/lib/api-helpers';
import { storeDataUrlImage } from '@/lib/media-store';

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
// Gemini generates the FULL reply before the response arrives (non-streaming) —
// real gift-advice answers regularly exceed the 12s provider budget from
// Vercel serverless, which silently degraded لُو to the canned fallback.
const GEMINI_TIMEOUT_MS = 25_000;
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
  // U86-STOREFRONT — real discount/offer answers from the live catalog
  if (/خصم|خصومات|تخفيض|تخفيزات|عرض|عروض|وفّر|وفري|offer|discount|sale/.test(q)) {
    const discounted = (g?.productLines || []).filter((l) => l.includes('مخفّض'));
    if (discounted.length) {
      return `أيوه، عندنا خصومات شغالة دلوقتي 🌸 دي القايمة بالأسعار الحقيقية من الموقع:\n${discounted.join('\n')}\nوالتوصيل مجاني للطلبات فوق 900 ج.م 🚚`;
    }
    return 'مفيش خصومات شغالة في اللحظة دي — بس أسعارنا ثابتة ومتنافسة، والتوصيل مجاني للطلبات فوق 900 ج.م 🌸';
  }
  // U86-STOREFRONT — product search by name from the live catalog
  const nameWords = q
    .replace(/[؟?.!،]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const nameHit = (g?.productLines || []).find((l) =>
    nameWords.some((w) => normAr(l.toLowerCase()).includes(normAr(w)))
  );
  if (nameHit) {
    const matches = (g?.productLines || []).filter((l) =>
      nameWords.some((w) => normAr(l.toLowerCase()).includes(normAr(w)))
    );
    return `لقيتها عندنا 🌸 دي المنتجات المطابقة من الموقع:\n${matches.join('\n')}\nتلاقيها في صفحة «كل المنتجات» — ولو محتاجة مساعدة في الاختيار قوليلي.`;
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

  // U86-AI — Gemini provider (Studio → إعدادات الذكاء الاصطناعي): a real
  // model for free-form questions without the z-ai platform
  const aiSettings = await loadAiSettings();
  if (aiSettings.provider === 'gemini' && aiSettings.geminiApiKey) {
    try {
      const res = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${aiSettings.geminiModel}:generateContent?key=${encodeURIComponent(aiSettings.geminiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: buildSystemPrompt(grounding) }] },
              contents: msgs.slice(1).map((h) => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }],
              })),
              generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
            }),
          }
        ),
        GEMINI_TIMEOUT_MS
      );
      if (res.ok) {
        const j = await res.json();
        const content = (j?.candidates?.[0]?.content?.parts || [])
          .map((p: { text?: string }) => p.text || '')
          .join('')
          .trim();
        if (content) return { reply: content, source: 'provider', attempts: 1 };
      }
      // gemini hiccup → fall through to the z-ai/local chain
    } catch {
      // fall through
    }
  }

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

// ── U76-AI-IMAGES — admin agent with real vision + product tool execution ──
// The pre-wipe admin agent was rebuilt as a text-only shim after the sandbox
// wipe (images were accepted by the route but silently ignored). The owner
// asked for the assistant to accept product photos ALONGSIDE her instructions
// (name, price, …) and to act on them professionally on mobile/iPad/tablet.
// This rebuild gives runAgent two channels:
//  • text-only  → same live-grounded chat as before (zero regression);
//  • with image → z-ai vision (createVision) understands the photos TOGETHER
//    with her message, then the agent EXECUTES: stores every photo through
//    the shared WebP media pipeline (media-store) and creates the product
//    with her name/price/category — or returns an honest dry-run plan in
//    plan mode. Missing details (price/name) come back as a friendly ask.
export type AgentImage = { url: string };
export type AgentHistoryItem = { role: 'user' | 'ai'; text: string };

export type AgentToolResult = {
  tool: string;
  ok: boolean;
  dryRun?: boolean;
  summary?: string;
};

type VisionExtract = {
  intent?: 'add_product' | 'describe' | string;
  nameAr?: string | null;
  nameEn?: string | null;
  price?: number | string | null;
  compareAt?: number | string | null;
  categoryName?: string | null;
  stock?: number | string | null;
  badgeAr?: string | null;
  description?: string | null;
  reply?: string | null;
};

const VISION_TIMEOUT_MS = 45_000;

const normAr = (s: string) =>
  s.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');

function extractJson(raw: string): VisionExtract | null {
  const cleaned = raw.replace(/```json/gi, '```').split('```').join('\n').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as VisionExtract;
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

const num = (v: number | string | null | undefined): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function uniqueSlug(base: string): Promise<string> {
  const clean = base || `product-${Date.now()}`;
  let slug = clean;
  let n = 1;
  while (await db.product.findUnique({ where: { slug } })) slug = `${clean}-${n++}`;
  return slug;
}

function visionSystemPrompt(categoryNames: string[]): string {
  return `أنتِ "لُو" — مساعدة لوحة تحكم متجر LUBNÉL (لوبنيل) المصري لمستحضرات التجميل والعناية والبوكسات.
المديرة بعتّت رسالة وممكن تكون مرفقة صور منتجات (صورة المنتج، بطاقة سعر، لقطة من صفحة أخرى…).
حللي الصور مع الرسالة، وحددي اللي المديرة عايزاه، وردّي بصيغة JSON فقط — بدون أي نص خارج الـ JSON:

{
  "intent": "add_product" أو "describe",
  "nameAr": "اسم المنتج بالعربي (من كلام المديرة أولًا، وإلا من الصورة)",
  "nameEn": "الاسم بالإنجليزي إن أمكن أو null",
  "price": رقم أو null,
  "compareAt": السعر قبل الخصم إن وُجد (رقم أو null),
  "categoryName": "أقرب قسم من القائمة اللي تحت بالعربي أو null",
  "stock": عدد القطع إن ذُكر (رقم أو null),
  "badgeAr": "بادج قصير بالعربي مثل «جديد» أو null",
  "description": "وصف تسويقي قصير بالعربي (جملة أو جملتين) مستوحى من الصورة والرسالة",
  "reply": "رد ودود مختصر بالعربي للمديرة يلخص اللي فهمتيه"
}

القواعد:
- كلام المديرة أولى بصح على أي اسم أو رقم ظاهر في الصورة.
- لو المديرة طالبة إضافة/إنشاء منتج (أضيفي/اعملي/سجلي/ضيفي…) حتى لو البيانات ناقصة، خلي intent = "add_product" وكمّلي الناقص من الصورة (زي السعر من بطاقة السعر).
- ممنوع تمامًا تقولي في reply إنك أضفتِ أو نفذتِ أي حاجة — إنتِ بتحللي وتكتبي فهمتك فقط؛ التنفيذ الفعلي بيحصل من النظام بعد ردك.
- لو الرسالة سؤال أو تحليل أو وصف عام للصور، خلي intent = "describe" واكتبي إجابتك الكاملة في reply.
- الأسعار أرقام بالجنيه المصري بدون عملة.
قائمة الأقسام المتاحة: ${categoryNames.length ? categoryNames.join('، ') : '(لا توجد أقسام بعد)'}`;
}

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
  executed: AgentToolResult[];
  provider: 'provider' | 'local';
}> {
  const images = (opts.images || []).filter((i) => typeof i?.url === 'string' && i.url.startsWith('data:image/'));

  // No attachments → U86-AI-CMD: the admin command interpreter runs first
  // (real Arabic admin actions executed locally), then the live-grounded chat.
  if (!images.length) {
    if (opts.execute) {
      const cmd = await tryLocalAdminCommand({
        message: opts.message,
        admin: opts.admin,
        permissions: opts.permissions,
      });
      if (cmd) return { reply: cmd.reply, executed: cmd.executed, provider: 'local' };
    }
    const history: ChatMessage[] = [
      ...(opts.history || []).map((h) => ({
        role: (h.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: h.text,
      })),
      { role: 'user', content: opts.message },
    ];
    const result = await askAssistant(history);
    if (result.source === 'local' && opts.admin) {
      // U86-AI-CMD — the admin gets a grounded status reply instead of the
      // storefront customer-service canned fallback
      return { reply: await adminGroundedReply(opts.message), executed: [], provider: 'local' };
    }
    return { reply: result.reply, executed: [], provider: result.source };
  }

  return runVisionAgent(opts, images);
}

async function runVisionAgent(
  opts: {
    message: string;
    execute?: boolean;
    admin?: { id: number | string; username: string };
  },
  images: AgentImage[]
): Promise<{
  reply: string;
  executed: AgentToolResult[];
  provider: 'provider' | 'local';
}> {
  const executed: AgentToolResult[] = [];
  try {
    const categories = await db.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nameAr: true, nameEn: true },
    });
    const categoryNames = categories.map((c) => c.nameAr);

    const zai = await ZAI.create();
    const completion = await withTimeout(
      zai.chat.completions.createVision({
        // server's own default vision model (verified live U76); the TS body
        // type requires an explicit model string
        model: 'glm-5v-turbo',
        messages: [
          { role: 'system', content: visionSystemPrompt(categoryNames) },
          {
            role: 'user',
            content: [
              { type: 'text', text: opts.message },
              ...images.slice(0, 5).map((i) => ({
                type: 'image_url' as const,
                image_url: { url: i.url },
              })),
            ],
          },
        ],
        thinking: { type: 'disabled' },
      }),
      VISION_TIMEOUT_MS
    );
    const raw = completion.choices[0]?.message?.content?.trim() || '';
    if (!raw) throw new Error('empty vision response');
    const parsed = extractJson(raw);

    // U76 fix (browser-test finding): the model sometimes labels an add
    // request as "describe" while writing a misleading "تمت الإضافة بنجاح"
    // reply — decide the add flow by CONTENT (extracted name/price or an add
    // verb in her message), not by the intent label alone.
    const addVerb = /أضيفي|اضيفي|اعملي|عملي|سجلي|انشئي|أنشئي|ضيفي|حطي|إضافة|اضافة|زودي|سجلّي/i.test(opts.message);
    const wantAdd =
      !!parsed &&
      (parsed.intent === 'add_product' ||
        ((parsed.nameAr || '').trim().length > 0 && (num(parsed.price) !== null || addVerb)));

    // describe intent (or unparseable JSON) → the vision reply IS the answer
    if (!parsed || !wantAdd) {
      const reply =
        (parsed?.reply || '').trim() ||
        raw
          .replace(/^\s*\{[\s\S]*\}\s*$/, '')
          .trim() ||
        'شفت الصور اللي بعتيها 🌸 قوليلي تحبي أعمل بيها إيه — أضيفها منتج جديد بأي اسم وسعر؟';
      return { reply, executed, provider: 'provider' };
    }

    // ── add_product flow ──
    const exec = !!opts.execute;
    const nameAr = (parsed.nameAr || '').trim();
    const price = num(parsed.price);
    const compareAt = num(parsed.compareAt);
    const stock = num(parsed.stock);
    const givenCat = (parsed.categoryName || '').trim();

    if (!nameAr) {
      return {
        reply:
          'وصلتني الصور وشفتها 👌 بس ناقصني حاجة واحدة عشان أضيف المنتج: الاسم. اكتبي اسم المنتج وأنا أكمّل الباقي فورًا.',
        executed: [{ tool: 'product.prepare', ok: false, summary: 'الاسم ناقص' }],
        provider: 'provider',
      };
    }
    if (!price) {
      return {
        reply: `جاهزة أضيف «${nameAr}» على طول ✨ بس قوليلي السعر بكام (وممكن كمان سعره قبل الخصم لو فيه عرض) وأنفذ فورًا.`,
        executed: [{ tool: 'product.prepare', ok: false, summary: 'السعر ناقص' }],
        provider: 'provider',
      };
    }

    // resolve / create the category
    const nGiven = givenCat ? normAr(givenCat) : '';
    let category =
      (givenCat &&
        (categories.find((c) => normAr(c.nameAr) === nGiven) ||
          categories.find((c) => c.nameEn.trim().toLowerCase() === givenCat.toLowerCase()) ||
          categories.find((c) => normAr(c.nameAr).includes(nGiven) || nGiven.includes(normAr(c.nameAr))))) ||
      null;
    let catNote = '';
    if (!category && givenCat && exec) {
      const catSlug = await uniqueSlug(slugify(parsed.nameEn || givenCat));
      const created = await db.category.create({
        data: {
          slug: catSlug,
          nameAr: givenCat,
          nameEn: (parsed.nameEn || givenCat).trim(),
          description: `قسم أُنشئ تلقائيًا بواسطة المساعد الذكي`,
        },
      });
      category = { id: created.id, nameAr: created.nameAr, nameEn: created.nameEn };
      executed.push({ tool: 'category.create', ok: true, summary: created.nameAr });
    }
    if (!category && categories.length) {
      category = categories[0];
      if (givenCat) catNote = ` (مفيش قسم باسم «${givenCat}» — ضفته في «${category.nameAr}» وتقدري تنقليه)`;
      else catNote = ` (أول قسم في المتجر — تقدري تنقليه لقسم تاني)`;
    }

    if (exec) {
      // store every attached photo through the shared WebP pipeline
      const storedUrls: string[] = [];
      const stamp = Date.now();
      for (let i = 0; i < Math.min(images.length, 5); i++) {
        try {
          const stored = await storeDataUrlImage(
            images[i].url,
            `ai-product-${stamp}-${i + 1}`,
            opts.admin?.id ? String(opts.admin.id) : undefined
          );
          if (stored) {
            storedUrls.push(stored.url);
            executed.push({ tool: 'media.upload', ok: true, summary: stored.fileName });
          }
        } catch {
          executed.push({ tool: 'media.upload', ok: false, summary: `صورة ${i + 1} فشلت` });
        }
      }

      if (!category) {
        return {
          reply: 'مفيش أقسام في المتجر لسه — اعملي قسم أول (أو قوليلي اسم القسم اللي عايزاه وأنا أعمله وأضيف المنتج فيه).',
          executed: [...executed, { tool: 'product.create', ok: false, summary: 'لا يوجد قسم' }],
          provider: 'provider',
        };
      }

      const slug = await uniqueSlug(slugify(parsed.nameEn || nameAr));
      const product = await db.product.create({
        data: {
          slug,
          nameAr,
          nameEn: (parsed.nameEn || nameAr).trim(),
          description: (parsed.description || '').trim() || nameAr,
          price,
          compareAt: compareAt && compareAt > price ? compareAt : null,
          image: storedUrls[0] || '/products/placeholder.svg',
          gallery: storedUrls.length > 1 ? JSON.stringify(storedUrls.slice(1)) : null,
          categoryId: category.id,
          badgeAr: (parsed.badgeAr || '').trim() || null,
          badgeEn: null,
          stock: stock ? Math.max(0, Math.floor(stock)) : 20,
          published: true,
        },
      });
      executed.push({
        tool: 'product.create',
        ok: true,
        summary: `${nameAr} — ${price} ج.م — ${category.nameAr}`,
      });
      await writeAudit({
        actor: opts.admin?.username ?? null,
        action: 'product.created',
        entity: 'product',
        entityId: product.id,
        meta: { userAgent: 'ai-assistant' },
      });
      invalidateCatalog();

      const lines = [
        `تم يا فندم، المنتج بقي على الأرض ✅`,
        `«${nameAr}» — ${price} ج.م — قسم «${category.nameAr}»${catNote}`,
      ];
      if (compareAt && compareAt > price) lines.push(`مكتوب عليه إنه مخفّض من ${compareAt} ج.م 🏷️`);
      if (storedUrls.length) {
        lines.push(
          storedUrls.length === 1
            ? `والصورة اللي بعتيها بقت هي صورته الأساسية 📸`
            : `الصورة الأولى بقت صورته الأساسية و${storedUrls.length - 1} صورة تانية في الجاليري 📸`
        );
      } else {
        lines.push('ملحوظة: تعذر تخزين الصور، فضعنا الصورة الافتراضية مؤقتًا — ارفعي الصورة من صفحة المنتجات أو ابعتيها تاني.');
      }
      lines.push('تلاقيه في صفحة المنتجات دلوقتي — ولو عايزة تعدلي الوصف أو تضيفي صور، قوليلي 🌸');
      return { reply: lines.join('\n'), executed, provider: 'provider' };
    }

    // plan mode → honest dry-run plan
    const planSummary = `${nameAr} — ${price} ج.م — ${givenCat || category?.nameAr || 'قسم جديد'}`;
    const plan = [
      `جهزتلك خطة إضافة المنتج من الصور 📋`,
      `• الاسم: «${nameAr}»`,
      `• السعر: ${price} ج.م${compareAt && compareAt > price ? ` (مخفّض من ${compareAt} ج.م)` : ''}`,
      `• القسم: ${givenCat || category?.nameAr || 'هعمل قسم جديد'}${givenCat && !category ? ' (هجيب أقرب قسم أو أعمل جديد)' : ''}`,
      `• الصور: ${images.length === 1 ? 'الصورة المرفقة هتبقى صورته الأساسية' : `أول ${Math.min(images.length, 5)} صور — الأولى أساسية والباقي جاليري`}`,
      `فعلي «وضع التنفيذ الفعلي» من فوق وابعتي الطلب تاني — وأنفذ كل ده فورًا.`,
    ];
    return {
      reply: plan.join('\n'),
      executed: [{ tool: 'product.create', ok: true, dryRun: true, summary: planSummary }],
      provider: 'provider',
    };
  } catch (error) {
    console.error('[ai-agent] vision agent failed', error);
    return {
      reply:
        'تعذر قراءة الصور دلوقتي — غالبًا مشكلة مؤقتة في خدمة الذكاء الاصطناعي 😔 جرّبي تاني بعد دقيقة، أو ضيفي المنتج بالصورة عادي من قسم المنتجات. وأنا موجودة لأي سؤال نصي 🌸',
      executed,
      provider: 'local',
    };
  }
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
