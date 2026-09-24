// LUBNÉL AI Admin Agent endpoint — natural-language store management.
// mode "execute": tools run for real (requires ai.execute permission)
// mode "plan":    dry-run preview only (any admin with ai.use)
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";
import { runAgent, type AgentHistoryItem, type AgentImage } from "@/lib/ai-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  message?: string;
  images?: AgentImage[];
  history?: AgentHistoryItem[];
  mode?: "execute" | "plan";
};

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "ai.use");
  if (!ctx) return jsonError("غير مصرح", 401);
  try {
    const body = await parseBody<Body>(req);
    const message = (body.message || "").trim().slice(0, 4000);
    // U76-AI-IMAGES — data-URL photos from the compressed client upload; a
    // per-image char cap (≈1.9MB binary) + total cap keep the JSON body sane.
    const images = (body.images || [])
      .filter(
        (i) =>
          typeof i?.url === "string" &&
          i.url.startsWith("data:image/") &&
          i.url.length <= 2_500_000
      )
      .slice(0, 5)
      .filter((i, idx, arr) => arr.indexOf(i) === idx); // drop exact duplicates
    const totalImageChars = images.reduce((s, i) => s + i.url.length, 0);
    if (totalImageChars > 9_000_000) images.length = 0;
    const history = (body.history || [])
      .filter(h => (h.role === "user" || h.role === "ai") && typeof h.text === "string" && h.text.trim())
      .slice(-8)
      .map(h => ({ role: h.role, text: h.text.trim().slice(0, 600) }));
    if (!message && !images.length) return jsonError("اكتبي طلبكِ أولًا");

    const canExecute = ctx.permissions.includes("ai.execute");
    const mode: "execute" | "plan" = body.mode === "execute" && canExecute ? "execute" : "plan";

    const result = await runAgent({
      message: message || "حللي صور المنتج المرفقة وجهزي المنتج.",
      images,
      history,
      execute: mode === "execute",
      admin: { id: ctx.admin.id, username: ctx.admin.username },
      meta: ctx.meta,
      permissions: ctx.permissions,
    });

    await audit(ctx, mode === "execute" ? "ai.executed" : "ai.planned", "ai_agent", undefined, {
      mode,
      provider: result.provider,
      tools: result.executed.map(e => ({ tool: e.tool, ok: e.ok, dryRun: e.dryRun })),
    });

    return jsonOk({
      reply: result.reply,
      executed: result.executed,
      provider: result.provider,
      mode,
      canExecute,
    });
  } catch (error) {
    console.error("ai agent failed", error);
    return jsonError("تعذر تنفيذ طلب المساعد الآن — حاولي مرة أخرى", 500);
  }
}
