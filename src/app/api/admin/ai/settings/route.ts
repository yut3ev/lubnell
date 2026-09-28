// AI provider settings (owner-only): Gemini API key + model, provider switch,
// connection test. Stored in StoreSettings key "ai" — the key never leaves the
// server and is returned masked only.
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { loadAiSettings } from "@/lib/ai-agent";

export const dynamic = "force-dynamic";

async function requireOwner(req: Request) {
  const ctx = await requireAdmin(req, "ai.use");
  if (!ctx || ctx.admin.role !== "owner") return null;
  return ctx;
}

const mask = (key: string) => (key.length <= 6 ? "••••" : `${key.slice(0, 3)}••••••••${key.slice(-4)}`);

export async function GET(req: Request) {
  const ctx = await requireOwner(req);
  if (!ctx) return jsonError("إعدادات الذكاء الاصطناعي لمالكة المتجر فقط", 403);
  const s = await loadAiSettings();
  return jsonOk({
    provider: s.provider,
    geminiModel: s.geminiModel,
    hasKey: !!s.geminiApiKey,
    keyTail: s.geminiApiKey ? mask(s.geminiApiKey) : "",
    fromEnv: !s.geminiApiKey && !!process.env.GEMINI_API_KEY,
  });
}

export async function POST(req: Request) {
  const ctx = await requireOwner(req);
  if (!ctx) return jsonError("إعدادات الذكاء الاصطناعي لمالكة المتجر فقط", 403);
  try {
    const body = await parseBody<{ provider?: string; geminiApiKey?: string; geminiModel?: string; test?: boolean; testMessage?: string }>(req);

    if (body.test) {
      const s = await loadAiSettings();
      const envKey = process.env.GEMINI_API_KEY || "";
      const key = body.geminiApiKey?.trim() || s.geminiApiKey || envKey;
      const model = body.geminiModel?.trim() || s.geminiModel || "gemini-2.0-flash";
      if (!key) return jsonOk({ ok: false, message: "لا يوجد مفتاح Gemini محفوظ — ألصقي المفتاح أولًا" });
      if (!/^[a-z0-9._-]{1,64}$/i.test(model)) return jsonOk({ ok: false, message: "اسم الموديل غير صالح" });
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const geminiUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
        geminiUrl.searchParams.set("key", key);
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: body.testMessage || "قل جملة: LUBNÉL جاهزة ✦" }] }], generationConfig: { maxOutputTokens: 60 } }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json().catch(() => null) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
        if (!res.ok || !data) return jsonOk({ ok: false, message: `فشل الاتصال: ${data?.error?.message || `HTTP ${res.status}`}` });
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
        return jsonOk({ ok: true, message: `Gemini رد: ${text || "(رد فارغ)"}`, sample: text });
      } catch (e) {
        return jsonOk({ ok: false, message: `تعذر الاتصال بـ Gemini: ${e instanceof Error ? e.message : "خطأ شبكة"}` });
      }
    }

    const current = await db.storeSettings.findUnique({ where: { key: "ai" } });
    const merged = {
      ...(current ? JSON.parse(current.value || "{}") : {}),
      ...(body.provider === "gemini" || body.provider === "zai" ? { provider: body.provider } : {}),
      ...(typeof body.geminiApiKey === "string" ? { geminiApiKey: body.geminiApiKey.trim() } : {}),
      ...(typeof body.geminiModel === "string" && body.geminiModel.trim() ? { geminiModel: body.geminiModel.trim() } : {}),
    };
    await db.storeSettings.upsert({ where: { key: "ai" }, create: { key: "ai", value: JSON.stringify(merged) }, update: { value: JSON.stringify(merged) } });
    await audit(ctx, "settings.updated", "store_settings", "ai", { via: "ai-settings", provider: merged.provider });
    return jsonOk({
      success: true,
      provider: merged.provider,
      geminiModel: merged.geminiModel,
      hasKey: !!merged.geminiApiKey,
      keyTail: merged.geminiApiKey ? mask(String(merged.geminiApiKey)) : "",
    });
  } catch (error) {
    console.error("ai settings failed", error);
    return jsonError("تعذر حفظ إعدادات الذكاء الاصطناعي", 500);
  }
}
